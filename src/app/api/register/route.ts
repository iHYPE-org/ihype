import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { Prisma, ProfileType } from '@prisma/client';
import { getDiscoverPathForType, getProfilePathForType } from '@/lib/account-routing';
import { recordAuditEvent } from '@/lib/audit';
import { db } from '@/lib/db';
import { createHexId } from '@/lib/hex-id';
import { profileAccentToneIds, profileBackdropToneIds, profileDesignPresetIds } from '@/lib/profile-design';
import { consumeRateLimit } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';
import { isInviteCodeRequiredRuntime, isReservedPlatformEmail, isValidInviteCode } from '@/lib/runtime-flags';
import { getUsernameValidationMessage, isValidUsername, normalizeUsername } from '@/lib/usernames';
import { slugify } from '@/lib/utils';
import { sendDay1Email } from '@/lib/onboarding-emails';
import { checkForSpam } from '@/lib/spam-detection';

const schema = z.object({
  name: z.preprocess(v => (typeof v === 'string' && v.trim() === '' ? undefined : v), z.string().trim().min(2).optional()),
  email: z.string().email().optional(),
  phone: z.string().trim().max(30).optional(),
  username: z.string().min(3).max(30).optional(),
  password: z
    .string()
    .min(8)
    .regex(/[A-Za-z]/)
    .regex(/[0-9]/)
    .optional(),
  role: z.enum(['FAN', 'ARTIST', 'DJ', 'VENUE']).default('FAN'),
  isThirteenOrOlder: z.boolean().optional().default(false),
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
  passkeyFlow: z.boolean().optional().default(false)
});

function getProfileType(role: 'FAN' | 'ARTIST' | 'DJ' | 'VENUE'): ProfileType {
  if (role === 'ARTIST') return 'ARTIST';
  if (role === 'DJ') return 'DJ';
  if (role === 'VENUE') return 'VENUE';
  return 'LISTENER';
}

function getProfileCopy(type: ProfileType, name: string) {
  if (type === 'ARTIST') {
    return {
      headline: `${name} is shaping the next chapter.`,
      bio: 'Add your story, current focus, and favorite way to move a room.',
      aboutContent: 'Tell people who you are, what you make, and what drives your work.',
      journalContent: 'Share updates, studio notes, release thoughts, or behind-the-scenes moments.',
      mediaContent: 'Drop video links, press pull quotes, playlists, or embed-ready media notes here.',
      tourContent: 'List upcoming dates, routing plans, and travel notes for booking conversations.',
      merchContent: 'Point fans to limited drops, vinyl, bundles, or whatever your merch table is cooking.'
    };
  }

  if (type === 'DJ') {
    return {
      headline: `${name} is building the next room worth talking about.`,
      bio: 'Introduce your sound, your rooms, and how you like to move a crowd.',
      aboutContent: 'Tell artists and venues what kind of nights you build and what you are looking for next.',
      recommendContent: 'Use this section to talk about the artists, collaborators, and scenes you champion.'
    };
  }

  if (type === 'VENUE') {
    return {
      headline: `${name} is opening its doors to the next wave.`,
      bio: 'Describe the room, the neighborhood, and the kind of nights you want to host.',
      aboutContent: 'Tell artists and promoters what the venue feels like, what it supports, and who it is for.',
      requestContent: 'Set expectations for artist recommendations, booking notes, and how fans should use this request tab.'
    };
  }

  return {
    headline: `${name} is curating a personal listening world.`,
    bio: 'Introduce yourself, the scenes you love, and what you are always looking for next.',
    aboutContent: 'Tell people what kind of fan you are and what sounds stay in rotation.',
    topFiveContent: 'List your current top 5 artists, records, or live moments here.'
  };
}

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
    themeBackdropTone: body.themeBackdropTone ?? undefined
  };
}

function getVerificationStatusForType(type: ProfileType) {
  if (type === 'ARTIST' || type === 'VENUE') {
    return 'PENDING' as const;
  }

  return 'UNVERIFIED' as const;
}

async function generateUniqueProfileHexId() {
  let hexId = createHexId();

  while (await db.profile.findUnique({ where: { hexId } })) {
    hexId = createHexId();
  }

  return hexId;
}

