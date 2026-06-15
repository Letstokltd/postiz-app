import {
  AnalyticsData,
  AuthTokenDetails,
  PostDetails,
  PostResponse,
  SocialProvider,
} from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';
import { PinterestSettingsDto } from '@gitroom/nestjs-libraries/dtos/posts/providers-settings/pinterest.dto';
import axios from 'axios';
import FormData from 'form-data';
import { timer } from '@gitroom/helpers/utils/timer';
import {
  NotEnoughScopes,
  SocialAbstract,
} from '@gitroom/nestjs-libraries/integrations/social.abstract';
import dayjs from 'dayjs';
import { Tool } from '@gitroom/nestjs-libraries/integrations/tool.decorator';
import { Rules } from '@gitroom/nestjs-libraries/chat/rules.description.decorator';

function pinterestUseSandbox(): boolean {
  return process.env.PINTEREST_USE_SANDBOX === 'true';
}

function pinterestSandboxManualConnect(): boolean {
  return (
    pinterestUseSandbox() &&
    process.env.PINTEREST_SANDBOX_MANUAL_CONNECT === 'true'
  );
}

function pinterestSandboxFixedToken(): string | undefined {
  if (!pinterestUseSandbox()) {
    return undefined;
  }

  const token = process.env.PINTEREST_SANDBOX_TOKEN?.trim();
  return token ? token : undefined;
}

function pinterestApiBaseUrl(): string {
  return pinterestUseSandbox()
    ? 'https://api-sandbox.pinterest.com/v5'
    : 'https://api.pinterest.com/v5';
}

