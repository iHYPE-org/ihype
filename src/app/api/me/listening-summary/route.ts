import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * The listener's own month, for ME — the identity panel beside the account
 * stats (owner-approved batch, 2026-08-24: "a listening identity, not just an
 * account").
 *
 * Two rules carried over from `analytics-engine.ts` and `hype-link-stats`:
 * every figure resolves independently and returns NULL on failure (an em dash,
 * never a fabricated 0), and every figure is one the schema can actually
 * answer. That second rule shapes the labels: `MediaListen` keeps ONE row per
 * (user, track) with `completedAt` re-stamped on each finish, so a play COUNT
 * does not exist — what exists is "distinct tracks finished", and that is what
 * the figures claim. Top artists are likewise ranked by distinct tracks, not
 * plays, and say so.
 *
 * Session-scoped only — the same IDOR rule as `/api/analytics/summary`: the
 * caller gets their own listening and nobody else's, and the response is
 * private/no-store because a shared cache in front of per-account figures is a
 * cross-account leak.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Login required' }, { status: 401 });
  const userId = session.user.id;
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const quiet = <T,>(promise: Promise<T>): Promise<T | null> => promise.catch(() => null);

  const [tracksThisMonth, tracksTotal, topArtistRows, hypesThisMonth] = await Promise.all([
    quiet(db.mediaListen.count({ where: { userId, completedAt: { gte: monthStart } } })),
    quiet(db.mediaListen.count({ where: { userId, completedAt: { not: null } } })),
    quiet(db.mediaListen.groupBy({
      by: ['artistName', 'artistProfileSlug'],
      where: { userId, completedAt: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { mediaId: 'desc' } },
      take: 3,
    })),
    quiet(db.profileHypeEvent.count({ where: { userId, createdAt: { gte: monthStart } } })),
  ]);

  return NextResponse.json(
    {
      tracksThisMonth,
      tracksTotal,
      topArtists: topArtistRows
        ? topArtistRows.map((row) => ({
            name: row.artistName,
            slug: row.artistProfileSlug,
            tracks: row._count._all,
          }))
        : null,
      hypesThisMonth,
    },
    { headers: { 'cache-control': 'private, no-store' } },
  );
}
