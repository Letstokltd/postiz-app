'use client';

import { FC } from 'react';
import useSWR from 'swr';
import clsx from 'clsx';
import { useIntegration } from '@gitroom/frontend/components/launches/helpers/use.integration';
import { useSettings } from '@gitroom/frontend/components/launches/helpers/use.values';
import { useCustomProviderFunction } from '@gitroom/frontend/components/launches/helpers/use.custom.provider.function';
import { useMediaDirectory } from '@gitroom/react/helpers/use.media.directory';
import { stripHtmlValidation } from '@gitroom/helpers/utils/strip.html.validation';
import { SliderComponent } from '@gitroom/frontend/components/third-parties/slider.component';
import { VideoOrImage } from '@gitroom/react/helpers/video.or.image';

/**
 * The preview must show the EXACT value that will be sent to TikTok as
 * post_info.title, attributed to the real connected creator. Never render a
 * verification badge or invented engagement metrics here — TikTok reviews this
 * screen against their content sharing guidelines.
 */
export const TiktokPreview: FC<{
  maximumCharacters?: number;
}> = (props) => {
  const { value: topValue, integration } = useIntegration();
  const { watch } = useSettings();
  const customFunction = useCustomProviderFunction();
  const mediaDir = useMediaDirectory();

  const { data: rawCreator } = useSWR(
    integration?.id ? ['tiktok-creator-info', integration.id] : null,
    () => customFunction.get('creatorInfo'),
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );

  const creator =
    rawCreator && typeof rawCreator === 'object' ? (rawCreator as any) : null;

  const nickname = creator?.nickname || integration?.name || '';
  const username = creator?.username || integration?.display || '';

  const postingMethod = watch('content_posting_method');
  const isUploadMode = postingMethod === 'UPLOAD';

  // What actually goes on the wire.
  const caption =
    watch('title') ||
    stripHtmlValidation('normal', topValue?.[0]?.content || '', true) ||
    '';

  const limit = props.maximumCharacters || 2200;
  const visible = caption.slice(0, limit);
  const overflow = caption.slice(limit);

  const images = topValue?.[0]?.image || [];

  return (
    <div className="flex flex-col">
      <div className="px-[15px] pt-[12px] text-[13px] flex items-center gap-[8px]">
        <img
          src={creator?.avatar || integration?.picture || '/no-picture.jpg'}
          alt={nickname}
          className="w-[24px] h-[24px] rounded-full object-cover"
        />
        <div className="flex-1">
          {isUploadMode ? (
            <>
              {'Will be sent to the TikTok inbox of '}
              <span className="font-[600]">{nickname}</span>
              {username ? ` (@${username})` : ''}
            </>
          ) : (
            <>
              {'Will be posted to '}
              <span className="font-[600]">{nickname}</span>
              {username ? ` (@${username})` : ''}
            </>
          )}
        </div>
      </div>

      <div className="p-[15px] h-[500px] flex justify-center bg-newBgColorInner">
        <div className="relative">
          <SliderComponent
            list={images.map((image: any, index: number) => (
              <a
                key={`image_${index}`}
                className="flex-1"
                href={mediaDir.set(image.path)}
                target="_blank"
                rel="noreferrer"
              >
                <VideoOrImage autoplay={true} src={mediaDir.set(image.path)} />
              </a>
            ))}
            className="h-full bg-black aspect-[calc(9/16)] rounded-[3px] overflow-hidden"
          />
          {!isUploadMode && (
            <div className="absolute pointer-events-none w-full h-full start-0 top-0 px-[12px] py-[25px] justify-end items-start text-white flex flex-col gap-[4px]">
              <div className="text-[14px] font-[600]">
                {username ? `@${username}` : nickname}
              </div>
              <div className="text-[13px] font-[400] whitespace-pre-line line-clamp-6 w-full">
                {visible}
                {!!overflow && (
                  <mark
                    className="bg-red-500"
                    data-tooltip-id="tooltip"
                    data-tooltip-content="This text will be cropped"
                  >
                    {overflow}
                  </mark>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div
        className={clsx(
          'px-[15px] pb-[12px] text-[12px] opacity-70 text-balance'
        )}
      >
        {isUploadMode
          ? 'Caption, privacy and interaction settings are chosen in the TikTok app after the video arrives in your inbox.'
          : 'This is the exact caption that will be submitted to TikTok.'}
      </div>
    </div>
  );
};
