import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db, withDbRetry } from '@/lib/db';
import { consumeRateLimit } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';

export const dynamic = 'force-dynamic';

const prefsSchema = z.object({
  profileId: z.string().min(1),
  notifyShows: z.boolean()
});

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Sign in to update notification preferences.' }, { status: 401 });
  }
  const clientAddress = readClientAddress(request);
  const rate = await consumeRateLimit(`follow-prefs:${session.user.id}:${clientAddress ?? 'anon'}`, {
    limit: 60,
    windowMs: 60 * 1000
  });
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
  }

  let body: z.infer<typeof prefsSchema>;
  try {
    body = prefsSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'profileId and notifyShows are required.' }, { status: 400 });
  }

  try {
    const existing = await withDbRetry(() => db.follow.findUnique({
      where: { followerId_followeeProfileId: { followerId: session.user.id, followeeProfileId: body.profileId } },
      select: { id: true }
    }));
    if (!existing) {
      return NextResponse.json({ error: 'Not following this profile.' }, { status: 404 });
    }
    const updated = await withDbRetry(() => db.follow.update({
      where: { followerId_followeeProfileId: { followerId: session.user.id, followeeProfileId: body.profileId } },
      data: { notifyShows: body.notifyShows },
      select: { followeeProfileId: true, notifyShows: true }
    }));
    return NextResponse.json({ profileId: updated.followeeProfileId, notifyShows: updated.notifyShows });
  } catch {
    return NextResponse.json({ error: 'Database unavailable — please try again.' }, { status: 503 });
  }
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Sign in to view notification preferences.' }, { status: 401 });
  }
  try {
    const follows = await withDbRetry(() => db.follow.findMany({
      where: { followerId: session.user.id },
      select: {
        notifyShows: true,
        followeeProfile: { select: { id: true, name: true, slug: true } }
      },
      orderBy: { createdAt: 'desc' }
    }));
    return NextResponse.json({
      follows: follows.map((f) => ({
        profileId: f.followeeProfile.id,
        name: f.followeeProfile.name,
        slug: f.followeeProfile.slug,
        notifyShows: f.notifyShows
      }))
    });
  } catch {
    return NextResponse.json({ error: 'Database unavailable.' }, { status: 503 });
  }
}
