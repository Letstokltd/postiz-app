'use client';

import { FC, useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import clsx from 'clsx';
import {
  PostComment,
  withProvider,
} from '@gitroom/frontend/components/new-launch/providers/high.order.provider';
import { TikTokDto } from '@gitroom/nestjs-libraries/dtos/posts/providers-settings/tiktok.dto';
import { useSettings } from '@gitroom/frontend/components/launches/helpers/use.values';
import { Select } from '@gitroom/react/form/select';
import { Textarea } from '@gitroom/react/form/textarea';
import { Checkbox } from '@gitroom/react/form/checkbox';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useIntegration } from '@gitroom/frontend/components/launches/helpers/use.integration';
import { useLaunchStore } from '@gitroom/frontend/components/new-launch/store';
import { useCustomProviderFunction } from '@gitroom/frontend/components/launches/helpers/use.custom.provider.function';
import { stripHtmlValidation } from '@gitroom/helpers/utils/strip.html.validation';
import { TiktokPreview } from '@gitroom/frontend/components/new-launch/providers/tiktok/tiktok.preview';

export const TIKTOK_CAPTION_LIMIT = 2200;

export interface TikTokCreatorInfo {
  nickname: string;
  username: string;
  avatar: string;
  privacyOptions: string[];
  commentDisabled: boolean;
  duetDisabled: boolean;
  stitchDisabled: boolean;
  maxDurationSeconds?: number;
  audited: boolean;
}

export const isTikTokVideoPath = (path?: string) => {
  if (!path) {
    return false;
  }
  const clean = path.split('?')[0].toLowerCase();
  return /\.(mp4|mov|webm|m4v)$/.test(clean) || clean.includes('mp4');
};

