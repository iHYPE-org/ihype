import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { consumeRateLimit, rateLimitKey } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ showId: string }> }) {
  const { showId } = await params;
  const session = await auth();

  const show = await db.show.findUnique({
    where: { id: showId },
    select: { headlinerProfileId: true },
  });
  if (!show?.headlinerProfileId) return NextResponse.json({ tracks: [] });

  const assets = await db.artistMediaAsset.findMany({
    where: { profileId: show.headlinerProfileId },
    select: { id: true, title: true },
    take: 5,
    orderBy: { createdAt: 'desc' },
  });

  const voteCounts = await db.setlistVote.groupBy({
    by: ['mediaId'],
    where: { showId, mediaId: { in: assets.map((a) => a.id) } },
    _count: { mediaId: true },
  });

  const userVotes = session?.user?.id
    ? await db.setlistVote.findMany({
        where: { showId, userId: session.user.id },
        select: { mediaId: true },
      })
    : [];

  const userVotedIds = new Set(userVotes.map((v) => v.mediaId));
  const countMap = new Map(voteCounts.map((v) => [v.mediaId, v._count.mediaId]));

  const tracks = assets.map((a) => ({
    mediaId: a.id,
    title: a.title,
    voteCount: countMap.get(a.id) ?? 0,
    userVoted: userVotedIds.has(a.id),
  })).sort((a, b) => b.voteCount - a.voteCount);

  return NextResponse.json({ tracks });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ showId: string }> }) {
  const { showId } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { mediaId } = await request.json() as { mediaId: string };
  if (!mediaId) return NextResponse.json({ error: 'mediaId required' }, { status: 400 });

  const rl = await consumeRateLimit(rateLimitKey('setlist-vote', session.user.id, null), { limit: 30, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });

  const show = await db.show.findUnique({ where: { id: showId }, select: { status: true } });
  if (!show || !['SCHEDULED', 'LIVE'].includes(show.status)) {
    return NextResponse.json({ error: 'Show not available for voting' }, { status: 400 });
  }

  const existing = await db.setlistVote.findFirst({
    where: { showId, userId: session.user.id, mediaId },
  });

  if (existing) {
    await db.setlistVote.delete({ where: { id: existing.id } });
  } else {
    await db.setlistVote.create({ data: { showId, userId: session.user.id, mediaId } });
  }

  const voteCount = await db.setlistVote.count({ where: { showId, mediaId } });
  return NextResponse.json({ voteCount, userVoted: !existing });
}
