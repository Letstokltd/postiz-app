import { Injectable } from '@nestjs/common';
import { ioRedis } from '@gitroom/nestjs-libraries/redis/redis.service';
import { Provider, Role } from '@prisma/client';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { AuthService } from '@gitroom/helpers/auth/auth.service';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';

const CACHE_KEY_PREFIX = 'studio-tools-plan:';

export interface PlanDetails {
  socialChannels: number;
  postizTier: string;
  planName: string;
  /**
   * LetsTok "Start free" (2026-09-29): overrides the tier's posts_per_month
   * when set. New Free accounts get 0 — they can connect channels but posting
   * starts with a paid plan. null/undefined = use the tier's allowance.
   */
  postsPerMonth?: number | null;
}

@Injectable()
export class PlanSyncService {
  constructor(private _prisma: PrismaService) {}

  /**
   * Get effective channel limit for an org. Uses Studio Tools for Firebase users, fallback for legacy.
   */
  async getEffectiveChannelLimit(
    orgId: string,
    fallbackTotalChannels: number
  ): Promise<number> {
    const planDetails = await this.getPlanDetailsForOrg(orgId);
    return planDetails?.socialChannels ?? fallbackTotalChannels;
  }

  /**
   * Get plan details for an organization. For Firebase SSO users, fetches from Studio Tools API.
   * For legacy users, returns null (caller should use Postiz subscription).
   */
  async getPlanDetailsForOrg(orgId: string): Promise<PlanDetails | null> {
    const firebaseUid = await this.getFirebaseUidForOrg(orgId);
    if (!firebaseUid) {
      return null;
    }
    return this.getPlanDetails(firebaseUid);
  }

  /**
   * Get Firebase UID for the first Firebase-authenticated user in the org.
   */
  private async getFirebaseUidForOrg(orgId: string): Promise<string | null> {
    const org = await this._prisma.organization.findFirst({
      where: { id: orgId },
      include: {
        users: {
          where: { disabled: false },
          include: { user: { select: { providerName: true, providerId: true } } },
        },
      },
    });
    if (!org) return null;
    const firebaseUser = org.users.find(
      (uo) => uo.user.providerName === Provider.FIREBASE && uo.user.providerId
    );
    return firebaseUser?.user.providerId ?? null;
  }

  /**
   * Get plan details from Studio Tools API (always fetches fresh).
   */
  async getPlanDetails(firebaseUid: string): Promise<PlanDetails | null> {
    const apiUrl = process.env.STUDIO_TOOLS_API_URL;
    const apiKey = process.env.INTERNAL_API_KEY;
    if (!apiUrl || !apiKey) {
      return null;
    }

    try {
      const url = `${apiUrl.replace(/\/$/, '')}/api/internal/plan-details?firebaseUid=${encodeURIComponent(firebaseUid)}`;
      const res = await fetch(url, {
        headers: {
          'X-Internal-Api-Key': apiKey,
        },
      });
      if (!res.ok) {
        return null;
      }
      const data = (await res.json()) as {
        socialChannels?: number;
        postizTier?: string;
        planName?: string;
        postsPerMonth?: number | null;
      };
      return {
        socialChannels: data.socialChannels ?? 0,
        postizTier: data.postizTier ?? 'FREE',
        planName: data.planName ?? 'Free',
        postsPerMonth:
          typeof data.postsPerMonth === 'number' ? data.postsPerMonth : null,
      };
    } catch {
      return null;
    }
  }

  async invalidateCache(firebaseUid: string): Promise<void> {
    const cacheKey = `${CACHE_KEY_PREFIX}${firebaseUid}`;
    await ioRedis.del(cacheKey);
  }

  async getOrgIdByFirebaseUid(firebaseUid: string): Promise<string | null> {
    const user = await this._prisma.user.findFirst({
      where: {
        providerName: Provider.FIREBASE,
        providerId: firebaseUid,
      },
      include: {
        organizations: {
          where: { disabled: false },
          select: { organizationId: true, role: true, createdAt: true },
        },
      },
    });
    if (!user?.organizations?.length) return null;

    // Prefer the user's OWN org (SUPERADMIN = org creator) over orgs they were
    // added to as a delegated manager (role ADMIN). Without this, a manager's
    // firebaseUid could resolve to a client's org and cross-post content.
    const rank = (r: Role) =>
      r === Role.SUPERADMIN ? 0 : r === Role.ADMIN ? 1 : 2;
    const sorted = [...user.organizations].sort(
      (a, b) =>
        rank(a.role) - rank(b.role) ||
        a.createdAt.getTime() - b.createdAt.getTime()
    );
    return sorted[0].organizationId;
  }

