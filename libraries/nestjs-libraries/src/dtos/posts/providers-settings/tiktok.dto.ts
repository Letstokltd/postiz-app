import {
  IsBoolean,
  ValidateIf,
  IsIn,
  IsString,
  MaxLength,
  IsOptional,
  IsNotEmpty,
} from 'class-validator';

export class TikTokDto {
  /**
   * The TikTok caption. This is the EXACT value sent as post_info.title for a
   * video Direct Post. TikTok's limit is 2200 UTF-16 units for video captions
   * (90 is the PHOTO title limit and is enforced separately on the photo path).
   */
  @ValidateIf((p) => p.content_posting_method !== 'UPLOAD')
  @IsOptional()
  @MaxLength(2200)
  title: string;

  /**
   * Required for Direct Post — TikTok mandates a manual selection with no
   * default. Not accepted at all by the inbox-upload endpoint.
   */
  @ValidateIf((p) => p.content_posting_method !== 'UPLOAD')
  @IsNotEmpty({ message: 'Select who can see this video.' })
  @IsIn([
    'PUBLIC_TO_EVERYONE',
    'MUTUAL_FOLLOW_FRIENDS',
    'FOLLOWER_OF_CREATOR',
    'SELF_ONLY',
  ])
  @IsString()
  privacy_level?:
    | 'PUBLIC_TO_EVERYONE'
    | 'MUTUAL_FOLLOW_FRIENDS'
    | 'FOLLOWER_OF_CREATOR'
    | 'SELF_ONLY';

  @IsOptional()
  @IsBoolean()
  duet: boolean;

  @IsOptional()
  @IsBoolean()
  stitch: boolean;

  @IsOptional()
  @IsBoolean()
  comment: boolean;

  @IsOptional()
  @IsIn(['yes', 'no'])
  autoAddMusic: 'yes' | 'no';

  @IsOptional()
  @IsBoolean()
  brand_content_toggle: boolean;

  @IsOptional()
  @IsBoolean()
  video_made_with_ai: boolean;

  @IsOptional()
  @IsBoolean()
  brand_organic_toggle: boolean;

  /** UI-only toggle that gates the two brand_* options. Declared so it is not
   *  silently stripped by validation. */
  @IsOptional()
  @IsBoolean()
  disclose: boolean;

  @IsIn(['DIRECT_POST', 'UPLOAD'])
  @IsString()
  content_posting_method: 'DIRECT_POST' | 'UPLOAD';
}
