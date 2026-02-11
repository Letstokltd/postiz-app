'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';

/**
 * Firebase SSO callback - receives token from studio-tools redirect,
 * exchanges for Postiz session, then redirects to app.
 */
export default function FirebaseCallbackPage() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setError('Missing token. Please try logging in again.');
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL || '';
    fetch(`${apiUrl}/auth/firebase-sso`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
      credentials: 'include',
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
  }, [searchParams]);

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
