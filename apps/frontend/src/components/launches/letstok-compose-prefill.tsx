'use client';

import { useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';

/**
 * sessionStorage key used as the hand-off mailbox for the LetsPost
 * composer. Studio-tools mints a token, this component redeems it and
 * drops the payload here for `AddEditModal` to pick up on next open.
 */
export const LETSTOK_COMPOSE_PREFILL_KEY = 'letstok-compose-prefill-v1';

interface ComposePrefillPayload {
  assetUrl: string;
  captions: string[];
  channelIds: string[];
  scheduledAt: string | null;
  bestTimeHints: string[];
}

interface RedeemResponse {
  payload: ComposePrefillPayload;
}

/**
 * Detects `?fromLetstok=<token>` on the launches route and redeems it
 * against the backend. On success, drops the resulting payload into
 * sessionStorage so the composer can prefill itself, then strips the
 * token from the URL so a refresh does not re-attempt.
 *
 * Rendering anything visible is optional — keep it null and silent so
 * the existing launches UI is untouched when no token is present.
 */
export const LetstokComposePrefill = (): null => {
  const fetch = useFetch();
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('fromLetstok');
  const handled = useRef(false);

  useEffect(() => {
    if (!token || handled.current) return;
    handled.current = true;
    let cancelled = false;

    const run = async () => {
      try {
        const res = await fetch('/letstok/compose-prefill/redeem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        if (!res.ok) {
          throw new Error(`Redeem failed (${res.status})`);
        }
        const data = (await res.json()) as RedeemResponse;
        if (cancelled) return;
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem(
            LETSTOK_COMPOSE_PREFILL_KEY,
            JSON.stringify(data.payload)
          );
        }
        // Notify any composer instance that is currently open.
        window.dispatchEvent(
          new CustomEvent('letstok-compose-prefill-ready', {
            detail: data.payload,
          })
        );
      } catch (err) {
        // Swallow — a stale or otherwise unusable token should not block
        // the user from using the regular compose flow.
        console.warn('[letstok-compose-prefill] redeem failed', err);
      } finally {
        // Drop the token from the URL whether redeem succeeded or not.
        const next = new URLSearchParams(params.toString());
        next.delete('fromLetstok');
        const query = next.toString();
        router.replace(query ? `?${query}` : '?', { scroll: false });
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [token, fetch, params, router]);

  return null;
};

export default LetstokComposePrefill;
