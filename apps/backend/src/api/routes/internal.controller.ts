import {
  Controller,
  Post,
  Body,
  UnauthorizedException,
  Headers,
  Logger,
} from '@nestjs/common';
import { PlanSyncService } from '@gitroom/nestjs-libraries/services/plan-sync.service';

@Controller('/api/internal')
export class InternalController {
  private readonly logger = new Logger(InternalController.name);

  constructor(private _planSyncService: PlanSyncService) {}

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
}
