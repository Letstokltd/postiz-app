import { IsOptional, ValidateIf, IsUrl, IsIn } from 'class-validator';

export class FacebookDto {
  @IsOptional()
  @ValidateIf((p) => p.url)
  @IsUrl()
  url?: string;

  // 'post' = feed post / Reel (default); 'story' = Facebook Page Story.
  @IsOptional()
  @IsIn(['post', 'story'])
  post_type?: 'post' | 'story';
}
