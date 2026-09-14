import { TikTokDto } from '@gitroom/nestjs-libraries/dtos/posts/providers-settings/tiktok.dto';

/**
 * TikTok permits UNAUDITED clients to use Direct Post, restricted to private
 * accounts with SELF_ONLY visibility. Direct Post therefore must NOT be gated
 * behind app approval — the approval will never arrive until a reviewer sees
 * Direct Post working.
 *
 * TIKTOK_AUDITED only controls an informational note in the UI. It never
 * changes which endpoint is called.
 */
export const TIKTOK_AUDITED = process.env.TIKTOK_AUDITED === 'true';

/** Keys that only exist on the Direct Post route. The inbox-upload endpoint
 *  accepts none of them, so they must never be persisted or transmitted with
 *  an UPLOAD post. */
const DIRECT_POST_ONLY_KEYS = [
  'privacy_level',
  'duet',
  'stitch',
  'comment',
  'video_made_with_ai',
  'brand_content_toggle',
  'brand_organic_toggle',
  'disclose',
  'title',
] as const;

export const TIKTOK_SAFE_DEFAULTS: Pick<
  TikTokDto,
  | 'content_posting_method'
  | 'duet'
  | 'stitch'
  | 'comment'
  | 'autoAddMusic'
  | 'brand_content_toggle'
  | 'brand_organic_toggle'
> = {
  content_posting_method: 'DIRECT_POST',
  // NOTE: privacy_level is deliberately absent. TikTok requires the user to
  // pick visibility manually with no pre-selected value; a default here would
  // itself be a UX violation. Validation catches the empty case.
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
  } as Partial<TikTokDto> & T & Record<string, unknown>;

  if (merged.content_posting_method !== 'UPLOAD') {
    merged.content_posting_method = 'DIRECT_POST';
  }

  // Idempotent: this function runs twice (save time and publish time).
  if (merged.content_posting_method === 'UPLOAD') {
    for (const key of DIRECT_POST_ONLY_KEYS) {
      delete merged[key];
    }
  }

  return merged as Partial<TikTokDto> & T;
}
