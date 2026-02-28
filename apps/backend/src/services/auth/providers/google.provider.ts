import { makeId } from '@gitroom/nestjs-libraries/services/make.is';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library/build/src/auth/oauth2client';
import { ProvidersInterface } from '@gitroom/backend/services/auth/providers.interface';

const getGoogleRedirectUri = () =>
  process.env.GOOGLE_OAUTH_REDIRECT_URI ||
  `${process.env.FRONTEND_URL}/integrations/social/youtube`;

/** Login: use GOOGLE_LOGIN_REDIRECT_URI for local (e.g. http://localhost:4007/auth); otherwise matches production (integrations/social/youtube) */
const getGoogleLoginRedirectUri = () =>
  process.env.GOOGLE_LOGIN_REDIRECT_URI ||
  getGoogleRedirectUri();

const clientWithRedirect = (redirectUri: string) => {
  const client = new google.auth.OAuth2({
    clientId: process.env.YOUTUBE_CLIENT_ID,
    clientSecret: process.env.YOUTUBE_CLIENT_SECRET,
    redirectUri,
  });

  const youtube = (newClient: OAuth2Client) =>
    google.youtube({
      version: 'v3',
      auth: newClient,
    });

  const youtubeAnalytics = (newClient: OAuth2Client) =>
    google.youtubeAnalytics({
      version: 'v2',
      auth: newClient,
    });

  const oauth2 = (newClient: OAuth2Client) =>
    google.oauth2({
      version: 'v2',
      auth: newClient,
    });

  return { client, youtube, oauth2, youtubeAnalytics };
};

const clientAndYoutube = () =>
  clientWithRedirect(getGoogleRedirectUri());

export class GoogleProvider implements ProvidersInterface {
  generateLink() {
    const state = 'login';
    const redirectUri = getGoogleLoginRedirectUri();
    const { client } = clientWithRedirect(redirectUri);
    return client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      state,
      redirect_uri: redirectUri,
      scope: [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
      ],
    });
  }

  async getToken(code: string, redirectUri?: string) {
    const clientRedirectUri = redirectUri?.trim();
    const clientBaseUri =
      clientRedirectUri?.includes('?') ? clientRedirectUri.split('?')[0] : undefined;
    const configuredRedirectUri = getGoogleLoginRedirectUri();
    const fallbackRedirectUris = [
      clientBaseUri ?? clientRedirectUri,
      clientRedirectUri,
      configuredRedirectUri,
      `${process.env.FRONTEND_URL}/auth/login`,
      `${process.env.FRONTEND_URL}/auth?provider=GOOGLE`,
      `${process.env.FRONTEND_URL}/auth`,
    ].filter((uri): uri is string => !!uri && /^https?:\/\//.test(uri));
    const redirectUris = Array.from(new Set(fallbackRedirectUris));

    if (!redirectUris.length) {
      throw new Error(
        'Google OAuth redirect URI is not configured. Set GOOGLE_LOGIN_REDIRECT_URI, GOOGLE_OAUTH_REDIRECT_URI, or FRONTEND_URL.'
      );
    }

    let lastError: unknown;
    for (const uri of redirectUris) {
      try {
        const { client } = clientWithRedirect(uri);
        const { tokens } = await client.getToken({
          code,
          redirect_uri: uri,
        });
        return tokens.access_token;
      } catch (error) {
        lastError = error;
      }
    }

    if (lastError instanceof Error) {
      throw lastError;
    }

    throw new Error('Google OAuth token exchange failed');
  }

  async getUser(providerToken: string) {
    const { client, oauth2 } = clientAndYoutube();
    client.setCredentials({ access_token: providerToken });
    const user = oauth2(client);
    const { data } = await user.userinfo.get();

    return {
      id: data.id!,
      email: data.email,
    };
  }
}
