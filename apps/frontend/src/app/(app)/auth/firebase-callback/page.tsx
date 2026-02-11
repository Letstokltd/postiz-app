'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';

/**
 * Get token from URL - check search params first, then hash fragment.
 * URLSearchParams returns already-decoded values.
 */
function getTokenFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  if (token) return token;
  const hash = window.location.hash?.slice(1);
  if (hash) {
    const hashParams = new URLSearchParams(hash);
    return hashParams.get('token');
  }
  return null;
}

/**
 * Firebase SSO callback - receives token from studio-tools redirect (URL),
 * exchanges for Postiz session, then redirects to app.
 */
export default function FirebaseCallbackPage() {
  const searchParams = useSearchParams();
  const fetchApi = useFetch();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get('token') || getTokenFromUrl();

    if (!token?.trim()) {
      setError('Missing token. Please try logging in again.');
      return;
    }

    fetchApi('/auth/firebase-sso', {
      method: 'POST',
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || 'Firebase SSO failed');
        }
        window.location.href = '/';
      })
      .catch((e) => {
        setError(e?.message || 'Unable to sign in. Please try again.');
      });
  }, [searchParams, fetchApi]);

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
