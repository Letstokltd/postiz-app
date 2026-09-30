import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import { AuthorizationActions, Sections, SubscriptionException } from '@gitroom/backend/services/auth/permissions/permission.exception.class';

@Catch(SubscriptionException)
export class SubscriptionExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const status = exception.getStatus();
    const error: { section: Sections; action: AuthorizationActions } =
      exception.getResponse() as any;

    const message = getErrorMessage(error);

    // LetsTok "Start free": posting upsells point at the LetsTok $1 / 3-day
    // Starter trial (LETSTOK_UPGRADE_URL) instead of Postiz billing.
    const url =
      error?.section === Sections.POSTS_PER_MONTH && process.env.LETSTOK_UPGRADE_URL
        ? process.env.LETSTOK_UPGRADE_URL
        : process.env.FRONTEND_URL + '/billing';
    response.status(status).json({
      statusCode: status,
      message,
      url,
    });
  }
}

const getErrorMessage = (error: {
  section: Sections;
  action: AuthorizationActions;
}) => {
  switch (error.section) {
    case Sections.POSTS_PER_MONTH:
      switch (error.action) {
        default:
          return 'Posting is not included in your current plan, or you have reached its monthly limit. Upgrade your LetsTok plan (Starter is 3 days for $1) to post and schedule.';
      }
    case Sections.CHANNEL:
      switch (error.action) {
        default:
          return 'You have reached the maximum number of channels for your subscription. Please upgrade your subscription to add more channels.';
      }
    case Sections.WEBHOOKS:
      switch (error.action) {
        default:
          return 'You have reached the maximum number of webhooks for your subscription. Please upgrade your subscription to add more webhooks.';
      }
    case Sections.VIDEOS_PER_MONTH:
      switch (error.action) {
        default:
          return 'You have reached the maximum number of generated videos for your subscription. Please upgrade your subscription to generate more videos.';
      }
  }
};