const TikTokSettings: FC<{ values?: any }> = () => {
  const { watch, register, setValue } = useSettings();
  const { value, integration } = useIntegration();
  const customFunction = useCustomProviderFunction();
  const t = useT();
  const setPostNowLabel = useLaunchStore((state) => state.setPostNowLabel);
  const selectedCount = useLaunchStore(
    (state) => state.selectedIntegrations.length
  );

  // TikTok requires the publishing screen to show the LATEST creator nickname
  // and to offer only the privacy options / interactions this creator has
  // available, so this is re-queried every time the composer opens.
  const {
    data: rawCreator,
    isLoading,
    mutate: reloadCreator,
  } = useSWR(
    integration?.id ? ['tiktok-creator-info', integration.id] : null,
    () => customFunction.get('creatorInfo'),
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
      dedupingInterval: 0,
    }
  );

  const creator: TikTokCreatorInfo | null =
    rawCreator && typeof rawCreator === 'object'
      ? (rawCreator as TikTokCreatorInfo)
      : null;

  const media = (value?.[0]?.image || []) as { path: string }[];
  const hasVideo = media.some((m) => isTikTokVideoPath(m?.path));
  const isPhoto = media.length > 0 && !hasVideo;

  const content_posting_method = watch('content_posting_method');
  const isUploadMode = content_posting_method === 'UPLOAD';

  const disclose = watch('disclose');
  const brand_organic_toggle = watch('brand_organic_toggle');
  const brand_content_toggle = watch('brand_content_toggle');
  const privacy_level = watch('privacy_level');
  const title = watch('title') || '';

  // ---- defaults -----------------------------------------------------------
  // NOTE: privacy_level is deliberately NOT defaulted. TikTok requires the user
  // to select visibility manually with no pre-selected value.
  useEffect(() => {
    if (!watch('content_posting_method')) {
      setValue('content_posting_method', 'DIRECT_POST', {
        shouldValidate: true,
      });
    }
    setValue('autoAddMusic', watch('autoAddMusic') || 'no');
    setValue('duet', watch('duet') || false);
    setValue('stitch', watch('stitch') || false);
    setValue('comment', watch('comment') || false);
  }, [setValue]);

  // ---- caption ------------------------------------------------------------
  // The caption shown here is the exact string sent as post_info.title.
  const contentText = useMemo(
    () => stripHtmlValidation('normal', value?.[0]?.content || '', true),
    [value]
  );

  const initialTitle = useRef<string | undefined>(undefined);
  if (initialTitle.current === undefined) {
    initialTitle.current = watch('title') || '';
  }
  const [customCaption, setCustomCaption] = useState(!!initialTitle.current);

  useEffect(() => {
    if (!customCaption) {
      setValue('title', contentText, { shouldValidate: true });
    }
  }, [contentText, customCaption, setValue]);

  // Direct-Post-only values must never survive into an inbox upload.
  useEffect(() => {
    if (!isUploadMode) {
      return;
    }
    setValue('privacy_level', '');
    setValue('disclose', false);
    setValue('brand_organic_toggle', false);
    setValue('brand_content_toggle', false);
    setValue('video_made_with_ai', false);
    setValue('duet', false);
    setValue('stitch', false);
    setValue('comment', false);
  }, [isUploadMode, setValue]);

  // A draft upload must never be labelled "Post now" — it does not post.
  useEffect(() => {
    if (selectedCount === 1 && isUploadMode) {
      setPostNowLabel(
        t('tiktok_send_to_tiktok', 'Send to TikTok for editing')
      );
    } else {
      setPostNowLabel(null);
    }

    return () => {
      setPostNowLabel(null);
    };
  }, [selectedCount, isUploadMode, setPostNowLabel]);

  // Branded content cannot be private. This is enforced by validation, NOT by
  // clearing privacy_level: clearing it is destructive and unticking branded
  // content could never restore it, which dead-ended the composer.
  //
  // Turning disclosure off must also clear the brand claims. They live inside a
  // visually hidden container, so a stale `true` here is invisible to the user
  // while still blocking every publish attempt.
  useEffect(() => {
    if (disclose) {
      return;
    }
    if (brand_organic_toggle) {
      setValue('brand_organic_toggle', false);
    }
    if (brand_content_toggle) {
      setValue('brand_content_toggle', false);
    }
  }, [disclose, brand_organic_toggle, brand_content_toggle, setValue]);

  // Never keep a privacy value TikTok did not offer for this creator.
  useEffect(() => {
    if (
      creator &&
      privacy_level &&
      !creator.privacyOptions.includes(privacy_level)
    ) {
      setValue('privacy_level', '');
    }
  }, [creator, privacy_level, setValue]);

  const privacyLabels: Record<string, string> = {
    PUBLIC_TO_EVERYONE: t('tiktok_privacy_public', 'Public to everyone'),
    MUTUAL_FOLLOW_FRIENDS: t('tiktok_privacy_friends', 'Friends'),
    FOLLOWER_OF_CREATOR: t('tiktok_privacy_followers', 'Followers'),
    SELF_ONLY: t('tiktok_privacy_self', 'Only me'),
  };

  return (
    <div className="flex flex-col">
      {/* ---- creator identity: always visible, never a tooltip ---- */}
      <div className="flex items-center gap-[12px] pb-[16px] mb-[16px] border-b border-tableBorder">
        {isLoading && !creator ? (
          <div className="text-[14px] opacity-70">
            {t('tiktok_loading_account', 'Loading your TikTok account…')}
          </div>
        ) : (
          <>
            <img
              src={creator?.avatar || integration?.picture || '/no-picture.jpg'}
              alt={creator?.nickname || integration?.name || 'TikTok'}
              className="w-[42px] h-[42px] rounded-full object-cover"
            />
            <div className="flex flex-col">
              <div className="text-[16px] font-[600]">
                {creator?.nickname || integration?.name}
              </div>
              <div className="text-[13px] opacity-70">
                {creator?.username
                  ? `@${creator.username}`
                  : integration?.display
                  ? `@${integration.display}`
                  : ''}
              </div>
            </div>
          </>
        )}
      </div>

      {!isLoading && !creator && (
        <div className="text-[14px] mb-[16px] text-[#FF9800]">
          {t(
            'tiktok_creator_info_failed',
            'Could not load your TikTok account details. Posting is disabled until this succeeds.'
          )}{' '}
          <button
            type="button"
            className="underline"
            onClick={() => reloadCreator()}
          >
            {t('retry', 'Retry')}
          </button>
        </div>
      )}

      {/* ---- posting method: two clearly separated TikTok workflows ---- */}
      <div className="text-[14px] font-[600] mb-[10px]">
        {t('label_content_posting_method', 'How should this be posted?')}
      </div>
      <div className="flex flex-col gap-[12px] mb-[20px]">
        <label className="flex gap-[10px] items-start cursor-pointer">
          <input
            type="radio"
            className="mt-[4px]"
            value="DIRECT_POST"
            {...register('content_posting_method')}
          />
          <div>
            <div className="font-[600]">
              {t('tiktok_direct_post', 'Post directly to TikTok')}
            </div>
            <div className="text-[13px] opacity-70">
              {t(
                'tiktok_direct_post_help',
                'Publishes to your TikTok profile using the caption and settings below.'
              )}
            </div>
          </div>
        </label>
        <label className="flex gap-[10px] items-start cursor-pointer">
          <input
            type="radio"
            className="mt-[4px]"
            value="UPLOAD"
            {...register('content_posting_method')}
          />
          <div>
            <div className="font-[600]">
              {t('tiktok_send_for_editing', 'Send to TikTok for editing')}
            </div>
            <div className="text-[13px] opacity-70">
              {t(
                'tiktok_send_for_editing_help',
                'Sends the video to your TikTok inbox. You finish the caption, privacy and interaction settings inside the TikTok app and publish from there.'
              )}
            </div>
          </div>
        </label>
      </div>

      {isUploadMode ? (
        <div className="text-[14px] text-balance bg-newSettings rounded-[10px] p-[12px]">
          {t(
            'tiktok_upload_mode_notice',
            'Nothing below is sent with a draft upload — TikTok collects the caption, privacy and interaction settings in the app. After sending, open the notification in your TikTok inbox to edit and publish this video.'
          )}
        </div>
      ) : (
        <>
          {/* ---- caption ---- */}
          <div className="flex items-center gap-[10px] mb-[6px]">
            <div className="text-[14px] font-[600] flex-1">
              {t('tiktok_caption', 'TikTok caption')}
            </div>
            <button
              type="button"
              className="text-[13px] text-[#B69DEC] hover:underline"
              onClick={() => setCustomCaption(!customCaption)}
            >
              {customCaption
                ? t('tiktok_use_global_caption', 'Use global caption')
                : t('tiktok_customise_caption', 'Customise for TikTok')}
            </button>
          </div>
          <Textarea
            label=""
            className="min-h-[90px]"
            maxLength={TIKTOK_CAPTION_LIMIT}
            disabled={!customCaption}
            {...register('title')}
          />
          <div
            className={clsx(
              'text-[13px] mt-[4px] mb-[16px] flex',
              title.length > TIKTOK_CAPTION_LIMIT && 'text-[#FF3F3F]'
            )}
          >
            <div className="flex-1 opacity-70">
              {t(
                'tiktok_caption_help',
                'This exact text will be posted to TikTok.'
              )}
            </div>
            <div>
              {title.length} / {TIKTOK_CAPTION_LIMIT}
            </div>
          </div>

          {/* ---- privacy: options come from creator_info, no default ---- */}
          <Select
            label={t('label_who_can_see_this_video', 'Who can see this video?')}
            {...register('privacy_level')}
          >
            <option value="">{t('select', 'Select')}</option>
            {(creator?.privacyOptions || []).map((option) => (
              <option
                key={option}
                value={option}
                disabled={brand_content_toggle && option === 'SELF_ONLY'}
              >
                {privacyLabels[option] || option}
                {brand_content_toggle && option === 'SELF_ONLY'
                  ? ` (${t(
                      'branded_content_not_private',
                      'branded content visibility cannot be set to private'
                    )})`
                  : ''}
              </option>
            ))}
          </Select>
          {creator && !creator.audited && (
            <div className="text-[13px] mt-[6px] opacity-70 text-balance">
              {t(
                'tiktok_unaudited_notice',
                'While this app is pending TikTok approval, TikTok limits posts to private (Only me) visibility.'
              )}
            </div>
          )}
          {brand_content_toggle &&
            (creator?.privacyOptions?.length || 0) > 0 &&
            creator!.privacyOptions.every((o) => o === 'SELF_ONLY') && (
              <div className="text-[13px] mt-[6px] text-[#FF9800] text-balance">
                {t(
                  'tiktok_branded_private_deadlock',
                  'Branded content cannot be posted privately, and "Only me" is the only visibility available for this account. Turn off "Branded content" to publish.'
                )}
              </div>
            )}

          {/* ---- auto add music: photos only ---- */}
          {isPhoto && (
            <div className="mt-[16px]">
              <Select
                label={t('label_auto_add_music', 'Auto add music')}
                {...register('autoAddMusic')}
              >
                <option value="no">{t('no', 'No')}</option>
                <option value="yes">{t('yes', 'Yes')}</option>
              </Select>
              <div className="text-[13px] mt-[6px] opacity-70 text-balance">
                {t(
                  'this_feature_available_only_for_photos',
                  'Adds a default track to your photo post, which you can change later in TikTok.'
                )}
              </div>
            </div>
          )}

          <hr className="my-[20px] border-tableBorder" />

          {/* ---- interactions ---- */}
          <div className="text-[14px] mb-[10px] font-[600]">
            {t('allow_user_to', 'Allow users to:')}
          </div>
          <div className="flex gap-[40px]">
            <Checkbox
              label={t('label_comments', 'Comments')}
              variant="hollow"
              disabled={!!creator?.commentDisabled}
              {...register('comment', { value: false })}
            />
            {!isPhoto && (
              <Checkbox
                variant="hollow"
                label={t('label_duet', 'Duet')}
                disabled={!!creator?.duetDisabled}
                {...register('duet', { value: false })}
              />
            )}
            {!isPhoto && (
              <Checkbox
                label={t('label_stitch', 'Stitch')}
                variant="hollow"
                disabled={!!creator?.stitchDisabled}
                {...register('stitch', { value: false })}
              />
            )}
          </div>
          {creator &&
            (creator.commentDisabled ||
              creator.duetDisabled ||
              creator.stitchDisabled) && (
              <div className="text-[13px] mt-[8px] opacity-70 text-balance">
                {t(
                  'tiktok_interactions_disabled',
                  'Some interactions are turned off in your TikTok account settings and cannot be enabled from here.'
                )}
              </div>
            )}

          <hr className="my-[20px] border-tableBorder" />

          {/* ---- AI + commercial disclosure ---- */}
          <div className="flex flex-col gap-[20px]">
            <Checkbox
              label={t('video_made_with_ai', 'Video made with AI')}
              variant="hollow"
              {...register('video_made_with_ai', { value: false })}
            />
            <Checkbox
              variant="hollow"
              label={t(
                'label_disclose_commercial_content',
                'Disclose commercial content'
              )}
              {...register('disclose', { value: false })}
            />
            <div className="text-[14px] text-balance opacity-70">
              {t(
                'turn_on_to_disclose_video_promotes',
                'Turn on to disclose that this video promotes goods or services in exchange for something of value. Your video could promote yourself, a third party, or both.'
              )}
            </div>

            {disclose && (brand_organic_toggle || brand_content_toggle) && (
              <div className="bg-tableBorder p-[10px] rounded-[10px] flex gap-[20px] items-center">
                <div>
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M22.201 17.6335L14.0026 3.39569C13.7977 3.04687 13.5052 2.75764 13.1541 2.55668C12.803 2.35572 12.4055 2.25 12.001 2.25C11.5965 2.25 11.199 2.35572 10.8479 2.55668C10.4968 2.75764 10.2043 3.04687 9.99944 3.39569L1.80101 17.6335C1.60388 17.9709 1.5 18.3546 1.5 18.7454C1.5 19.1361 1.60388 19.5199 1.80101 19.8572C2.00325 20.2082 2.29523 20.499 2.64697 20.6998C2.99871 20.9006 3.39755 21.0043 3.80257 21.0001H20.1994C20.6041 21.0039 21.0026 20.9001 21.354 20.6993C21.7054 20.4985 21.997 20.2079 22.1991 19.8572C22.3965 19.52 22.5007 19.1364 22.5011 18.7456C22.5014 18.3549 22.3978 17.9711 22.201 17.6335ZM11.251 9.75006C11.251 9.55115 11.33 9.36038 11.4707 9.21973C11.6113 9.07908 11.8021 9.00006 12.001 9.00006C12.1999 9.00006 12.3907 9.07908 12.5313 9.21973C12.672 9.36038 12.751 9.55115 12.751 9.75006V13.5001C12.751 13.699 12.672 13.8897 12.5313 14.0304C12.3907 14.171 12.1999 14.2501 12.001 14.2501C11.8021 14.2501 11.6113 14.171 11.4707 14.0304C11.33 13.8897 11.251 13.699 11.251 13.5001V9.75006ZM12.001 18.0001C11.7785 18.0001 11.561 17.9341 11.376 17.8105C11.191 17.6868 11.0468 17.5111 10.9616 17.3056C10.8765 17.1 10.8542 16.8738 10.8976 16.6556C10.941 16.4374 11.0482 16.2369 11.2055 16.0796C11.3628 15.9222 11.5633 15.8151 11.7815 15.7717C11.9998 15.7283 12.226 15.7505 12.4315 15.8357C12.6371 15.9208 12.8128 16.065 12.9364 16.25C13.06 16.4351 13.126 16.6526 13.126 16.8751C13.126 17.1734 13.0075 17.4596 12.7965 17.6706C12.5855 17.8815 12.2994 18.0001 12.001 18.0001Z"
                      fill="white"
                    />
                  </svg>
                </div>
                <div>
                  {brand_content_toggle
                    ? t(
                        'your_video_will_be_labeled_paid_partnership',
                        'Your video will be labeled "Paid partnership".'
                      )
                    : t(
                        'your_video_will_be_labeled_promotional',
                        'Your video will be labeled "Promotional content".'
                      )}
                  <br />
                  {t(
                    'this_cannot_be_changed_once_posted',
                    'This cannot be changed once your video is posted.'
                  )}
                </div>
              </div>
            )}

            {disclose && !brand_organic_toggle && !brand_content_toggle && (
              <div className="text-[14px] text-[#FF9800]">
                {t(
                  'you_need_to_indicate_content_type',
                  'You need to indicate if your content promotes yourself, a third party, or both.'
                )}
              </div>
            )}
          </div>

          <div
            className={clsx(
              !disclose && 'invisible h-0 overflow-hidden',
              'mt-[20px]'
            )}
          >
            <Checkbox
              variant="hollow"
              label={t('label_your_brand', 'Your brand')}
              {...register('brand_organic_toggle', { value: false })}
            />
            <div className="text-balance my-[10px] text-[14px] opacity-70">
              {t(
                'you_are_promoting_yourself',
                'You are promoting yourself or your own business.'
              )}
              {brand_organic_toggle && !brand_content_toggle && (
                <>
                  <br />
                  {t(
                    'your_video_labeled_promotional',
                    'Your video will be labeled as "Promotional content".'
                  )}
                </>
              )}
            </div>
            <Checkbox
              variant="hollow"
              label={t('label_branded_content', 'Branded content')}
              {...register('brand_content_toggle', { value: false })}
            />
            <div className="text-balance my-[10px] text-[14px] opacity-70">
              {t(
                'you_are_promoting_another_brand',
                'You are promoting another brand or a third party.'
              )}
              {brand_content_toggle && (
                <>
                  <br />
                  {t(
                    'your_video_labeled_paid_partnership',
                    'Your video will be labeled as "Paid partnership".'
                  )}
                </>
              )}
            </div>
          </div>

          <hr className="my-[15px] border-tableBorder" />
          <div className="my-[10px] text-[14px] text-balance">
            {t(
              'by_posting_you_agree_to_tiktoks',
              "By posting, you agree to TikTok's"
            )}{' '}
            {brand_content_toggle && (
              <>
                <a
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#B69DEC] hover:underline"
                  href="https://www.tiktok.com/legal/page/global/bc-policy/en"
                >
                  {t('branded_content_policy', 'Branded Content Policy')}
                </a>{' '}
                {t('and', 'and')}{' '}
              </>
            )}
            <a
              target="_blank"
              rel="noreferrer"
              className="text-[#B69DEC] hover:underline"
              href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en"
            >
              {t('music_usage_confirmation', 'Music Usage Confirmation')}
            </a>
            .
          </div>
        </>
      )}
    </div>
  );
};

