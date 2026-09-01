import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { z } from 'zod';
import { log } from '@/lib/logger';

/* This table now carries BOTH meanings a dated entry can have — AVAILABLE
   (open for booking) and TOUR (a date being played) — because they are the
   same shape, the same owner, and the same CRUD. `kind` is what separates
   them; see the model's own comment in schema.prisma.

   Callers written before `kind` existed keep working unchanged: the column
   defaults to AVAILABLE, GET returns everything unless asked to narrow, and
   POST without a kind creates an AVAILABLE date exactly as it always did. */
const KINDS = ['AVAILABLE', 'TOUR'] as const;
type AvailabilityKindValue = (typeof KINDS)[number];
const isKind = (value: string | null): value is AvailabilityKindValue =>
  value !== null && (KINDS as readonly string[]).includes(value);

// GET ?profileId=xxx[&kind=TOUR] — public, returns future dates
export async function GET(request: NextRequest) {
  try {
    const profileId = request.nextUrl.searchParams.get('profileId');
    if (!profileId) {
      return NextResponse.json({ error: 'profileId required' }, { status: 400 });
    }

    /* An unrecognised kind is ignored rather than rejected: this is a public
       read, and answering 400 to a stale link is worse than answering with
       everything. */
    const kindParam = request.nextUrl.searchParams.get('kind');
    const now = new Date();
    const dates = await db.availabilityDate.findMany({
      where: { profileId, date: { gte: now }, ...(isKind(kindParam) ? { kind: kindParam } : {}) },
      select: { id: true, date: true, note: true, kind: true },
      orderBy: { date: 'asc' },
    });

    return NextResponse.json({ dates });
  } catch (err) {
    log.error('[api/profile/availability]', err instanceof Error ? err : { error: String(err) }, 'error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const addSchema = z.object({
  profileId: z.string().cuid(),
  date: z.string().datetime(),
  note: z.string().max(200).optional(),
  kind: z.enum(KINDS).optional(),
});

// POST — owner: add date
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Login required' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const parsed = addSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const { profileId, date, note, kind } = parsed.data;
    const profile = await db.profile.findUnique({ where: { id: profileId }, select: { ownerId: true } });
    if (!profile || profile.ownerId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const entry = await db.availabilityDate.create({
      data: { profileId, date: new Date(date), note, ...(kind ? { kind } : {}) },
    });

    return NextResponse.json({ date: entry }, { status: 201 });
  } catch (err) {
    log.error('[api/profile/availability]', err instanceof Error ? err : { error: String(err) }, 'error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const deleteSchema = z.object({ id: z.string().cuid() });

// DELETE — owner: remove by id
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Login required' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const parsed = deleteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const entry = await db.availabilityDate.findUnique({
      where: { id: parsed.data.id },
      include: { profile: { select: { ownerId: true } } },
    });
    if (!entry || entry.profile.ownerId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await db.availabilityDate.delete({ where: { id: parsed.data.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    log.error('[api/profile/availability]', err instanceof Error ? err : { error: String(err) }, 'error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
