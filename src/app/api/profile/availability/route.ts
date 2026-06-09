import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { z } from 'zod';

// GET ?profileId=xxx — public, returns future dates
export async function GET(request: NextRequest) {
  try {
    const profileId = request.nextUrl.searchParams.get('profileId');
    if (!profileId) {
      return NextResponse.json({ error: 'profileId required' }, { status: 400 });
    }

    const now = new Date();
    const dates = await db.availabilityDate.findMany({
      where: { profileId, date: { gte: now } },
      select: { id: true, date: true, note: true },
      orderBy: { date: 'asc' },
    });

    return NextResponse.json({ dates });
  } catch (err) {
    console.error('[api/profile/availability] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const addSchema = z.object({
  profileId: z.string().cuid(),
  date: z.string().datetime(),
  note: z.string().max(200).optional(),
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

    const { profileId, date, note } = parsed.data;
    const profile = await db.profile.findUnique({ where: { id: profileId }, select: { ownerId: true } });
    if (!profile || profile.ownerId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const entry = await db.availabilityDate.create({
      data: { profileId, date: new Date(date), note },
    });

    return NextResponse.json({ date: entry }, { status: 201 });
  } catch (err) {
    console.error('[api/profile/availability] error', err);
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
    console.error('[api/profile/availability] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
