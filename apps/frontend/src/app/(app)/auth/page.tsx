import { internalFetch } from '@gitroom/helpers/utils/internal.fetch';
export const dynamic = 'force-dynamic';
import { Register } from '@gitroom/frontend/components/auth/register';
import { Metadata } from 'next';
import { isGeneralServerSide } from '@gitroom/helpers/utils/is.general.server.side';
import Link from 'next/link';
import { getT } from '@gitroom/react/translation/get.translation.service.backend';
import { LoginWithOidc } from '@gitroom/frontend/components/auth/login.with.oidc';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: `${isGeneralServerSide() ? 'Postiz' : 'Gitroom'} Register`,
  description: '',
};

export default async function Auth(params: {searchParams: {provider: string}}) {
  const t = await getT();

  // Firebase SSO: redirect to studio-tools for auth; auto-redirect if already logged in
  if (process.env.FIREBASE_SSO_ENABLED === 'true') {
    const studioUrl = process.env.FIREBASE_SSO_STUDIO_URL || process.env.FIREBASE_AUTH_REDIRECT_URL || 'https://studio-tools.letstok.com';
    // Use FIREBASE_AUTH_RETURN_URL (Postiz home base) so callback redirects back to Postiz, not studio-tools
    const postizBase = (
      process.env.FIREBASE_AUTH_RETURN_URL ||
      process.env.FRONTEND_URL ||
      process.env.MAIN_URL ||
      ''
    ).replace(/\/$/, '');
    if (postizBase && postizBase.startsWith('http')) {
      const firebaseCallbackUrl = `${postizBase}/auth/firebase-callback`;
      const returnTo = encodeURIComponent(firebaseCallbackUrl);
      redirect(`${studioUrl}/sso-redirect?returnTo=${returnTo}`);
    }
  }

  if (process.env.DISABLE_REGISTRATION === 'true') {
    const canRegister = (
      await (await internalFetch('/auth/can-register')).json()
    ).register;
    if (!canRegister && !params?.searchParams?.provider) {
      return (
        <>
          <LoginWithOidc />
          <div className="text-center">
            {t('registration_is_disabled', 'Registration is disabled')}
            <br />
            <Link className="underline hover:font-bold" href="/auth/login">
              {t('login_instead', 'Login instead')}
            </Link>
          </div>
        </>
      );
    }
  }
  return <Register />;
}
