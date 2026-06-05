import {
  Controller,
  Post,
  Body,
  UnauthorizedException,
  Headers,
  Logger,
} from '@nestjs/common';
import { PlanSyncService } from '@gitroom/nestjs-libraries/services/plan-sync.service';
import { IntegrationService } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service';
import { IntegrationRepository } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.repository';
import { NotificationService } from '@gitroom/nestjs-libraries/database/prisma/notifications/notification.service';
import { PostsService } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.service';
import { MediaService } from '@gitroom/nestjs-libraries/database/prisma/media/media.service';

/** Random id for post/value/image blocks (mirrors the frontend publish client). */
function makeId(len: number): string {
  const chars =
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let out = '';
  for (let i = 0; i < len; i++)
    out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Plain caption (lines) → Post-valid HTML (mirrors studio captionToPostHtml). */
function captionToPostHtml(text: string): string {
  const raw = (text || '').trim();
  if (!raw) return '<p>.</p>';
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  return lines.map((l) => `<p>${escapeHtml(l.trim())}</p>`).join('');
}

interface InternalPublishChannel {
  integrationId: string;
  /** Provider-specific settings already built by the caller (LetsTok side). */
  settings?: Record<string, unknown>;
}

interface InternalPublishBody {
  firebaseUid: string;
  mediaUrl: string;
  caption?: string;
  contentHtml?: string;
  type?: 'now' | 'schedule' | 'draft';
  date?: string;
  shortLink?: boolean;
  channels: InternalPublishChannel[];
}

@Controller('/api/internal')
export class InternalController {
  private readonly logger = new Logger(InternalController.name);

  constructor(
    private _planSyncService: PlanSyncService,
    private _integrationRepository: IntegrationRepository,
    private _integrationService: IntegrationService,
    private _notificationService: NotificationService,
    private _postsService: PostsService,
    private _mediaService: MediaService,
  ) {}

  private assertInternalKey(apiKey: string): void {
    const expectedKey = process.env.INTERNAL_API_KEY;
    if (!expectedKey || !apiKey || apiKey !== expectedKey) {
      throw new UnauthorizedException('Invalid or missing internal API key');
    }
  }

  @Post('/invalidate-plan-cache')
  async invalidatePlanCache(
    @Headers('x-internal-api-key') apiKey: string,
    @Body() body: { firebaseUid: string }
  ) {
    const expectedKey = process.env.INTERNAL_API_KEY;
    if (!expectedKey || !apiKey || apiKey !== expectedKey) {
      throw new UnauthorizedException('Invalid or missing internal API key');
    }

    if (!body.firebaseUid) {
      return { success: false, message: 'firebaseUid is required' };
    }

    await this._planSyncService.invalidateCache(body.firebaseUid);
    this.logger.log(
      `Plan cache invalidated for firebaseUid: ${body.firebaseUid}`
    );
    return { success: true };
  }

  @Post('/enforce-channel-limit')
  async enforceChannelLimit(
    @Headers('x-internal-api-key') apiKey: string,
    @Body() body: { firebaseUid: string; maxChannels: number }
  ) {
    const expectedKey = process.env.INTERNAL_API_KEY;
    if (!expectedKey || !apiKey || apiKey !== expectedKey) {
      throw new UnauthorizedException('Invalid or missing internal API key');
    }

    if (!body.firebaseUid || body.maxChannels === undefined) {
      return {
        success: false,
        message: 'firebaseUid and maxChannels are required',
      };
    }

    const orgId = await this._planSyncService.getOrgIdByFirebaseUid(
      body.firebaseUid
    );
    if (!orgId) {
      this.logger.warn(
        `No org found for firebaseUid: ${body.firebaseUid}`
      );
      return { success: true, disabled: 0, message: 'No org found' };
    }

    const activeChannels =
      await this._integrationRepository.getIntegrationsList(orgId);
    const activeCount = activeChannels.filter((c) => !c.disabled).length;
    const excess = activeCount - body.maxChannels;

    if (excess <= 0) {
      return { success: true, disabled: 0 };
    }

    const disabledCount = await this._integrationRepository.disableIntegrations(
      orgId,
      excess
    );

    if (body.maxChannels <= 2) {
      try {
        await this._integrationService.changeActiveCron(orgId);
      } catch (err: any) {
        this.logger.warn(`Failed to terminate autopost workflows: ${err?.message}`);
      }
    }

    await this._notificationService.inAppNotification(
      orgId,
      'Channels disabled',
      `Your plan was downgraded. ${disabledCount} channel(s) were disabled due to your plan limit of ${body.maxChannels} channels. You can choose which channels to keep active in your settings.`
    );

    this.logger.log(
      `Disabled ${disabledCount} channels for org ${orgId} (firebaseUid: ${body.firebaseUid}, max: ${body.maxChannels})`
    );

    return { success: true, disabled: disabledCount };
  }

  /**
   * List a user's connected (non-disabled) channels, for the WhatsApp publish
   * picker. Resolves the org from the Firebase UID.
   */
  @Post('/integrations')
  async listIntegrations(
    @Headers('x-internal-api-key') apiKey: string,
    @Body() body: { firebaseUid: string }
  ) {
    this.assertInternalKey(apiKey);

    if (!body.firebaseUid) {
      return { success: false, message: 'firebaseUid is required' };
    }

    const orgId = await this._planSyncService.getOrgIdByFirebaseUid(
      body.firebaseUid
    );
    if (!orgId) {
      return { success: false, message: 'No organization found' };
    }

    const list = await this._integrationRepository.getIntegrationsList(orgId);
    const integrations = list
      .filter((i) => !i.disabled && !i.deletedAt)
      .map((i) => ({
        id: i.id,
        name: i.name,
        identifier: i.providerIdentifier,
        picture: i.picture,
      }));

    return { success: true, integrations };
  }

  /**
   * Publish a single media post to one or more of the user's channels on their
   * behalf. `settings` per channel are built by the caller (LetsTok side);
   * `mapTypeToPost` injects `__type` and validates against the provider DTOs.
   *
   * NOTE: bypasses the @CheckPolicies([Create, POSTS_PER_MONTH]) guard that the
   * normal POST /posts route applies (accepted, see plan decision #1).
   */
  @Post('/publish')
  async publish(
    @Headers('x-internal-api-key') apiKey: string,
    @Body() body: InternalPublishBody
  ) {
    this.assertInternalKey(apiKey);

    if (!body.firebaseUid) {
      return { success: false, message: 'firebaseUid is required' };
    }
    if (!body.mediaUrl) {
      return { success: false, message: 'mediaUrl is required' };
    }
    if (!body.channels?.length) {
      return { success: false, message: 'At least one channel is required' };
    }

    const orgId = await this._planSyncService.getOrgIdByFirebaseUid(
      body.firebaseUid
    );
    if (!orgId) {
      return { success: false, message: 'No organization found' };
    }

    // Validate that every requested channel belongs to this org and is active.
    const orgIntegrations =
      await this._integrationRepository.getIntegrationsList(orgId);
    const allowedIds = new Set(
      orgIntegrations.filter((i) => !i.disabled && !i.deletedAt).map((i) => i.id)
    );
    const invalid = body.channels.filter(
      (c) => !c.integrationId || !allowedIds.has(c.integrationId)
    );
    if (invalid.length) {
      return {
        success: false,
        message: `Unknown or inactive channel(s): ${invalid
          .map((c) => c.integrationId)
          .join(', ')}`,
      };
    }

    // Import the media into the org's library.
    let media: { id: string; path: string };
    try {
      media = (await this._mediaService.importFromUrl(
        orgId,
        body.mediaUrl
      )) as { id: string; path: string };
    } catch (err: any) {
      this.logger.error(
        `Internal publish media import failed for ${body.firebaseUid}: ${err?.message}`
      );
      return {
        success: false,
        message: `Media import failed: ${err?.message ?? 'unknown error'}`,
      };
    }

    const type = body.type ?? 'now';
    const date = body.date ?? new Date().toISOString();
    const contentHtml =
      body.contentHtml ?? captionToPostHtml(body.caption ?? '');

    const postBody = {
      type,
      date,
      shortLink: body.shortLink ?? false,
      tags: [] as { value: string; label: string }[],
      posts: body.channels.map((c) => ({
        integration: { id: c.integrationId },
        settings: c.settings ?? {},
        value: [
          {
            content: contentHtml,
            id: makeId(10),
            delay: 0,
            image: [{ id: makeId(10), path: media.path }],
          },
        ],
      })),
    };

    try {
      const mapped = await this._postsService.mapTypeToPost(
        postBody as any,
        orgId
      );
      const result = await this._postsService.createPost(orgId, mapped);
      this.logger.log(
        `Internal publish created ${result.length} post(s) for org ${orgId} (firebaseUid: ${body.firebaseUid})`
      );
      return { success: true, posts: result };
    } catch (err: any) {
      this.logger.error(
        `Internal publish failed for ${body.firebaseUid}: ${err?.message}`
      );
      return {
        success: false,
        message: err?.response?.message ?? err?.message ?? 'Publish failed',
      };
    }
  }
}
