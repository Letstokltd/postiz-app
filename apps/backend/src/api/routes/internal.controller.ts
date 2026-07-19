import {
  Controller,
  Post,
  Body,
  UnauthorizedException,
  Headers,
  Logger,
} from '@nestjs/common';
import { PlanSyncService } from '@gitroom/nestjs-libraries/services/plan-sync.service';
import { IntegrationService } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service';
import { IntegrationRepository } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.repository';
import { NotificationService } from '@gitroom/nestjs-libraries/database/prisma/notifications/notification.service';
import { PostsService } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.service';
import { MediaService } from '@gitroom/nestjs-libraries/database/prisma/media/media.service';
import { IntegrationManager } from '@gitroom/nestjs-libraries/integrations/integration.manager';
import { ioRedis } from '@gitroom/nestjs-libraries/redis/redis.service';

/** Random id for post/value/image blocks (mirrors the frontend publish client). */
function makeId(len: number): string {
  const chars =
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let out = '';
  for (let i = 0; i < len; i++)
    out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Plain caption (lines) → Post-valid HTML (mirrors studio captionToPostHtml). */
function captionToPostHtml(text: string): string {
  const raw = (text || '').trim();
  if (!raw) return '<p>.</p>';
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  return lines.map((l) => `<p>${escapeHtml(l.trim())}</p>`).join('');
}

interface InternalPublishChannel {
  integrationId: string;
  /** Provider-specific settings already built by the caller (LetsTok side). */
  settings?: Record<string, unknown>;
}

interface InternalPublishBody {
  firebaseUid: string;
  /** Public URL to import into the media library (mutually optional with mediaId). */
  mediaUrl?: string;
  /** Existing media id in the org's library (e.g. from /upload-from-url). */
  mediaId?: string;
  caption?: string;
  contentHtml?: string;
  type?: 'now' | 'schedule' | 'draft';
  date?: string;
  shortLink?: boolean;
  channels: InternalPublishChannel[];
}

@Controller('/api/internal')
export class InternalController {
  private readonly logger = new Logger(InternalController.name);

  constructor(
    private _planSyncService: PlanSyncService,
    private _integrationRepository: IntegrationRepository,
    private _integrationService: IntegrationService,
    private _notificationService: NotificationService,
    private _postsService: PostsService,
    private _mediaService: MediaService,
    private _integrationManager: IntegrationManager,
  ) {}

  private assertInternalKey(apiKey: string): void {
    const expectedKey = process.env.INTERNAL_API_KEY;
    if (!expectedKey || !apiKey || apiKey !== expectedKey) {
      throw new UnauthorizedException('Invalid or missing internal API key');
    }
  }

  /**
   * Delegated access ("Marketing Manager", LetsTok Studio feature): add the
   * manager's Postiz user to the client's org as ADMIN so they can manage
   * channels and post from the Postiz UI. Idempotent.
   */
  @Post('/delegations/upsert')
  async delegationUpsert(
    @Headers('x-internal-api-key') apiKey: string,
    @Body()
    body: { managerFirebaseUid: string; clientFirebaseUid: string }
  ) {
    this.assertInternalKey(apiKey);
    if (!body?.managerFirebaseUid || !body?.clientFirebaseUid) {
      return {
        success: false,
        message: 'managerFirebaseUid and clientFirebaseUid are required',
      };
    }
    const result = await this._planSyncService.upsertDelegationMembership(
      body.managerFirebaseUid,
      body.clientFirebaseUid
    );
    this.logger.log(
      `Delegation upsert manager=${body.managerFirebaseUid} client=${body.clientFirebaseUid} → ${JSON.stringify(
        result
      )}`
    );
    return result;
  }

  /** Delegated access: remove the manager from the client's org (revoked). */
  @Post('/delegations/remove')
  async delegationRemove(
    @Headers('x-internal-api-key') apiKey: string,
    @Body()
    body: { managerFirebaseUid: string; clientFirebaseUid: string }
  ) {
    this.assertInternalKey(apiKey);
    if (!body?.managerFirebaseUid || !body?.clientFirebaseUid) {
      return {
        success: false,
        message: 'managerFirebaseUid and clientFirebaseUid are required',
      };
    }
    const result = await this._planSyncService.removeDelegationMembership(
      body.managerFirebaseUid,
      body.clientFirebaseUid
    );
    this.logger.log(
      `Delegation remove manager=${body.managerFirebaseUid} client=${body.clientFirebaseUid} → ${JSON.stringify(
        result
      )}`
    );
    return result;
  }

  @Post('/invalidate-plan-cache')
  async invalidatePlanCache(
    @Headers('x-internal-api-key') apiKey: string,
    @Body() body: { firebaseUid: string }
  ) {
    const expectedKey = process.env.INTERNAL_API_KEY;
    if (!expectedKey || !apiKey || apiKey !== expectedKey) {
      throw new UnauthorizedException('Invalid or missing internal API key');
    }

    if (!body.firebaseUid) {
      return { success: false, message: 'firebaseUid is required' };
    }

    await this._planSyncService.invalidateCache(body.firebaseUid);
    this.logger.log(
      `Plan cache invalidated for firebaseUid: ${body.firebaseUid}`
    );
    return { success: true };
  }

  @Post('/enforce-channel-limit')
  async enforceChannelLimit(
    @Headers('x-internal-api-key') apiKey: string,
    @Body() body: { firebaseUid: string; maxChannels: number }
  ) {
    const expectedKey = process.env.INTERNAL_API_KEY;
    if (!expectedKey || !apiKey || apiKey !== expectedKey) {
      throw new UnauthorizedException('Invalid or missing internal API key');
    }

    if (!body.firebaseUid || body.maxChannels === undefined) {
      return {
        success: false,
        message: 'firebaseUid and maxChannels are required',
      };
    }

    const orgId = await this._planSyncService.getOrgIdByFirebaseUid(
      body.firebaseUid
    );
    if (!orgId) {
      this.logger.warn(
        `No org found for firebaseUid: ${body.firebaseUid}`
      );
      return { success: true, disabled: 0, message: 'No org found' };
    }

    const activeChannels =
      await this._integrationRepository.getIntegrationsList(orgId);
    const activeCount = activeChannels.filter((c) => !c.disabled).length;
    const excess = activeCount - body.maxChannels;

    if (excess <= 0) {
      return { success: true, disabled: 0 };
    }

    const disabledCount = await this._integrationRepository.disableIntegrations(
      orgId,
      excess
    );

    if (body.maxChannels <= 2) {
      try {
        await this._integrationService.changeActiveCron(orgId);
      } catch (err: any) {
        this.logger.warn(`Failed to terminate autopost workflows: ${err?.message}`);
      }
    }

    await this._notificationService.inAppNotification(
      orgId,
      'Channels disabled',
      `Your plan was downgraded. ${disabledCount} channel(s) were disabled due to your plan limit of ${body.maxChannels} channels. You can choose which channels to keep active in your settings.`
    );

    this.logger.log(
      `Disabled ${disabledCount} channels for org ${orgId} (firebaseUid: ${body.firebaseUid}, max: ${body.maxChannels})`
    );

    return { success: true, disabled: disabledCount };
  }

  /**
   * List a user's connected (non-disabled) channels, for the WhatsApp publish
   * picker. Resolves the org from the Firebase UID.
   */
  @Post('/integrations')
  async listIntegrations(
    @Headers('x-internal-api-key') apiKey: string,
    @Body() body: { firebaseUid: string }
  ) {
    this.assertInternalKey(apiKey);

    if (!body.firebaseUid) {
      return { success: false, message: 'firebaseUid is required' };
    }

    const orgId = await this._planSyncService.getOrgIdByFirebaseUid(
      body.firebaseUid
    );
    if (!orgId) {
      return { success: false, message: 'No organization found' };
    }

    const list = await this._integrationRepository.getIntegrationsList(orgId);
    const integrations = list
      .filter((i) => !i.disabled && !i.deletedAt)
      .map((i) => ({
        id: i.id,
        name: i.name,
        identifier: i.providerIdentifier,
        picture: i.picture,
        // Provider account id (Facebook Page id / Instagram user id). Needed by
        // callers to compose a Meta Ads `object_story_id` (<pageId>_<postId>)
        // so an organic post can be boosted into an ad with no manual step.
        internalId: i.internalId,
        // Per-network caption character limit, so callers can keep posts compliant.
        maxLength: this.safeMaxLength(i.providerIdentifier),
      }));

    return { success: true, integrations };
  }

  /** Best-effort per-provider caption char limit (null if unknown). */
  private safeMaxLength(identifier: string): number | null {
    try {
      const provider = this._integrationManager.getSocialIntegration(identifier);
      const len = (provider as any)?.maxLength?.();
      return typeof len === 'number' ? len : null;
    } catch {
      return null;
    }
  }

  /** Caption character limits for all supported networks (for pre-connect guidance). */
  @Post('/network-limits')
  async networkLimits(@Headers('x-internal-api-key') apiKey: string) {
    this.assertInternalKey(apiKey);
    const limits: Record<string, number | null> = {};
    for (const network of this._integrationManager.getAllowedSocialsIntegrations()) {
      limits[network] = this.safeMaxLength(network);
    }
    return { success: true, limits };
  }

  /**
   * Publish a single media post to one or more of the user's channels on their
   * behalf. `settings` per channel are built by the caller (LetsTok side);
   * `mapTypeToPost` injects `__type` and validates against the provider DTOs.
   *
   * NOTE: bypasses the @CheckPolicies([Create, POSTS_PER_MONTH]) guard that the
   * normal POST /posts route applies (accepted, see plan decision #1).
   */
  @Post('/publish')
  async publish(
    @Headers('x-internal-api-key') apiKey: string,
    @Body() body: InternalPublishBody
  ) {
    this.assertInternalKey(apiKey);

    if (!body.firebaseUid) {
      return { success: false, message: 'firebaseUid is required' };
    }
    if (!body.mediaUrl && !body.mediaId) {
      return { success: false, message: 'mediaUrl or mediaId is required' };
    }
    if (!body.channels?.length) {
      return { success: false, message: 'At least one channel is required' };
    }

    const orgId = await this._planSyncService.getOrgIdByFirebaseUid(
      body.firebaseUid
    );
    if (!orgId) {
      return { success: false, message: 'No organization found' };
    }

    // Validate that every requested channel belongs to this org and is active.
    const orgIntegrations =
      await this._integrationRepository.getIntegrationsList(orgId);
    const allowedIds = new Set(
      orgIntegrations.filter((i) => !i.disabled && !i.deletedAt).map((i) => i.id)
    );
    const invalid = body.channels.filter(
      (c) => !c.integrationId || !allowedIds.has(c.integrationId)
    );
    if (invalid.length) {
      return {
        success: false,
        message: `Unknown or inactive channel(s): ${invalid
          .map((c) => c.integrationId)
          .join(', ')}`,
      };
    }

    // Resolve the media: an existing library id, or import from URL.
    let media: { id: string; path: string };
    if (body.mediaId) {
      const existing = await this._mediaService.getMediaById(body.mediaId);
      if (!existing || existing.organizationId !== orgId || existing.deletedAt) {
        return {
          success: false,
          message: `Media ${body.mediaId} not found in this account's library`,
        };
      }
      media = { id: existing.id, path: existing.path };
    } else {
      try {
        media = (await this._mediaService.importFromUrl(
          orgId,
          body.mediaUrl
        )) as { id: string; path: string };
      } catch (err: any) {
        this.logger.error(
          `Internal publish media import failed for ${body.firebaseUid}: ${err?.message}`
        );
        return {
          success: false,
          message: `Media import failed: ${err?.message ?? 'unknown error'}`,
        };
      }
    }

    const type = body.type ?? 'now';
    const date = body.date ?? new Date().toISOString();
    const contentHtml =
      body.contentHtml ?? captionToPostHtml(body.caption ?? '');

    const postBody = {
      type,
      date,
      shortLink: body.shortLink ?? false,
      tags: [] as { value: string; label: string }[],
      posts: body.channels.map((c) => ({
        integration: { id: c.integrationId },
        settings: c.settings ?? {},
        value: [
          {
            content: contentHtml,
            id: makeId(10),
            delay: 0,
            image: [{ id: makeId(10), path: media.path }],
          },
        ],
      })),
    };

    try {
      const mapped = await this._postsService.mapTypeToPost(
        postBody as any,
        orgId
      );
      const result = await this._postsService.createPost(orgId, mapped);
      this.logger.log(
        `Internal publish created ${result.length} post(s) for org ${orgId} (firebaseUid: ${body.firebaseUid})`
      );
      return { success: true, posts: result };
    } catch (err: any) {
      this.logger.error(
        `Internal publish failed for ${body.firebaseUid}: ${err?.message}`
      );
      return {
        success: false,
        message: err?.response?.message ?? err?.message ?? 'Publish failed',
      };
    }
  }

  /** Return the OAuth URL the user clicks to connect a social channel. */
  @Post('/connect-url')
  async connectUrl(
    @Headers('x-internal-api-key') apiKey: string,
    @Body() body: { firebaseUid: string; integration: string },
  ) {
    this.assertInternalKey(apiKey);
    if (!body.firebaseUid || !body.integration) {
      return { success: false, message: 'firebaseUid and integration are required' };
    }
    const orgId = await this._planSyncService.getOrgIdByFirebaseUid(body.firebaseUid);
    if (!orgId) return { success: false, message: 'No organization found' };
    if (!this._integrationManager.getAllowedSocialsIntegrations().includes(body.integration)) {
      return { success: false, message: `Integration "${body.integration}" is not allowed` };
    }
    try {
      const provider = this._integrationManager.getSocialIntegration(body.integration);
      const { codeVerifier, state, url } = await (provider as any).generateAuthUrl();
      await ioRedis.set(`organization:${state}`, orgId, 'EX', 3600);
      await ioRedis.set(`login:${state}`, codeVerifier, 'EX', 3600);
      return { success: true, url, state };
    } catch (err: any) {
      this.logger.error(`connect-url failed for ${body.firebaseUid}: ${err?.message}`);
      return { success: false, message: err?.message ?? 'Failed to generate auth url' };
    }
  }

  /** Import a media URL into the user's Letstok Social media library. */
  @Post('/upload-from-url')
  async uploadFromUrl(
    @Headers('x-internal-api-key') apiKey: string,
    @Body() body: { firebaseUid: string; url: string; filename?: string },
  ) {
    this.assertInternalKey(apiKey);
    if (!body.firebaseUid || !body.url) {
      return { success: false, message: 'firebaseUid and url are required' };
    }
    const orgId = await this._planSyncService.getOrgIdByFirebaseUid(body.firebaseUid);
    if (!orgId) return { success: false, message: 'No organization found' };
    try {
      const media = await this._mediaService.importFromUrl(orgId, body.url, body.filename);
      return { success: true, media };
    } catch (err: any) {
      return { success: false, message: err?.message ?? 'Upload failed' };
    }
  }

  /** List the user's posts in a date range (also used for a calendar snapshot). */
  @Post('/posts/list')
  async postsList(
    @Headers('x-internal-api-key') apiKey: string,
    @Body() body: { firebaseUid: string; startDate: string; endDate: string; customer?: string },
  ) {
    this.assertInternalKey(apiKey);
    if (!body.firebaseUid) return { success: false, message: 'firebaseUid is required' };
    const orgId = await this._planSyncService.getOrgIdByFirebaseUid(body.firebaseUid);
    if (!orgId) return { success: false, message: 'No organization found' };
    try {
      const posts = await this._postsService.getPosts(orgId, {
        startDate: body.startDate,
        endDate: body.endDate,
        customer: body.customer,
      } as any);
      return { success: true, posts };
    } catch (err: any) {
      return { success: false, message: err?.message ?? 'Failed to list posts' };
    }
  }

  /** Delete a post (the whole group) by id. */
  @Post('/posts/delete')
  async postsDelete(
    @Headers('x-internal-api-key') apiKey: string,
    @Body() body: { firebaseUid: string; id: string },
  ) {
    this.assertInternalKey(apiKey);
    if (!body.firebaseUid || !body.id) {
      return { success: false, message: 'firebaseUid and id are required' };
    }
    const orgId = await this._planSyncService.getOrgIdByFirebaseUid(body.firebaseUid);
    if (!orgId) return { success: false, message: 'No organization found' };
    try {
      const post = await this._postsService.getPost(orgId, body.id);
      if (!post) return { success: false, message: 'Post not found' };
      await this._postsService.deletePost(orgId, (post as any).group);
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err?.message ?? 'Failed to delete post' };
    }
  }

  /** Analytics (click tracking) for a single post. */
  @Post('/posts/analytics')
  async postsAnalytics(
    @Headers('x-internal-api-key') apiKey: string,
    @Body() body: { firebaseUid: string; id: string },
  ) {
    this.assertInternalKey(apiKey);
    if (!body.firebaseUid || !body.id) {
      return { success: false, message: 'firebaseUid and id are required' };
    }
    const orgId = await this._planSyncService.getOrgIdByFirebaseUid(body.firebaseUid);
    if (!orgId) return { success: false, message: 'No organization found' };
    try {
      const statistics = await this._postsService.getStatistics(orgId, body.id);
      return { success: true, statistics };
    } catch (err: any) {
      return { success: false, message: err?.message ?? 'Failed to get analytics' };
    }
  }

  /**
   * Per-post platform insights — labeled metric series (views/impressions/
   * engagement) for a single published post, pulled from the network's analytics.
   * Same data the dashboard's /analytics/post/:id endpoint returns.
   */
  @Post('/posts/insights')
  async postsInsights(
    @Headers('x-internal-api-key') apiKey: string,
    @Body() body: { firebaseUid: string; id: string; date?: string | number },
  ) {
    this.assertInternalKey(apiKey);
    if (!body.firebaseUid || !body.id) {
      return { success: false, message: 'firebaseUid and id are required' };
    }
    const orgId = await this._planSyncService.getOrgIdByFirebaseUid(body.firebaseUid);
    if (!orgId) return { success: false, message: 'No organization found' };
    try {
      const insights = await this._postsService.checkPostAnalytics(
        orgId,
        body.id,
        Number(body.date ?? 30),
      );
      return { success: true, insights };
    } catch (err: any) {
      return { success: false, message: err?.message ?? 'Failed to get post insights' };
    }
  }

  /**
   * Platform analytics for ONE connected channel (followers, impressions,
   * engagement, etc.) over the last `date` days. checkAnalytics only uses
   * org.id, so the resolved orgId is enough.
   */
  @Post('/channel-analytics')
  async channelAnalytics(
    @Headers('x-internal-api-key') apiKey: string,
    @Body() body: { firebaseUid: string; integrationId: string; date?: string },
  ) {
    this.assertInternalKey(apiKey);
    if (!body.firebaseUid || !body.integrationId) {
      return { success: false, message: 'firebaseUid and integrationId are required' };
    }
    const orgId = await this._planSyncService.getOrgIdByFirebaseUid(body.firebaseUid);
    if (!orgId) return { success: false, message: 'No organization found' };
    try {
      const analytics = await this._integrationService.checkAnalytics(
        { id: orgId } as any,
        body.integrationId,
        body.date ?? '30',
      );
      return { success: true, analytics };
    } catch (err: any) {
      return { success: false, message: err?.message ?? 'Failed to get channel analytics' };
    }
  }

  /**
   * Unified analytics overview — per-channel platform analytics for ALL the
   * user's connected social channels in one call. Each channel is returned
   * separately (metrics differ per network); the caller composes the summary.
   */
  @Post('/analytics-overview')
  async analyticsOverview(
    @Headers('x-internal-api-key') apiKey: string,
    @Body() body: { firebaseUid: string; date?: string },
  ) {
    this.assertInternalKey(apiKey);
    if (!body.firebaseUid) return { success: false, message: 'firebaseUid is required' };
    const orgId = await this._planSyncService.getOrgIdByFirebaseUid(body.firebaseUid);
    if (!orgId) return { success: false, message: 'No organization found' };
    const date = body.date ?? '30';
    const list = await this._integrationRepository.getIntegrationsList(orgId);
    const social = list.filter(
      (i) => !i.disabled && !i.deletedAt && i.type === 'social',
    );
    const channels = await Promise.all(
      social.map(async (i) => {
        try {
          const analytics = await this._integrationService.checkAnalytics(
            { id: orgId } as any,
            i.id,
            date,
          );
          return {
            id: i.id,
            name: i.name,
            identifier: i.providerIdentifier,
            picture: i.picture,
            analytics,
          };
        } catch (err: any) {
          return {
            id: i.id,
            name: i.name,
            identifier: i.providerIdentifier,
            error: err?.message ?? 'analytics unavailable',
          };
        }
      }),
    );
    return { success: true, days: Number(date), channels };
  }
}