@Rules(
  'Pinterest requires at least one media, if posting a video, you must have two attachment, one for video, one for the cover picture, When posting a video, there can be only one'
)
export class PinterestProvider
  extends SocialAbstract
  implements SocialProvider
{
  identifier = 'pinterest';
  get name() {
    return 'Pinterest';
  }
  isBetweenSteps = false;
  scopes = [
    'boards:read',
    'boards:write',
    'pins:read',
    'pins:write',
    'user_accounts:read',
  ];
  override maxConcurrentJob = 3; // Pinterest has more lenient rate limits
  maxLength() {
    return 500;
  }

  dto = PinterestSettingsDto;

  editor = 'normal' as const;

  public override handleErrors(body: string):
    | {
        type: 'refresh-token' | 'bad-body';
        value: string;
      }
    | undefined {
    if (body.indexOf('cover_image_url or cover_image_content_type') > -1) {
      return {
        type: 'bad-body' as const,
        value:
          'When uploading a video, you must add also an image to be used as a cover image.',
      };
    }

    return undefined;
  }

  private oauthRedirectUri() {
    return `${process.env.FRONTEND_URL}/integrations/social/pinterest`;
  }

  private oauthTokenBody(params: Record<string, string>) {
    return new URLSearchParams(params);
  }

  private async exchangeAuthorizationCode(code: string) {
    const apiBase = pinterestApiBaseUrl();
    const redirectUri = this.oauthRedirectUri();
    const tokenResponse = await fetch(`${apiBase}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: this.oauthBasicAuth(),
      },
      body: this.oauthTokenBody({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    const tokenBody = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenBody.access_token) {
      console.error(
        '[pinterest] OAuth token exchange failed:',
        JSON.stringify(tokenBody),
        `endpoint=${apiBase}/oauth/token`,
        `redirect_uri=${redirectUri}`,
        pinterestUseSandbox() ? '(sandbox)' : '(production)'
      );
    }

    return { tokenResponse, tokenBody };
  }

  private async accountFromToken(accessToken: string) {
    const accountResponse = await fetch(`${pinterestApiBaseUrl()}/user_account`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const accountBody = await accountResponse.json();

    if (!accountResponse.ok || !accountBody?.username) {
      throw new NotEnoughScopes(
        accountBody?.message || 'Pinterest authentication failed'
      );
    }

    return accountBody;
  }

  async customFields() {
    // Fixed-token mode connects automatically; never prompt for a token.
    if (pinterestSandboxFixedToken()) {
      return undefined;
    }

    if (!pinterestSandboxManualConnect()) {
      return undefined;
    }

    return [
      {
        key: 'accessToken',
        label: 'Pinterest Sandbox access token',
        validation: `/^.{20,}$/`,
        type: 'password' as const,
      },
    ];
  }

  private async authenticateManualSandboxToken(code: string) {
    const body = JSON.parse(Buffer.from(code, 'base64').toString());
    const accessToken = body.accessToken as string;

    const { id, profile_image, username } =
      await this.accountFromToken(accessToken);

    return {
      id: id,
      name: username,
      accessToken,
      refreshToken: accessToken,
      expiresIn: dayjs().add(30, 'day').unix() - dayjs().unix(),
      picture: profile_image || '',
      username,
    };
  }

  private oauthBasicAuth() {
    return `Basic ${Buffer.from(
      `${process.env.PINTEREST_CLIENT_ID}:${process.env.PINTEREST_CLIENT_SECRET}`
    ).toString('base64')}`;
  }

  private assertScopes(scope: string | undefined) {
    if (!scope) {
      console.error(
        '[pinterest] OAuth token response missing scope field',
        pinterestUseSandbox() ? '(sandbox)' : '(production)'
      );
      throw new NotEnoughScopes();
    }

    console.log(
      `[pinterest] OAuth granted scopes (${pinterestUseSandbox() ? 'sandbox' : 'production'}):`,
      scope
    );

    try {
      this.checkScopes(this.scopes, scope);
    } catch (err) {
      if (err instanceof NotEnoughScopes) {
        console.error(
          '[pinterest] Missing required scopes. Required:',
          this.scopes.join(', ')
        );
      }
      throw err;
    }
  }

  async refreshToken(refreshToken: string): Promise<AuthTokenDetails> {
    const { access_token, expires_in } = await (
      await fetch(`${pinterestApiBaseUrl()}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: this.oauthBasicAuth(),
        },
        body: this.oauthTokenBody({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          scope: this.scopes.join(','),
          redirect_uri: this.oauthRedirectUri(),
        }),
      })
    ).json();

    const { id, profile_image, username } = await (
      await fetch(`${pinterestApiBaseUrl()}/user_account`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      })
    ).json();

    return {
      id: id,
      name: username,
      accessToken: access_token,
      refreshToken: refreshToken,
      expiresIn: expires_in,
      picture: profile_image || '',
      username,
    };
  }

  async generateAuthUrl() {
    const state = makeId(6);

    // Fixed-token mode: skip Pinterest's OAuth screen and route straight back
    // to our callback so the connect completes with the configured token.
    if (pinterestSandboxFixedToken()) {
      return {
        url: `${
          process.env.FRONTEND_URL
        }/integrations/social/pinterest?state=${state}&code=${makeId(10)}`,
        codeVerifier: makeId(10),
        state,
      };
    }

    if (pinterestSandboxManualConnect()) {
      return {
        url: state,
        codeVerifier: makeId(10),
        state,
      };
    }

    return {
      url: `https://www.pinterest.com/oauth/?client_id=${
        process.env.PINTEREST_CLIENT_ID
      }&redirect_uri=${encodeURIComponent(
        this.oauthRedirectUri()
      )}&response_type=code&scope=${encodeURIComponent(
        this.scopes.join(',')
      )}&state=${state}`,
      codeVerifier: makeId(10),
      state,
    };
  }

  async authenticate(params: {
    code: string;
    codeVerifier: string;
    refresh: string;
  }) {
    const fixedToken = pinterestSandboxFixedToken();
    if (fixedToken) {
      const { id, profile_image, username } = await this.accountFromToken(
        fixedToken
      );

      return {
        id,
        name: username,
        accessToken: fixedToken,
        refreshToken: fixedToken,
        expiresIn: dayjs().add(30, 'day').unix() - dayjs().unix(),
        picture: profile_image || '',
        username,
      };
    }

    if (pinterestSandboxManualConnect()) {
      try {
        const body = JSON.parse(Buffer.from(params.code, 'base64').toString());
        if (body.accessToken) {
          return this.authenticateManualSandboxToken(params.code);
        }
      } catch {
        // Fall through to OAuth when code is not a manual token payload.
      }
    }

    const { tokenResponse, tokenBody } = await this.exchangeAuthorizationCode(
      params.code
    );

    if (!tokenResponse.ok || !tokenBody.access_token) {
      throw new NotEnoughScopes(
        tokenBody?.message || 'Pinterest authentication failed'
      );
    }

    const { access_token, refresh_token, expires_in, scope } = tokenBody;

    this.assertScopes(scope);

    const { id, profile_image, username } =
      await this.accountFromToken(access_token);

    return {
      id: id,
      name: username,
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresIn: expires_in,
      picture: profile_image,
      username,
    };
  }

  @Tool({ description: 'List of boards', dataSchema: [] })
  async boards(accessToken: string) {
    const { items } = await (
      await fetch(`${pinterestApiBaseUrl()}/boards`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })
    ).json();

    return (
      items?.map((item: any) => ({
        name: item.name,
        id: item.id,
      })) || []
    );
  }

  async post(
    id: string,
    accessToken: string,
    postDetails: PostDetails<PinterestSettingsDto>[]
  ): Promise<PostResponse[]> {
    let mediaId = '';
    const findMp4 = postDetails?.[0]?.media?.find(
      (p) => (p.path?.indexOf('mp4') || -1) > -1
    );
    const picture = postDetails?.[0]?.media?.find(
      (p) => (p.path?.indexOf('mp4') || -1) === -1
    );

    if (findMp4 && pinterestUseSandbox()) {
      throw new Error(
        'Video pins are not supported in Pinterest Sandbox. Use an image pin for demo testing.'
      );
    }

    if (findMp4) {
      const { upload_url, media_id, upload_parameters } = await (
        await this.fetch(`${pinterestApiBaseUrl()}/media`, {
          method: 'POST',
          body: JSON.stringify({
            media_type: 'video',
          }),
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
        })
      ).json();

      const { data, status } = await axios.get(
        postDetails?.[0]?.media?.[0]?.path!,
        {
          responseType: 'stream',
        }
      );

      const formData = Object.keys(upload_parameters)
        .filter((f) => f)
        .reduce((acc, key) => {
          acc.append(key, upload_parameters[key]);
          return acc;
        }, new FormData());

      formData.append('file', data);
      await axios.post(upload_url, formData);

      let statusCode = '';
      while (statusCode !== 'succeeded') {
        const mediafile = await (
          await this.fetch(
            `${pinterestApiBaseUrl()}/media/${media_id}`,
            {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            },
            '',
            0,
            true
          )
        ).json();

        await timer(30000);
        statusCode = mediafile.status;
      }

      mediaId = media_id;
    }

    const mapImages = postDetails?.[0]?.media?.map((m) => ({
      path: m.path,
    }));

    const { id: pId } = await (
      await this.fetch(`${pinterestApiBaseUrl()}/pins`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...(postDetails?.[0]?.settings.link
            ? { link: postDetails?.[0]?.settings.link }
            : {}),
          ...(postDetails?.[0]?.settings.title
            ? { title: postDetails?.[0]?.settings.title }
            : {}),
          description: postDetails?.[0]?.message,
          ...(postDetails?.[0]?.settings.dominant_color
            ? { dominant_color: postDetails?.[0]?.settings.dominant_color }
            : {}),
          board_id: postDetails?.[0]?.settings.board,
          media_source: mediaId
            ? {
                source_type: 'video_id',
                media_id: mediaId,
                cover_image_url: picture?.path,
              }
            : mapImages?.length === 1
            ? {
                source_type: 'image_url',
                url: mapImages?.[0]?.path,
              }
            : {
                source_type: 'multiple_image_urls',
                items: mapImages,
              },
        }),
      })
    ).json();

    return [
      {
        id: postDetails?.[0]?.id,
        postId: pId,
        releaseURL: `https://www.pinterest.com/pin/${pId}`,
        status: 'success',
      },
    ];
  }

  async analytics(
    id: string,
    accessToken: string,
    date: number
  ): Promise<AnalyticsData[]> {
    const until = dayjs().format('YYYY-MM-DD');
    const since = dayjs().subtract(date, 'day').format('YYYY-MM-DD');

    const {
      all: { daily_metrics },
    } = await (
      await fetch(
        `${pinterestApiBaseUrl()}/user_account/analytics?start_date=${since}&end_date=${until}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      )
    ).json();

    return daily_metrics.reduce(
      (acc: any, item: any) => {
        if (typeof item.metrics.PIN_CLICK_RATE !== 'undefined') {
          acc[0].data.push({
            date: item.date,
            total: item.metrics.PIN_CLICK_RATE,
          });

          acc[1].data.push({
            date: item.date,
            total: item.metrics.IMPRESSION,
          });

          acc[2].data.push({
            date: item.date,
            total: item.metrics.PIN_CLICK,
          });

          acc[3].data.push({
            date: item.date,
            total: item.metrics.ENGAGEMENT,
          });

          acc[4].data.push({
            date: item.date,
            total: item.metrics.SAVE,
          });
        }

        return acc;
      },
      [
        { label: 'Pin click rate', data: [] as any[] },
        { label: 'Impressions', data: [] as any[] },
        { label: 'Pin Clicks', data: [] as any[] },
        { label: 'Engagement', data: [] as any[] },
        { label: 'Saves', data: [] as any[] },
      ]
    );
  }

  async postAnalytics(
    integrationId: string,
    accessToken: string,
    postId: string,
    date: number
  ): Promise<AnalyticsData[]> {
    const today = dayjs().format('YYYY-MM-DD');
    // Use a very long date range (2 years) to capture lifetime metrics for older posts
    const since = dayjs().subtract(2, 'year').format('YYYY-MM-DD');

    try {
      // Fetch pin analytics from Pinterest API
      const response = await this.fetch(
        `${pinterestApiBaseUrl()}/pins/${postId}/analytics?start_date=${since}&end_date=${today}&metric_types=IMPRESSION,PIN_CLICK,OUTBOUND_CLICK,SAVE`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();

      if (!data || !data.all) {
        return [];
      }

      const result: AnalyticsData[] = [];
      const metrics = data.all;

      if (metrics.lifetime_metrics) {
        const lifetimeMetrics = metrics.lifetime_metrics;

        if (lifetimeMetrics.IMPRESSION !== undefined) {
          result.push({
            label: 'Impressions',
            percentageChange: 0,
            data: [{ total: String(lifetimeMetrics.IMPRESSION), date: today }],
          });
        }

        if (lifetimeMetrics.PIN_CLICK !== undefined) {
          result.push({
            label: 'Pin Clicks',
            percentageChange: 0,
            data: [{ total: String(lifetimeMetrics.PIN_CLICK), date: today }],
          });
        }

        if (lifetimeMetrics.OUTBOUND_CLICK !== undefined) {
          result.push({
            label: 'Outbound Clicks',
            percentageChange: 0,
            data: [{ total: String(lifetimeMetrics.OUTBOUND_CLICK), date: today }],
          });
        }

        if (lifetimeMetrics.SAVE !== undefined) {
          result.push({
            label: 'Saves',
            percentageChange: 0,
            data: [{ total: String(lifetimeMetrics.SAVE), date: today }],
          });
        }
      }

      return result;
    } catch (err) {
      console.error('Error fetching Pinterest post analytics:', err);
      return [];
    }
  }
}
