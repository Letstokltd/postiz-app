'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  User,
  onAuthStateChanged,
} from 'firebase/auth';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';

/**
 * Firebase auth provider for Postiz - authenticates users directly in Postiz
 * using Firebase (no redirect to studio-tools). Exchanges Firebase token for
 * Postiz session and redirects to dashboard.
 */
export function FirebaseAuthProvider() {
  const fetchApi = useFetch();
  const [auth, setAuth] = useState<ReturnType<typeof getAuth> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [exchanging, setExchanging] = useState(false);
  const exchangedRef = useRef(false);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    const messagingSenderId =
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
    const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;

    if (!apiKey || !authDomain || !projectId || !appId) {
      setError(
        'Firebase not configured. Set NEXT_PUBLIC_FIREBASE_* environment variables.'
      );
      setLoading(false);
      return;
    }

    if (getApps().length === 0) {
      initializeApp({
        apiKey,
        authDomain,
        projectId,
        storageBucket: storageBucket || undefined,
        messagingSenderId: messagingSenderId || undefined,
        appId,
      });
    }
    setAuth(getAuth());
    setLoading(false);
  }, []);

  const exchangeTokenAndRedirect = useCallback(
    async (user: User) => {
      if (exchangedRef.current) return;
      exchangedRef.current = true;
      setExchanging(true);
      setError(null);

      // Google/social accounts are pre-verified; only require verification for email/password
      const isSocialProvider = user.providerData?.some(
        (p) => p.providerId === 'google.com' || p.providerId?.includes('.com')
      );
      if (!isSocialProvider && !user.emailVerified) {
        setError(
          'Please verify your email before signing in. Check your inbox for the verification link.'
        );
        exchangedRef.current = false;
        setExchanging(false);
        return;
      }

      try {
        const token = await user.getIdToken();
        const res = await fetchApi('/auth/firebase-sso', {
          method: 'POST',
          body: JSON.stringify({ token }),
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || 'Sign in failed');
        }

        window.location.href = '/launches';
      } catch (e) {
        exchangedRef.current = false;
        setExchanging(false);
        const msg =
          e instanceof Error ? e.message : 'Sign in failed';
        setError(
          msg.includes('Failed to fetch') || msg.includes('NetworkError')
            ? 'Could not reach the server. Check your connection and try again.'
            : msg + ' Please try again.'
        );
      }
    },
    [fetchApi]
  );

  useEffect(() => {
    if (!auth) return;

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && !exchangedRef.current) {
        exchangeTokenAndRedirect(user);
      }
    });
    return () => unsubscribe();
  }, [auth, exchangeTokenAndRedirect]);

  const handleGoogleSignIn = useCallback(async () => {
    if (!auth || exchanging) return;
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
      // onAuthStateChanged will handle exchange and redirect
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      const code = err?.code || '';
      const msg = err?.message || 'Google sign-in failed';
      if (code === 'auth/unauthorized-domain') {
        setError(
          'This domain is not authorized for Firebase. Add it in Firebase Console → Authentication → Settings → Authorized domains.'
        );
      } else if (code === 'auth/popup-blocked') {
        setError('Sign-in popup was blocked. Please allow popups and try again.');
      } else if (code === 'auth/popup-closed-by-user') {
        setError(null);
      } else {
        setError(msg + ' Please try again.');
      }
    }
  }, [auth, exchanging]);

  if (loading || exchanging) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8">
        <LoadingComponent />
        <p className="text-sm text-gray-400">
          {exchanging ? 'Signing you in...' : 'Loading...'}
        </p>
      </div>
    );
  }

  if (error && !auth) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div>
        <h1 className="text-center text-3xl font-bold mb-4">
          Sign in to Postiz
        </h1>
        <p className="text-center text-gray-500 text-sm">
          Use your Firebase account to continue
        </p>
      </div>

      {error && (
        <div className="w-full max-w-md">
          <p className="text-red-500 text-sm text-center">{error}</p>
        </div>
      )}

      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={exchanging}
        className="flex items-center justify-center gap-3 w-full max-w-md h-[52px] rounded-[10px] bg-white border border-gray-200 hover:bg-gray-50 text-[#0E0E0E] font-medium transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 48 48"
          width="21"
          height="21"
        >
          <path
            fill="#FFC107"
            d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"
          />
          <path
            fill="#FF3D00"
            d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"
          />
          <path
            fill="#4CAF50"
            d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"
          />
          <path
            fill="#1976D2"
            d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"
          />
        </svg>
        <span>Continue with Google</span>
      </button>
    </div>
  );
}