export default withProvider({
  postComment: PostComment.COMMENT,
  minimumCharacters: [],
  SettingsComponent: TikTokSettings,
  comments: false,
  CustomPreviewComponent: TiktokPreview,
  dto: TikTokDto,
  checkValidity: async (items, settings) => {
    const s = settings as TikTokDto & { disclose?: boolean };
    const [firstItems] = items ?? [];

    if ((firstItems?.length ?? 0) === 0) {
      return 'No video / images selected';
    }

    const videoCount = (firstItems ?? []).filter((p) =>
      isTikTokVideoPath(p?.path)
    ).length;

    if (videoCount > 0 && (firstItems?.length ?? 0) > 1) {
      return 'Select exactly one video. Multiple items are only supported for a photo carousel.';
    }

    if (s.content_posting_method !== 'UPLOAD') {
      if (!s.privacy_level) {
        return 'Select who can see this video.';
      }
      if ((s.title?.length ?? 0) > TIKTOK_CAPTION_LIMIT) {
        return `TikTok caption is too long (${s.title.length}/${TIKTOK_CAPTION_LIMIT}).`;
      }
      if (s.disclose && !s.brand_organic_toggle && !s.brand_content_toggle) {
        return 'You need to indicate if your content promotes yourself, a third party, or both.';
      }
      if (
        s.disclose &&
        s.brand_content_toggle &&
        s.privacy_level === 'SELF_ONLY'
      ) {
        return 'Branded content visibility cannot be set to private.';
      }
    }

    return true;
  },
  maximumCharacters: TIKTOK_CAPTION_LIMIT,
});
