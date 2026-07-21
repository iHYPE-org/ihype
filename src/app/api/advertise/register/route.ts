import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client/edge';
import { z } from 'zod';
import { db } from '@/lib/db';
import { log } from '@/lib/logger';
import { sendMagicLinkEmail } from '@/lib/magic-link';
import { normalizeUsername, isValidUsername } from '@/lib/usernames';
import { consumeRateLimit } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';
import { isReservedPlatformEmail } from '@/lib/runtime-flags';
import { recordAuditEvent } from '@/lib/audit';

const schema = z.object({
  email: z.string().trim().email(),
  companyName: z.string().trim().min(2).max(120),
  contactName: z.string().trim().max(120).optional(),
  website: z.string().trim().url().or(z.literal('')).optional(),
});

/**
 * Advertiser Profile — a private, non-"app-user" account for the
 * "3rd-Party Accounts" path (music stores, merch printers, live-production
 * companies) already described in Advertise.dc.html's copy but never
 * actually buildable before this. Deliberately separate from /api/register:
 * no Profile row is created (advertisers have no public page), none of the
 * music-industry-specific fields (hometown, genre, artist upload policy)
 * apply, and sign-in reuses the same passwordless magic-link mechanism as
 * every other account in this app rather than inventing a new one.
 */
export async function POST(request: Request) {
  try {
    const clientAddress = readClientAddress(request);
    const rateLimit = await consumeRateLimit(`advertise-register:${clientAddress}`, {
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
    const email = body.email.toLowerCase();

    if (isReservedPlatformEmail(email)) {
      return NextResponse.json(
        { error: 'Please use an email address you control. @ihype.org email addresses are reserved.' },
        { status: 400 },
      );
    }

    const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      return NextResponse.json({ error: 'An account with that email already exists.' }, { status: 409 });
    }

    let normalizedUsername = normalizeUsername(`adv-${body.companyName}`).slice(0, 30);
    if (!isValidUsername(normalizedUsername)) {
      normalizedUsername = `advertiser${Math.random().toString(36).slice(2, 8)}`;
    }

    const { user } = await db.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          name: body.companyName,
          email,
          username: normalizedUsername,
          isThirteenOrOlder: true,
          role: 'ADVERTISER',
        },
        select: { id: true, email: true },
      });

      await tx.advertiserAccount.create({
        data: {
          userId: createdUser.id,
          companyName: body.companyName,
          contactName: body.contactName || null,
          website: body.website || null,
        },
      });

      return { user: createdUser };
    });

    await recordAuditEvent({
      actorUserId: user.id,
      action: 'advertiser_account_registered',
      entityType: 'user',
      entityId: user.id,
      ipAddress: clientAddress,
      metadata: { companyName: body.companyName },
    }).catch((error) => {
      log.error('[advertise/register]', error instanceof Error ? error : null, 'Audit event failed');
    });

    await sendMagicLinkEmail(user.id, email);

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? 'Invalid registration payload' },
        { status: 400 },
      );
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'An account with that email already exists.' }, { status: 409 });
    }
    log.error('[advertise/register]', error instanceof Error ? error : null, 'Advertiser registration failed');
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
