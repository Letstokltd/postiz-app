'use client';

import { useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAddProvider } from '@gitroom/frontend/components/launches/add.provider.component';

/**
 * When LetsTok Studio opens LetsPost as `/launches?letstokAction=addChannel`,
 * SSO lands here — open the existing Add Channel modal and strip the param.
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
    const action = searchParams.get('letstokAction');
    if (action !== 'addChannel') return;

    handledRef.current = true;
    let cancelled = false;

    const run = async () => {
      await openAddModal();
      if (cancelled) return;
      const next = new URLSearchParams(searchParams.toString());
      next.delete('letstokAction');
      const query = next.toString();
      router.replace(query ? `?${query}` : '?', { scroll: false });
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [openAddModal, router, searchParams]);

  return null;
};
