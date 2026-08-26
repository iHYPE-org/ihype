import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client/edge';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { log } from '@/lib/logger';
import { consumeRateLimit } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';
import { isAdvertisingEnabledRuntime } from '@/lib/runtime-flags';
import { recordAuditEvent } from '@/lib/audit';

/**
 * Adds the advertiser role to an account that already exists.
 *
 * WHY THIS EXISTS. `POST /api/advertise/register` creates an advertiser, but it
 * creates a WHOLE NEW USER — it looks the email up first and answers 409 "an
 * account with that email already exists", so the one path into the fifth
 * account type was closed to every member the platform already has. ME drew an
 * "Add advertiser profile" button on top of that gap and pointed it at the
 * CAMPAIGN BUILDER, so the label and the destination disagreed and the role was
 * never actually addable (owner, 2026-08-25: "Need ability to add advertiser
 * role as well").
 *
 * WHY IT DOES NOT TOUCH `User.role`. `Role` is a single enum column, so writing
 * ADVERTISER onto a signed-in member would DEMOTE them out of whatever they
 * already are — and onto an admin it would revoke the console. Nothing gates on
 * `role === 'ADVERTISER'` anyway: `/api/advertise/campaigns` keys off
 * `session.user.id`, the dashboard reads the `AdvertiserAccount` row, and ME's
 * own `hasAdvertiser` is `advertiser !== null`. The row IS the role here. The
 * registration route still sets the enum because the users it creates have no
 * other role to lose.
 *
 * ADD ONLY, like `POST /api/me/email` above it: a second call is a 409 rather
 * than an edit. Editing company details is a real feature and needs its own
 * form and its own thought; returning 409 says the gap being closed is "cannot
 * become an advertiser at all".
 */

const ADVERTISER_CATEGORIES = ['LABEL', 'VENUE_PROMOTER', 'GEAR', 'TICKETING', 'MERCH', 'TOUR'] as const;

const schema = z.object({
  companyName: z.string().trim().min(2).max(120),
  contactName: z.string().trim().max(120).optional(),
  website: z.string().trim().url().or(z.literal('')).optional(),
  category: z.enum(ADVERTISER_CATEGORIES).optional(),
  pitch: z.string().trim().max(1000).optional(),
});

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Login required.' }, { status: 401 });
  }
  const userId = session.user.id;

  if (!(await isAdvertisingEnabledRuntime())) {
    return NextResponse.json({ error: 'Advertiser signup is temporarily paused.' }, { status: 503 });
  }

  const clientAddress = readClientAddress(request);
  const [ipLimit, userLimit] = await Promise.all([
    consumeRateLimit(`me-advertiser:${clientAddress}`, { limit: 8, windowMs: 15 * 60 * 1000 }),
    consumeRateLimit(`me-advertiser:user:${userId}`, { limit: 8, windowMs: 15 * 60 * 1000 }),
  ]);
  if (!ipLimit.allowed || !userLimit.allowed) {
    return NextResponse.json({ error: 'Too many requests. Try again in a few minutes.' }, { status: 429 });
  }

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await request.json());
  } catch (error) {
    const message = error instanceof z.ZodError ? error.issues[0]?.message : null;
    return NextResponse.json({ error: message ?? 'Check the details and try again.' }, { status: 400 });
  }

  try {
    await db.advertiserAccount.create({
      data: {
        userId,
        companyName: body.companyName,
        contactName: body.contactName || null,
        website: body.website || null,
        category: body.category ?? null,
        pitch: body.pitch || null,
      },
      select: { id: true },
    });
  } catch (error) {
    /* `userId` is unique on AdvertiserAccount, so the duplicate is caught by the
       database rather than by a read-then-write that two concurrent submits
       could both pass. */
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'This account already has an advertiser profile.' }, { status: 409 });
    }
    log.error('[me/advertiser]', error instanceof Error ? error : null, 'Advertiser profile creation failed');
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }

  await recordAuditEvent({
    actorUserId: userId,
    action: 'advertiser_account_added',
    entityType: 'user',
    entityId: userId,
    ipAddress: clientAddress,
    metadata: { companyName: body.companyName },
  }).catch((error) => {
    log.error('[me/advertiser]', error instanceof Error ? error : null, 'Audit event failed');
  });

  return NextResponse.json({ ok: true });
}
