import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { getDiscoverPathForType, getProfilePathForType } from '@/lib/account-routing';
import { recordAuditEvent } from '@/lib/audit';
import { db } from '@/lib/db';
import {
  generateUniqueProfileHexId,
  getProfileCopy,
  getProfileType,
  getVerificationStatusForType,
} from '@/lib/profile-creation';
import { profileAccentToneIds, profileBackdropToneIds, profileDesignPresetIds } from '@/lib/profile-design';
import { consumeRateLimit } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';
import { verifyTurnstileToken } from '@/lib/turnstile';
import { isInviteCodeRequiredRuntime, isReservedPlatformEmail, isValidInviteCode } from '@/lib/runtime-flags';
import { getUsernameValidationMessage, isValidUsername, normalizeUsername } from '@/lib/usernames';
import { generateUniqueNonwordSlug } from '@/lib/nonword-slug';
import { log } from '@/lib/logger';
import { runRegistrationPostProcessing } from '@/lib/registration-post-processing';
import {
  createPasskeyBootstrapCapability,
  getPasskeyBootstrapCookieName,
  getPasskeyBootstrapCookieOptions,
} from '@/lib/passkey-bootstrap';

const schema = z.object({
  name: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().trim().min(2).optional(),
  ),
  email: z.string().email().optional(),
  phone: z.string().trim().max(30).optional(),
  username: z.string().min(3).max(30).optional(),
  password: z.string().min(8).regex(/[A-Za-z]/).regex(/[0-9]/).optional(),
  role: z.enum(['FAN', 'ARTIST', 'DJ', 'VENUE']).default('FAN'),
  isThirteenOrOlder: z.boolean().optional().default(false),
  isEighteenOrOlder: z.boolean().optional().default(false),
  acceptedArtistUploadPolicy: z.boolean().optional().default(false),
  contactInfo: z.string().trim().max(200).optional(),
  hometown: z.string().trim().max(160).optional(),
  headline: z.string().trim().max(140).optional(),
  bio: z.string().trim().max(280).optional(),
  heroImage: z.string().trim().url().or(z.literal('')).optional(),
  aboutContent: z.string().trim().max(5000).optional(),
  requestContent: z.string().trim().max(5000).optional(),
  addressLine1: z.string().trim().max(200).optional(),
  hoursText: z.string().trim().max(200).optional(),
  city: z.string().trim().max(120).optional(),
  stateRegion: z.string().trim().max(120).optional(),
  postalCode: z.string().trim().max(32).optional(),
  country: z.string().trim().max(120).optional(),
  parkingDetails: z.string().trim().max(5000).optional(),
  stayRecommendations: z.string().trim().max(5000).optional(),
  upcomingContent: z.string().trim().max(5000).optional(),
  previousShowHighlights: z.string().trim().max(5000).optional(),
  themePreset: z.enum(profileDesignPresetIds).optional(),
  themeAccentTone: z.enum(profileAccentToneIds).optional(),
  themeBackdropTone: z.enum(profileBackdropToneIds).optional(),
  inviteCode: z.string().trim().max(80).optional(),
  ref: z.string().trim().max(80).optional(),
  company: z.string().trim().max(120).optional(),
  passkeyFlow: z.boolean().optional().default(false),
  turnstileToken: z.string().optional(),
});

class InviteCodeClaimedError extends Error {}

function getVenueProfileOverrides(body: z.infer<typeof schema>) {
  return {
    headline: body.headline || null,
    bio: body.bio || null,
    heroImage: body.heroImage || null,
    aboutContent: body.aboutContent || null,
    requestContent: body.requestContent || null,
    addressLine1: body.addressLine1 || null,
    contactInfo: body.contactInfo || null,
    hometown: body.hometown || null,
    hoursText: body.hoursText || null,
    city: body.city || null,
    stateRegion: body.stateRegion || null,
    postalCode: body.postalCode || null,
    country: body.country || null,
    parkingDetails: body.parkingDetails || null,
    stayRecommendations: body.stayRecommendations || null,
    upcomingContent: body.upcomingContent || null,
    previousShowHighlights: body.previousShowHighlights || null,
    themePreset: body.themePreset ?? undefined,
    themeAccentTone: body.themeAccentTone ?? undefined,
    themeBackdropTone: body.themeBackdropTone ?? undefined,
  };
}

