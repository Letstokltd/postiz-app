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

@Controller('/api/internal')
export class InternalController {
  private readonly logger = new Logger(InternalController.name);

  constructor(
    private _planSyncService: PlanSyncService,
    private _integrationRepository: IntegrationRepository,
    private _integrationService: IntegrationService,
    private _notificationService: NotificationService,
  ) {}

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
}
