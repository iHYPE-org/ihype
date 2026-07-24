import { db } from '@/lib/db';

export interface RecentHyper {
  hexId: string;
  createdAt: Date;
}

/** Real recent hypers for a profile (owner-only view) — most recent first. */
export async function getRecentHypers(profileId: string, limit = 10): Promise<RecentHyper[]> {
  const events = await db.profileHypeEvent.findMany({
    where: { profileId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      user: {
        include: {
          profiles: { take: 1, select: { hexId: true } },
        },
      },
    },
  });

  return events.map((e) => ({
    hexId: e.user.profiles[0]?.hexId ?? e.userId.slice(0, 8),
    createdAt: e.createdAt,
  }));
}

/** "2h ago" / "3d ago" style relative time, for the Recent Hype dashboard widget. */
export function formatHypeAgo(date: Date): string {
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