export async function POST(request: Request) {
  try {
    const clientAddress = readClientAddress(request);
    const rateLimit = await consumeRateLimit(`register:${clientAddress}`, {
      limit: 8,
      windowMs: 15 * 60 * 1000,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many signup attempts. Please wait a few minutes and try again.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
      );
    }

    const body = schema.parse(await request.json());
    if (!(await verifyTurnstileToken(body.turnstileToken, clientAddress))) {
      return NextResponse.json({ error: 'Bot check failed. Please try again.' }, { status: 400 });
    }

    const trimmedName = body.name?.trim() ?? '';
    const normalizedEmail = body.email ? body.email.toLowerCase() : null;
    const normalizedPhone = body.phone ? body.phone.replace(/\s+/g, '').toLowerCase() : null;

    let normalizedUsername: string;
    if (body.username) {
      normalizedUsername = normalizeUsername(body.username);
    } else {
      const base = trimmedName
        ? normalizeUsername(trimmedName.replace(/\s+/g, ''))
        : `user${Math.random().toString(36).slice(2, 8)}`;
      normalizedUsername = base.slice(0, 30) || `user${Math.random().toString(36).slice(2, 8)}`;
    }

    if (!body.passkeyFlow && !normalizedEmail && !normalizedPhone) {
      return NextResponse.json(
        { error: 'An email address or phone number is required to create an account.' },
        { status: 400 },
      );
    }

    if (body.company) {
      await recordAuditEvent({
        action: 'bot_trap_triggered',
        entityType: 'register',
        ipAddress: clientAddress,
        metadata: { field: 'company' },
      });
      return NextResponse.json({ error: 'Invalid registration payload' }, { status: 400 });
    }

    if (!isValidUsername(normalizedUsername)) {
      return NextResponse.json({ error: getUsernameValidationMessage() }, { status: 400 });
    }

    if ((body.role === 'ARTIST' || body.role === 'DJ') && !body.acceptedArtistUploadPolicy) {
      return NextResponse.json(
        { error: 'Artists and promoters must accept the iHYPE artist upload and limited use license policy.' },
        { status: 400 },
      );
    }

    if (!body.isThirteenOrOlder) {
      return NextResponse.json(
        { error: 'You must attest that you are 13 or older before creating an account.' },
        { status: 400 },
      );
    }

    const inviteCodeRequired = await isInviteCodeRequiredRuntime();
    const submittedInviteCode = body.inviteCode?.trim() || null;
    // Two invite channels: shared codes from BETA_INVITE_CODES (one per
    // distribution channel), and single-use codes minted by admins via
    // /api/admin/invite-codes. The DB code is claimed inside the signup
    // transaction below so a code can never admit two accounts.
    let dbInviteCodeId: string | null = null;
    if (inviteCodeRequired && !isValidInviteCode(submittedInviteCode, inviteCodeRequired)) {
      if (submittedInviteCode) {
        const dbCode = await db.inviteCode.findUnique({
          where: { code: submittedInviteCode.toUpperCase() },
          select: { id: true, usedByUserId: true, expiresAt: true },
        }).catch(() => null);
        if (dbCode && !dbCode.usedByUserId && (!dbCode.expiresAt || dbCode.expiresAt > new Date())) {
          dbInviteCodeId = dbCode.id;
        }
      }
      if (!dbInviteCodeId) {
        return NextResponse.json(
          { error: 'A valid beta invite code is required while invite-only signup is enabled.' },
          { status: 403 },
        );
      }
    }

    if (normalizedEmail && isReservedPlatformEmail(normalizedEmail)) {
      return NextResponse.json(
        { error: 'Please use an email address you control. @ihype.org email addresses are reserved.' },
        { status: 400 },
      );
    }

    if (body.role !== 'FAN' && trimmedName.length < 2) {
      return NextResponse.json({ error: 'Name is required for this account type.' }, { status: 400 });
    }

    const orConditions: Array<{ email: string } | { phone: string } | { username: string }> = [
      { username: normalizedUsername },
    ];
    if (normalizedEmail) orConditions.push({ email: normalizedEmail });
    if (normalizedPhone) orConditions.push({ phone: normalizedPhone });

    const existing = await db.user.findFirst({
      where: { OR: orConditions },
      select: { id: true, email: true },
    });
    if (existing) {
      return NextResponse.json(
        {
          error:
            normalizedEmail && existing.email === normalizedEmail
              ? 'An account with that email already exists'
              : 'An account with those credentials already exists',
        },
        { status: 409 },
      );
    }

    const passwordHash = body.password ? await bcrypt.hash(body.password, 10) : null;
    const profileType = getProfileType(body.role);
    const hexId = await generateUniqueProfileHexId();
    const slug = await generateUniqueNonwordSlug(db);
    const profileName = profileType === 'LISTENER' ? hexId : trimmedName;
    const profileCopyName = profileType === 'LISTENER' ? normalizedUsername : trimmedName;
    const passkeyBootstrap = body.passkeyFlow ? createPasskeyBootstrapCapability() : null;

    const { user, profile } = await db.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          name: body.role === 'FAN' ? normalizedUsername : trimmedName,
          email: normalizedEmail ?? undefined,
          phone: normalizedPhone ?? undefined,
          username: normalizedUsername,
          passwordHash,
          isThirteenOrOlder: body.isThirteenOrOlder,
          isEighteenOrOlder: body.isEighteenOrOlder,
          role: body.role,
        },
        select: { id: true, email: true, username: true, role: true },
      });

      const createdProfile = await tx.profile.create({
        data: {
          slug,
          hexId,
          type: profileType,
          name: profileName,
          ownerId: createdUser.id,
          contactInfo: body.contactInfo || null,
          hometown: body.hometown || null,
          city: body.city || body.hometown || null,
          postalCode: body.postalCode || null,
          verificationStatus: getVerificationStatusForType(profileType),
          verificationSubmittedAt:
            profileType === 'ARTIST' || profileType === 'VENUE' ? new Date() : null,
          ...getProfileCopy(profileType, profileCopyName),
          ...(profileType === 'VENUE' ? getVenueProfileOverrides(body) : {}),
        },
      });

      if (passkeyBootstrap) {
        await tx.passkeyBootstrapToken.create({
          data: {
            userId: createdUser.id,
            tokenHash: passkeyBootstrap.tokenHash,
            expiresAt: passkeyBootstrap.expiresAt,
          },
        });
      }

      if (dbInviteCodeId) {
        const claimed = await tx.inviteCode.updateMany({
          where: { id: dbInviteCodeId, usedByUserId: null },
          data: { usedByUserId: createdUser.id, usedAt: new Date() },
        });
        if (claimed.count === 0) {
          throw new InviteCodeClaimedError();
        }
      }

      return { user: createdUser, profile: createdProfile };
    });

    await recordAuditEvent({
      actorUserId: user.id,
      action: 'account_registered',
      entityType: 'user',
      entityId: user.id,
      ipAddress: clientAddress,
      metadata: {
        role: user.role,
        profileType: profile.type,
        profileId: profile.id,
        inviteCode: submittedInviteCode?.toLowerCase() ?? null,
        inviteKind: dbInviteCodeId ? 'single-use' : submittedInviteCode ? 'shared' : null,
      },
    }).catch((error) => {
      log.error('[register]', error instanceof Error ? error : null, 'Registration audit event failed');
    });

    const spamText = [body.name, body.bio, body.headline, body.aboutContent]
      .filter(Boolean)
      .join('\n')
      .trim();
    await runRegistrationPostProcessing({
      user,
      clientAddress,
      spamText,
      referral: body.ref,
    });

    const response = NextResponse.json({
      id: user.id,
      email: user.email,
      username: user.username,
      mfaRequired: false,
      profileId: profile.id,
      profileHexId: profile.hexId,
      profileSlug: profile.slug,
      publicProfilePath: getProfilePathForType(profile.type, profile.slug),
      profilePath: getDiscoverPathForType(profile.type),
    });

    if (passkeyBootstrap) {
      response.cookies.set(
        getPasskeyBootstrapCookieName(),
        passkeyBootstrap.token,
        getPasskeyBootstrapCookieOptions(),
      );
      response.cookies.delete('pk_reg_first_uid');
      response.cookies.delete('pk_reg_first_challenge');
    }

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? 'Invalid registration payload' },
        { status: 400 },
      );
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'Username or email already taken.' }, { status: 409 });
    }
    if (error instanceof InviteCodeClaimedError) {
      return NextResponse.json(
        { error: 'That invite code was just used by someone else. Ask for a fresh one.' },
        { status: 403 },
      );
    }
    log.error('[register]', error instanceof Error ? error : null, 'Registration failed');
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
