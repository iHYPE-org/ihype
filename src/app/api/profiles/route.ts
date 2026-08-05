import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { recordAuditEvent } from '@/lib/audit';
import {
  generateUniqueProfileHexId,
  getProfileCopy,
  getProfileType,
  getVerificationStatusForType,
} from '@/lib/profile-creation';
import { generateUniqueNonwordSlug } from '@/lib/nonword-slug';
import { isAdminSession } from '@/lib/permissions';
import { consumeRateLimit } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';
import { log } from '@/lib/logger';

const schema = z.object({
  // No DJ. The role is being removed (docs/dj-role-removal-scope.md) and radio
  // is computed per listener now, so there is nothing a DJ page would do that
  // a fan account does not already do.
  role: z.enum(['ARTIST', 'VENUE']),
  name: z.string().trim().min(2).max(120),
  /**
   * The artist upload and limited-use licence attestation.
   *
   * This gate used to live at signup, because that was the only moment a role
   * was chosen. Roles are added here now, so the gate moved with them — an
   * artist page must not come into existence without it, and asking every fan
   * at signup was asking almost everyone to accept a policy about uploading
   * that they would never use.
   *
   * Note it is checked and not stored, exactly as it was at signup: no column
   * has ever recorded it. Persisting it needs a migration, which the repo's
   * workflow keeps to its own deploy, so it is recorded in the audit log here
   * instead of being silently dropped.
   */
  acceptedArtistUploadPolicy: z.boolean().optional().default(false),
});

/**
 * Lets an already-signed-in account add another page (artist/DJ/venue)
 * without going through the new-account signup flow — /api/register
 * always creates a brand new User, which fails for existing accounts.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Login required' }, { status: 401 });
  }

  const clientAddress = readClientAddress(request);
  // Admins (the beta operators) test page creation constantly and shouldn't
  // trip the abuse guard that protects against scripted page spam.
  if (!isAdminSession(session)) {
    const rateLimit = await consumeRateLimit(`add-profile:${session.user.id}`, {
      limit: 10,
      windowMs: 15 * 60 * 1000,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many pages created. Please wait a few minutes and try again.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } }
      );
    }
  }

  try {
    const body = schema.parse(await request.json());
    const trimmedName = body.name.trim();
    const profileType = getProfileType(body.role);

    // The gate that used to sit at signup. An artist page is the thing that
    // grants upload rights, so this is the moment the attestation actually
    // means something.
    if (body.role === 'ARTIST' && !body.acceptedArtistUploadPolicy) {
      return NextResponse.json(
        { error: 'Artists must accept the iHYPE artist upload and limited use license policy.' },
        { status: 400 },
      );
    }

    // Double-submit guard: retrying after a flaky error created duplicate
    // pages (same owner, same type, same name) in the wild. Treat an exact
    // repeat as "already done" rather than minting another page.
    const duplicate = await db.profile.findFirst({
      where: {
        ownerId: session.user.id,
        type: profileType,
        name: { equals: trimmedName, mode: 'insensitive' },
      },
      select: { id: true, slug: true, name: true, type: true, hexId: true },
    });
    if (duplicate) {
      return NextResponse.json(duplicate, { status: 200 });
    }

    const hexId = await generateUniqueProfileHexId();
    const slug = await generateUniqueNonwordSlug(db);

    const profile = await db.profile.create({
      data: {
        slug,
        hexId,
        type: profileType,
        name: trimmedName,
        ownerId: session.user.id,
        verificationStatus: getVerificationStatusForType(profileType),
        // Not stamped here either — see the note in POST /api/register. This
        // field means "a submission arrived"; only POST /api/verify sets it.
        verificationSubmittedAt: null,
        ...getProfileCopy(profileType, trimmedName),
      },
      select: { id: true, slug: true, name: true, type: true, hexId: true },
    });

    await recordAuditEvent({
      actorUserId: session.user.id,
      action: 'profile_added',
      entityType: 'profile',
      entityId: profile.id,
      ipAddress: clientAddress,
      // The upload-policy acceptance rides along here because no column
      // records it — it was never persisted at signup either. The audit log is
      // the only durable trace of the attestation until a migration adds one.
      metadata: body.role === 'ARTIST'
        ? { role: body.role, acceptedArtistUploadPolicy: true }
        : { role: body.role },
    });

    return NextResponse.json(profile, { status: 201 });
  } catch (error) {
    // Audit the failure so page-creation problems are diagnosable from the
    // admin console — a burst of these previously showed up only as an
    // unexplained rate-limit lockout.
    await recordAuditEvent({
      actorUserId: session.user.id,
      action: 'profile_add_failed',
      entityType: 'profile',
      ipAddress: clientAddress,
      metadata: {
        reason: error instanceof z.ZodError
          ? `validation: ${error.issues[0]?.message ?? 'invalid payload'}`
          : error instanceof Error
            ? error.message.slice(0, 300)
            : 'unknown',
      },
    }).catch(() => {});

    if (error instanceof z.ZodError) {
      const first = error.issues[0];
      return NextResponse.json({ error: first?.message ?? 'Invalid page payload' }, { status: 400 });
    }
    log.error('[profiles]', error instanceof Error ? error : null, 'Could not create additional page');
    return NextResponse.json({ error: 'Could not create page. Please try again.' }, { status: 500 });
  }
}
