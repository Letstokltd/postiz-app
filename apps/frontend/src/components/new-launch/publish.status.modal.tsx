'use client';

import { FC, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import clsx from 'clsx';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { useT } from '@gitroom/react/translation/get.transation.service.client';

/**
 * Shown after "Post now". An immediate post must confirm the PUBLISH, not just
 * that the post was added to the queue — TikTok requires the user to be told
 * that processing may take a few minutes and to be shown when it completes.
 *
 * `POST /posts` only enqueues the job, so the publish result has to be polled
 * from the post record itself.
 *
 * NOTE: poll by post id, never by the `group` sent in the create payload —
 * `createOrUpdatePost` discards it and writes its own uuid, so a lookup by the
 * client-side group always comes back empty.
 */

const POLL_MS = 3000;
const GIVE_UP_MS = 6 * 60 * 1000;

type PostRow = {
  id: string;
  state: 'QUEUE' | 'PUBLISHED' | 'ERROR' | 'DRAFT';
  releaseURL?: string | null;
  error?: string | null;
  integration?: { name?: string; providerIdentifier?: string } | null;
};

const Step: FC<{
  label: string;
  status: 'done' | 'active' | 'pending' | 'failed';
  note?: string;
}> = ({ label, status, note }) => (
  <div className="flex gap-[12px] items-start">
    <div className="mt-[2px]">
      {status === 'active' ? (
        <div className="animate-spin h-[18px] w-[18px] border-2 border-[#612BD3] border-t-transparent rounded-full" />
      ) : (
        <div
          className={clsx(
            'h-[18px] w-[18px] rounded-full flex items-center justify-center text-[11px] text-white',
            status === 'done' && 'bg-[#22C55E]',
            status === 'failed' && 'bg-[#FF3F3F]',
            status === 'pending' && 'bg-newBgLineColor'
          )}
        >
          {status === 'done' ? '✓' : status === 'failed' ? '!' : ''}
        </div>
      )}
    </div>
    <div className="flex-1">
      <div
        className={clsx(
          'text-[15px]',
          status === 'pending' ? 'opacity-50' : 'font-[600]'
        )}
      >
        {label}
      </div>
      {!!note && (
        <div className="text-[13px] opacity-70 text-balance mt-[2px]">
          {note}
        </div>
      )}
    </div>
  </div>
);

export const PublishStatusModal: FC<{
  postIds: string[];
  onDone?: () => void;
}> = ({ postIds, onDone }) => {
  const fetch = useFetch();
  const modal = useModals();
  const t = useT();
  const [stopped, setStopped] = useState(false);

  const { data } = useSWR(
    postIds?.length ? ['publish-status', ...postIds] : null,
    async () => {
      const rows = await Promise.all(
        postIds.map(async (id) => {
          try {
            const result = await (await fetch(`/posts/${id}`)).json();
            return result?.posts?.[0];
          } catch (err) {
            return undefined;
          }
        })
      );
      return rows.filter(Boolean);
    },
    {
      refreshInterval: stopped ? 0 : POLL_MS,
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    }
  );

  const posts = (data || []) as PostRow[];

  const { allSettled, anyError, anyPublished } = useMemo(() => {
    const settled =
      posts.length > 0 &&
      posts.every((p) => p.state === 'PUBLISHED' || p.state === 'ERROR');
    return {
      allSettled: settled,
      anyError: posts.some((p) => p.state === 'ERROR'),
      anyPublished: posts.some((p) => p.state === 'PUBLISHED'),
    };
  }, [posts]);

  useEffect(() => {
    if (allSettled) {
      setStopped(true);
    }
  }, [allSettled]);

  useEffect(() => {
    const timer = setTimeout(() => setStopped(true), GIVE_UP_MS);
    return () => clearTimeout(timer);
  }, []);

  const title = !postIds?.length
    ? t('post_submitted', 'Post submitted')
    : !allSettled
    ? t('publishing', 'Publishing…')
    : anyError && !anyPublished
    ? t('publish_failed', 'Publishing failed')
    : anyError
    ? t('publish_partial', 'Partly published')
    : t('published', 'Published');

  return (
    <div className="flex flex-col gap-[20px] p-[20px] min-w-[420px]">
      <div className="text-[20px] font-[600]">{title}</div>

      <div className="flex flex-col gap-[24px]">
        {!postIds?.length && (
          <Step
            label={t('publish_step_untracked', 'Your post was submitted')}
            status="done"
            note={t(
              'publish_untracked_note',
              'Publishing is running in the background, but the status could not be tracked here. Check the calendar in a few minutes to confirm it published.'
            )}
          />
        )}
        {!!postIds?.length && posts.length === 0 && (
          <Step
            label={t('publish_step_submitted', 'Submitting your post…')}
            status="active"
          />
        )}

        {posts.map((post) => {
          const name =
            post.integration?.name ||
            post.integration?.providerIdentifier ||
            t('your_channel', 'Your channel');
          const provider = post.integration?.providerIdentifier || '';
          const platform = provider
            ? provider.charAt(0).toUpperCase() +
              provider.slice(1).split('-')[0]
            : t('the_platform', 'the platform');
          const isQueue = post.state === 'QUEUE' || post.state === 'DRAFT';
          const isPublished = post.state === 'PUBLISHED';
          const isError = post.state === 'ERROR';

          return (
            <div key={post.id} className="flex flex-col gap-[14px]">
              {posts.length > 1 && (
                <div className="text-[14px] font-[600] opacity-80">{name}</div>
              )}

              <Step
                label={t('publish_step_submitted_done', 'Submitted')}
                status="done"
              />
              <Step
                label={`${t('publish_step_processing', 'Processing on')} ${platform}`}
                status={isQueue ? 'active' : isError ? 'failed' : 'done'}
                note={
                  isQueue
                    ? `${platform} ${t(
                        'processing_note',
                        'is processing your video. It may take a few minutes before it appears on your profile.'
                      )}`
                    : undefined
                }
              />
              <Step
                label={t('publish_step_published', 'Published')}
                status={
                  isPublished ? 'done' : isError ? 'failed' : 'pending'
                }
                note={
                  isError
                    ? post.error ||
                      t('publish_generic_error', 'Publishing failed.')
                    : undefined
                }
              />

              {isPublished && !!post.releaseURL && (
                <a
                  href={post.releaseURL}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#B69DEC] hover:underline text-[14px]"
                >
                  {`${t('view_on', 'View on')} ${platform}`}
                </a>
              )}
            </div>
          );
        })}

        {stopped && !allSettled && (
          <div className="text-[13px] opacity-70 text-balance">
            {t(
              'publish_still_processing',
              'This is taking longer than usual. The platform may still be processing your video — check your profile in a few minutes.'
            )}
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => {
            // The calendar was refreshed before publishing finished, so refresh
            // again on the way out or it still shows the queued state.
            onDone?.();
            modal.closeAll();
          }}
          className="h-[44px] px-[24px] rounded-[8px] bg-[#612BD3] text-white text-[15px] font-[600]"
        >
          {allSettled || stopped || !postIds?.length
            ? t('close', 'Close')
            : t('hide', 'Hide')}
        </button>
      </div>
    </div>
  );
};
