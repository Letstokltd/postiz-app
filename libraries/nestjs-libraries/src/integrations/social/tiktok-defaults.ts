import { TikTokDto } from '@gitroom/nestjs-libraries/dtos/posts/providers-settings/tiktok.dto';

/** Until TikTok approves direct posting, always inbox-upload (draft) mode. */
export const TIKTOK_DIRECT_POST_ENABLED =
  process.env.TIKTOK_DIRECT_POST_ENABLED === 'true';

export const TIKTOK_SAFE_DEFAULTS: Pick<
  TikTokDto,
  | 'content_posting_method'
  | 'privacy_level'
  | 'duet'
  | 'stitch'
  | 'comment'
  | 'autoAddMusic'
  | 'brand_content_toggle'
  | 'brand_organic_toggle'
> = {
  content_posting_method: 'UPLOAD',
  privacy_level: 'SELF_ONLY',
  duet: false,
  stitch: false,
  comment: false,
  autoAddMusic: 'no',
  brand_content_toggle: false,
  brand_organic_toggle: false,
};

export function normalizeTikTokSettings<
  T extends Partial<TikTokDto> & Record<string, unknown>,
>(settings: T): Partial<TikTokDto> & T {
  const merged = {
    ...TIKTOK_SAFE_DEFAULTS,
    ...settings,
  };

  if (!TIKTOK_DIRECT_POST_ENABLED) {
    merged.content_posting_method = 'UPLOAD';
  } else if (!merged.content_posting_method) {
    merged.content_posting_method = 'UPLOAD';
  }

  if (
    merged.content_posting_method === 'DIRECT_POST' &&
    !merged.privacy_level
  ) {
    merged.privacy_level = 'SELF_ONLY';
  }

  return merged as Partial<TikTokDto> & T;
}