  /**
   * Server-side workspace provisioning for LetsTok managed-service customers
   * (LetsTok_Service_Customer_Onboarding_Plan.md, A.1). Customers we manage
   * never open LetsTok Social, so their org would otherwise only be created
   * on a first Firebase SSO visit. Idempotent.
   *
   * The user is keyed exactly like AuthService.firebaseSso()
   * (providerName FIREBASE + providerId = Firebase uid), so a later SSO by the
   * same person finds this user and lands in this org.
   */
  async provisionFirebaseOrg(input: {
    firebaseUid: string;
    email: string;
    name?: string;
    company?: string;
  }): Promise<{ orgId: string; created: boolean; userCreated: boolean }> {
    const firebaseUid = input.firebaseUid.trim();
    const email = input.email.trim().toLowerCase();
    const orgName =
      (input.company || '').trim() ||
      (input.name || '').trim() ||
      email.split('@')[0];

    let user = await this._prisma.user.findFirst({
      where: { providerName: Provider.FIREBASE, providerId: firebaseUid },
      include: {
        organizations: {
          select: { organizationId: true, role: true, disabled: true },
        },
      },
    });

    // A FIREBASE user row for this email without a uid (legacy rows): adopt
    // it rather than hitting the (email, providerName) unique constraint.
    if (!user) {
      const byEmail = await this._prisma.user.findFirst({
        where: {
          providerName: Provider.FIREBASE,
          email: { equals: email, mode: 'insensitive' },
        },
        include: {
          organizations: {
            select: { organizationId: true, role: true, disabled: true },
          },
        },
      });
      if (byEmail) {
        if (byEmail.providerId && byEmail.providerId !== firebaseUid) {
          throw new Error(
            `A LetsTok Social user for ${email} is linked to a different Firebase uid`
          );
        }
        user = await this._prisma.user.update({
          where: { id: byEmail.id },
          data: { providerId: firebaseUid, activated: true },
          include: {
            organizations: {
              select: { organizationId: true, role: true, disabled: true },
            },
          },
        });
      }
    }

    if (user) {
      // Only the user's OWN org counts (SUPERADMIN); orgs they were added to
      // as a delegated manager (ADMIN) belong to someone else.
      const own = user.organizations.find(
        (o) => o.role === Role.SUPERADMIN && !o.disabled
      );
      if (own) {
        return { orgId: own.organizationId, created: false, userCreated: false };
      }
      const org = await this._prisma.organization.create({
        data: {
          name: orgName,
          apiKey: AuthService.fixedEncryption(makeId(20)),
          allowTrial: true,
          isTrailing: true,
          users: { create: { role: Role.SUPERADMIN, userId: user.id } },
        },
        select: { id: true },
      });
      await this.invalidateCache(firebaseUid);
      return { orgId: org.id, created: true, userCreated: false };
    }

    // Same shape as OrganizationRepository.createOrgAndUser() for a Firebase
    // SSO sign-up (activated, no password, no confirmation email).
    const org = await this._prisma.organization.create({
      data: {
        name: orgName,
        apiKey: AuthService.fixedEncryption(makeId(20)),
        allowTrial: true,
        isTrailing: true,
        users: {
          create: {
            role: Role.SUPERADMIN,
            user: {
              create: {
                activated: true,
                email,
                password: '',
                providerName: Provider.FIREBASE,
                providerId: firebaseUid,
                timezone: 0,
                ip: '0.0.0.0',
                agent: 'LetsTok internal provision',
              },
            },
          },
        },
      },
      select: { id: true },
    });
    await this.invalidateCache(firebaseUid);
    return { orgId: org.id, created: true, userCreated: true };
  }

  // ------------------------------------------------------------------
  // Delegated access ("Marketing Manager") — org membership sync.
  // Called by LetsTok Studio (server-v1) via /api/internal/delegations/*.
  // ------------------------------------------------------------------

  /**
   * Add the manager's Postiz user to the client's org as ADMIN so they can
   * manage channels and post from the Postiz UI (and via the org switcher).
   * Idempotent. Returns flags so the caller can log/retry.
   */
  async upsertDelegationMembership(
    managerFirebaseUid: string,
    clientFirebaseUid: string
  ): Promise<{
    success: boolean;
    managerNotProvisioned?: boolean;
    clientNotProvisioned?: boolean;
    message?: string;
  }> {
    if (
      !managerFirebaseUid ||
      !clientFirebaseUid ||
      managerFirebaseUid === clientFirebaseUid
    ) {
      return { success: false, message: 'Invalid uids' };
    }

    const manager = await this._prisma.user.findFirst({
      where: { providerName: Provider.FIREBASE, providerId: managerFirebaseUid },
    });
    if (!manager) {
      // The manager gets a Postiz user on their first visit to LetsTok Social
      // (auth/firebase-sso). The caller retries the sync lazily on
      // switch_account, so this heals itself once they open Social.
      return {
        success: false,
        managerNotProvisioned: true,
        message:
          'Manager has no LetsTok Social user yet (they need to open Social once)',
      };
    }

    const clientOrgId = await this.getOrgIdByFirebaseUid(clientFirebaseUid);
    if (!clientOrgId) {
      return {
        success: false,
        clientNotProvisioned: true,
        message:
          'Client has no LetsTok Social organization yet (they need to open Social once)',
      };
    }

    await this._prisma.userOrganization.upsert({
      where: {
        userId_organizationId: {
          userId: manager.id,
          organizationId: clientOrgId,
        },
      },
      update: { role: Role.ADMIN, disabled: false },
      create: {
        userId: manager.id,
        organizationId: clientOrgId,
        role: Role.ADMIN,
        disabled: false,
      },
    });
    return { success: true };
  }

  /** Remove the manager from the client's org (delegation revoked). */
  async removeDelegationMembership(
    managerFirebaseUid: string,
    clientFirebaseUid: string
  ): Promise<{ success: boolean; message?: string }> {
    const manager = await this._prisma.user.findFirst({
      where: { providerName: Provider.FIREBASE, providerId: managerFirebaseUid },
    });
    if (!manager) return { success: true, message: 'Manager not provisioned' };

    const clientOrgId = await this.getOrgIdByFirebaseUid(clientFirebaseUid);
    if (!clientOrgId) {
      return { success: true, message: 'Client org not found' };
    }

    // Safety: never touch a SUPERADMIN membership (that would be the org owner).
    await this._prisma.userOrganization.deleteMany({
      where: {
        userId: manager.id,
        organizationId: clientOrgId,
        role: { not: Role.SUPERADMIN },
      },
    });
    return { success: true };
  }
}
