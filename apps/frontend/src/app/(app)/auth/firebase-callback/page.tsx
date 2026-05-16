'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { LETSTOK_PENDING_ACTION_KEY } from '@gitroom/frontend/components/launches/letstok-launches-deeplink';

/**
 * Whitelisted LetsTok actions LetsPost knows how to honor after SSO. Keep in
 * sync with the producer side (`studio-tools/src/utils/letspost-sso.ts`) and
 * the deep-link handler.
 */
const ALLOWED_LETSTOK_ACTIONS = new Set(['addChannel']);

function setCookie(name: string, value: string, days: number) {
  if (typeof document === 'undefined') return;
  const d = new Date();
  d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie =
    name + '=' + value + ';expires=' + d.toUTCString() + ';path=/';
}

/** LetsTok Studio sends `redirect` — only relative in-app URLs are accepted. */
function safeRedirect(raw: string | null): string {
  const fallback = '/launches';
  if (!raw) {
    return fallback;
  }
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw.trim());
  } catch {
    return fallback;
  }
  if (
    !decoded.startsWith('/') ||
    decoded.startsWith('//') ||
    decoded.includes('://')
  ) {
    return fallback;
  }
  return decoded || fallback;
}

/**
 * If the redirect URL also carries `letstokAction=...`, lift it out and return
 * the cleaned URL alongside the action. This lets us hand the action off via
 * sessionStorage and keeps the URL bar tidy after the redirect.
 */
function extractLetstokAction(redirect: string): {
  redirect: string;
  letstokAction: string | null;
} {
  const sep = redirect.indexOf('?');
  if (sep === -1) {
    return { redirect, letstokAction: null };
  }
  const pathname = redirect.slice(0, sep);
  const query = new URLSearchParams(redirect.slice(sep + 1));
  const action = query.get('letstokAction');
  if (!action) {
    return { redirect, letstokAction: null };
  }
  query.delete('letstokAction');
  const remaining = query.toString();
  return {
    redirect: remaining ? `${pathname}?${remaining}` : pathname,
    letstokAction: action,
  };
}

export default function FirebaseCallbackPage() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const fetchData = useFetch();

  useEffect(() => {
    const token = searchParams.get('token');
    const rawRedirect = safeRedirect(searchParams.get('redirect'));
    const { redirect: cleanedRedirect, letstokAction: redirectAction } =
      extractLetstokAction(rawRedirect);
    /**
     * Prefer the dedicated `letstokAction` query param (more robust against
     * Next middleware bounces that can rewrite `redirect`), fall back to one
     * embedded in the redirect URL.
     */
    const rawAction = searchParams.get('letstokAction') || redirectAction;
    const letstokAction =
      rawAction && ALLOWED_LETSTOK_ACTIONS.has(rawAction) ? rawAction : null;
    const afterAuthHref = cleanedRedirect;
    if (!token) {
      setError('Missing token. Please try logging in again.');
      return;
    }

    // Drop token from the address bar (still in memory for this request only).
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', '/auth/firebase-callback');
    }

    fetchData('/auth/firebase-sso', {
      method: 'POST',
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || 'Firebase SSO failed');
        }

        const authHeader = res.headers.get('auth') || res.headers.get('Auth');
        if (authHeader) {
          setCookie('auth', authHeader, 365);
        }

        /**
         * Persist the pending LetsTok intent synchronously before the hard
         * navigation so the deep-link handler can pick it up even if the URL
         * is rewritten by middleware or the param is missing on the next page.
         */
        if (letstokAction && typeof sessionStorage !== 'undefined') {
          try {
            sessionStorage.setItem(LETSTOK_PENDING_ACTION_KEY, letstokAction);
          } catch {
            // sessionStorage can throw in private modes — fall back to URL.
          }
        }

        window.location.href = afterAuthHref;
      })
      .catch((e) => {
        setError(e?.message || 'Unable to sign in. Please try again.');
      });
  }, [searchParams, fetchData]);

  if (error) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <p className="text-red-500">{error}</p>
        <a href="/auth" className="underline text-primary">
          Back to login
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <LoadingComponent />
      <p className="text-sm text-gray-400">Signing you in...</p>
    </div>
  );
}