export async function POST(request: Request) {
  try {
    const clientAddress = readClientAddress(request);
    const rateLimit = await consumeRateLimit(`register:${clientAddress}`, {
      limit: 8,
      windowMs: 15 * 60 * 1000
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many signup attempts. Please wait a few minutes and try again.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.retryAfterSeconds)
          }
        }
      );
    }

    const rawBody = await request.json();
    const body = schema.parse(rawBody);
    const trimmedName = body.name?.trim() ?? '';
    const normalizedEmail = body.email ? body.email.toLowerCase() : null;
    const normalizedPhone = body.phone ? body.phone.replace(/\s+/g, '').toLowerCase() : null;

    // Auto-generate username from name or a random string if not provided
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
        { status: 400 }
      );
    }

    if (body.company) {
      await recordAuditEvent({
        action: 'bot_trap_triggered',
        entityType: 'register',
        ipAddress: clientAddress,
        metadata: { field: 'company' }
      });
      return NextResponse.json({ error: 'Invalid registration payload' }, { status: 400 });
    }

    if (!isValidUsername(normalizedUsername)) {
      return NextResponse.json({ error: getUsernameValidationMessage() }, { status: 400 });
    }

    if ((body.role === 'ARTIST' || body.role === 'DJ') && !body.acceptedArtistUploadPolicy) {
      return NextResponse.json(
        { error: 'Artists and promoters must accept the iHYPE artist upload and limited use license policy.' },
        { status: 400 }
      );
    }

    if (!body.isThirteenOrOlder) {
      return NextResponse.json(
        { error: 'You must attest that you are 13 or older before creating an account.' },
        { status: 400 }
      );
    }

    const inviteCodeRequired = await isInviteCodeRequiredRuntime();
    if (inviteCodeRequired && !isValidInviteCode(body.inviteCode, inviteCodeRequired)) {
      return NextResponse.json(
        { error: 'A valid beta invite code is required while invite-only signup is enabled.' },
        { status: 403 }
      );
    }

    if (normalizedEmail && isReservedPlatformEmail(normalizedEmail)) {
      return NextResponse.json(
        { error: 'Please use an email address you control. @ihype.org email addresses are reserved.' },
        { status: 400 }
      );
    }

    if (body.role !== 'FAN' && trimmedName.length < 2) {
      return NextResponse.json({ error: 'Name is required for this account type.' }, { status: 400 });
    }

    const orConditions: Array<{ email: string } | { phone: string } | { username: string }> = [{ username: normalizedUsername }];
    if (normalizedEmail) orConditions.push({ email: normalizedEmail });
    if (normalizedPhone) orConditions.push({ phone: normalizedPhone });

    const existing = await db.user.findFirst({
      where: { OR: orConditions },
      select: { id: true, email: true, username: true }
    });

    if (existing) {
      return NextResponse.json(
        {
          error:
            normalizedEmail && existing.email === normalizedEmail
              ? 'An account with that email already exists'
              : 'An account with those credentials already exists'
        },
        { status: 409 }
      );
    }

    const passwordHash = body.password ? await bcrypt.hash(body.password, 10) : null;
    const user = await db.user.create({
      data: {
        name: body.role === 'FAN' ? normalizedUsername : trimmedName,
        email: normalizedEmail ?? undefined,
        phone: normalizedPhone ?? undefined,
        username: normalizedUsername || `user${Math.random().toString(36).slice(2, 8)}`,
        passwordHash,
        isThirteenOrOlder: body.isThirteenOrOlder,
        role: body.role
      },
      select: { id: true, email: true, username: true, role: true }
    });

    const profileType = getProfileType(body.role);
    const hexId = await generateUniqueProfileHexId();
    const slugSource = body.role === 'FAN' ? normalizedUsername : trimmedName;
    const baseSlug = slugify(slugSource);
    let slug = baseSlug || `profile-${user.id.slice(0, 6)}`;
    let suffix = 1;

    while (await db.profile.findUnique({ where: { slug } })) {
      slug = `${baseSlug || 'profile'}-${suffix}`;
      suffix += 1;
    }

    const profileName = profileType === 'LISTENER' ? hexId : trimmedName;
    const profileCopyName = profileType === 'LISTENER' ? normalizedUsername : trimmedName;

    const profile = await db.profile.create({
      data: {
        slug,
        hexId,
        type: profileType,
        name: profileName,
        ownerId: user.id,
        contactInfo: body.contactInfo || null,
        hometown: body.hometown || null,
        city: body.city || body.hometown || null,
        postalCode: body.postalCode || null,
        verificationStatus: getVerificationStatusForType(profileType),
        verificationSubmittedAt:
          profileType === 'ARTIST' || profileType === 'VENUE' ? new Date() : null,
        ...getProfileCopy(profileType, profileCopyName),
        ...(profileType === 'VENUE' ? getVenueProfileOverrides(body) : {})
      }
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
        profileId: profile.id
      }
    });

    // Spam detection — check bio/headline content if provided
    const spamCheckText = [body.name, body.bio, body.headline, body.aboutContent]
      .filter(Boolean)
      .join('\n')
      .trim();
    if (spamCheckText.length > 20) {
      checkForSpam(spamCheckText, 'registration profile content')
        .then(async (spamResult) => {
          if (spamResult.isSpam && spamResult.confidence > 0.85) {
            await recordAuditEvent({
              actorUserId: user.id,
              action: 'account_flagged_spam',
              entityType: 'user',
              entityId: user.id,
              ipAddress: clientAddress,
              metadata: { confidence: spamResult.confidence }
            });
          }
        })
        .catch(() => {});
    }

    // Track referral if present
    if (body.ref) {
      recordAuditEvent({
        actorUserId: null,
        action: 'REFERRAL_SIGNUP',
        entityType: 'User',
        entityId: user.id,
        metadata: { referrer: body.ref }
      }).catch(() => {});
    }

    // Fire-and-forget onboarding email
    void sendDay1Email(user.id);

    const resp = NextResponse.json({
      id: user.id,
      email: user.email,
      username: user.username,
      mfaRequired: false,
      profileId: profile.id,
      profileHexId: profile.hexId,
      profileSlug: profile.slug,
      publicProfilePath: getProfilePathForType(profile.type, profile.slug),
      profilePath: getDiscoverPathForType(profile.type)
    });

    if (body.passkeyFlow) {
      const isProduction = process.env.NODE_ENV === 'production';
      resp.cookies.set('pk_reg_first_uid', user.id, {
        httpOnly: true,
        sameSite: 'strict',
        maxAge: 600,
        path: '/',
        secure: isProduction
      });
    }

    return resp;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const first = error.issues[0];
      return NextResponse.json({ error: first?.message ?? 'Invalid registration payload' }, { status: 400 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'Username or email already taken.' }, { status: 409 });
    }
    console.error('[register]', error);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
