import { db } from '@/lib/db';

/**
 * Returns the user's current discovery streak — number of consecutive days
 * (ending today or yesterday) on which they recorded at least one Seed
 * action. Returns 0 if no recent activity.
 */
export async function getDiscoveryStreak(userId: string): Promise<number> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const seeds = await db.seed.findMany({
    where: { userId, createdAt: { gte: since } },
    select: { createdAt: true }
  });
  if (seeds.length === 0) return 0;

  const days = new Set(seeds.map((s) => s.createdAt.toISOString().slice(0, 10)));
  let streak = 0;
  const cursor = new Date();
  cursor.setUTCHours(0, 0, 0, 0);

  // If no action today, start counting from yesterday (so today doesn't reset
  // a streak someone is about to extend).
  if (!days.has(cursor.toISOString().slice(0, 10))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

export async function getArtistUploadStreak(profileId: string): Promise<number> {
  if (!profileId) return 0;
  const assets = await db.artistMediaAsset.findMany({
    where: { profileId, createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } },
    select: { createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  if (assets.length === 0) return 0;

  const isoWeek = (d: Date) => {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return `${date.getUTCFullYear()}-${Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)}`;
  };

  const weeks = new Set(assets.map((a) => isoWeek(a.createdAt)));
  const now = new Date();
  let streak = 0;
  let week = new Date(now);
  while (true) {
    const key = isoWeek(week);
    if (!weeks.has(key)) break;
    streak++;
    week = new Date(week.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
  return streak;
}
