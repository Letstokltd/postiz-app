'use client';

import { useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAddProvider } from '@gitroom/frontend/components/launches/add.provider.component';

/**
 * sessionStorage key used as the hand-off mailbox for LetsTok Studio intents.
 * The firebase-callback page writes here synchronously before the post-SSO
 * navigation; this component then drains the value once the launches UI is
 * mounted. Decoupling the intent from the URL means it survives middleware
 * redirects, mount-order races, and the `useSearchParams` SSR/hydration gap.
 *
 * Keep this constant in sync with
 * `apps/frontend/src/app/(app)/auth/firebase-callback/page.tsx` and the
 * producer side in studio-tools (`src/utils/letspost-sso.ts`).
 */
export const LETSTOK_PENDING_ACTION_KEY = 'letstok-pending-action-v1';

const LETSTOK_QUERY_PARAM = 'letstokAction';
const ALLOWED_ACTIONS = new Set(['addChannel']);

const readPendingAction = (): string | null => {
  if (typeof sessionStorage === 'undefined') {
    return null;
  }
  try {
    return sessionStorage.getItem(LETSTOK_PENDING_ACTION_KEY);
  } catch {
    return null;
  }
};

const clearPendingAction = (): void => {
  if (typeof sessionStorage === 'undefined') {
    return;
  }
  try {
    sessionStorage.removeItem(LETSTOK_PENDING_ACTION_KEY);
  } catch {
    // No-op — failure here only means the next mount may see a stale value,
    // which the handledRef guard already protects against.
  }
};

/**
 * When LetsTok Studio opens LetsPost as `/launches?letstokAction=addChannel`
 * (or hands the intent off via sessionStorage from /auth/firebase-callback),
 * open the existing Add Channel modal and strip the URL param.
 */
export const LetstokLaunchesDeepLink = ({
  update,
}: {
  update?: (shouldReload: boolean) => Promise<void>;
}): null => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const openAddModal = useAddProvider(() => {
    void update?.(true);
  });
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return;

    /**
     * sessionStorage is the primary channel because the firebase-callback
     * page writes it before the post-SSO navigation; the URL param is a
     * fallback for direct-URL hits (e.g. cookie-SSO shortcut path).
     */
    const storedAction = readPendingAction();
    const queryAction = searchParams.get(LETSTOK_QUERY_PARAM);
    const action = storedAction || queryAction;

    if (!action) return;
    if (!ALLOWED_ACTIONS.has(action)) {
      // Unknown action — clear it so we do not retry forever.
      clearPendingAction();
      return;
    }
    if (action !== 'addChannel') return;

    handledRef.current = true;
    clearPendingAction();
    let cancelled = false;

    const run = async () => {
      await openAddModal();
      if (cancelled) return;
      if (queryAction) {
        const next = new URLSearchParams(searchParams.toString());
        next.delete(LETSTOK_QUERY_PARAM);
        const query = next.toString();
        router.replace(query ? `?${query}` : '?', { scroll: false });
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [openAddModal, router, searchParams]);

  return null;
};
