import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { randomBytes } from 'crypto';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { GetUserFromRequest } from '@gitroom/nestjs-libraries/user/user.from.request';
import { Organization, User } from '@prisma/client';

/**
 * Cross-app deep-link contract used by studio-tools' "Open in LetsPost"
 * flow. Studio-tools mints a one-time token while authenticated; the
 * LetsPost composer redeems it after SSO to prefill the launch form.
 *
 * The token TTL is short (5 min) so even if the token leaks, the blast
 * radius is the next compose action only. A shared HMAC secret is used
 * by studio-tools when calling /mint to prove provenance.
 */
const TOKEN_TTL_MS = 5 * 60 * 1000;

interface ComposePrefillPayload {
  assetUrl: string;
  captions: string[];
  channelIds: string[];
  scheduledAt: string | null;
  bestTimeHints: string[];
}

interface StoredEntry {
  payload: ComposePrefillPayload;
  orgId: string;
  userId: string;
  expiresAt: number;
}

/**
 * In-process store. Postiz deploys typically run a small number of
 * Nest pods behind a sticky session, so an in-memory map is acceptable
 * for the 5-minute TTL window. If the deployment is later scaled out
 * horizontally, swap this for the existing Redis client.
 */
const composePrefillStore = new Map<string, StoredEntry>();

const sweepExpired = () => {
  const now = Date.now();
  for (const [key, entry] of composePrefillStore.entries()) {
    if (entry.expiresAt < now) composePrefillStore.delete(key);
  }
};

@ApiTags('Letstok')
@Controller('/letstok')
export class LetstokComposeController {
  /**
   * Studio-tools calls this after the user finishes their guided ad.
   * The request is gated by the LetsPost SSO cookie (so we know which
   * org + user the prefill belongs to) plus the shared interop secret.
   */
  @Post('/compose-prefill/mint')
  async mintComposePrefill(
    @GetOrgFromRequest() org: Organization,
    @GetUserFromRequest() user: User,
    @Body() payload: ComposePrefillPayload,
    @Headers('x-letstok-interop') interopSecret?: string
  ) {
    const expected = process.env.LETSTOK_INTEROP_SECRET;
    if (expected && interopSecret !== expected) {
      throw new UnauthorizedException('Interop secret mismatch');
    }
    if (!payload?.assetUrl) {
      throw new BadRequestException('assetUrl is required');
    }
    sweepExpired();

    const token = randomBytes(24).toString('base64url');
    composePrefillStore.set(token, {
      payload,
      orgId: org.id,
      userId: user.id,
      expiresAt: Date.now() + TOKEN_TTL_MS,
    });
    return {
      token,
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS).toISOString(),
    };
  }

  /**
   * Called by the LetsPost composer on mount when `?fromLetstok=<token>`
   * is present. Returns the prefill payload to seed the form. Tokens
   * are single-use to prevent replay.
   */
  @Post('/compose-prefill/redeem')
  async redeemComposePrefill(
    @GetOrgFromRequest() org: Organization,
    @Body('token') token: string
  ) {
    if (!token) throw new BadRequestException('token is required');
    sweepExpired();
    const entry = composePrefillStore.get(token);
    if (!entry || entry.expiresAt < Date.now()) {
      throw new BadRequestException('Token expired or unknown');
    }
    if (entry.orgId !== org.id) {
      throw new UnauthorizedException('Token does not belong to this org');
    }
    composePrefillStore.delete(token);
    return { payload: entry.payload };
  }
}
