import { db } from '@/lib/db';
import { getDiscoveryStreak } from '@/lib/streaks';

type BadgeType = 'first_hype' | 'hype_10' | 'hype_50' | 'listener_100' | 'streak_7';

export async function checkAndAwardBadges(userId: string): Promise<void> {
  try {
    const [hyped, listened, streak, existing] = await Promise.all([
      db.profileHypeEvent.count({ where: { userId } }),
      db.mediaListen.count({ where: { userId } }),
      getDiscoveryStreak(userId),
      db.badge.findMany({ where: { userId }, select: { type: true } }),
    ]);

    const awarded = new Set(existing.map((b) => b.type));
    const toAward: BadgeType[] = [];

    if (hyped >= 1 && !awarded.has('first_hype')) toAward.push('first_hype');
    if (hyped >= 10 && !awarded.has('hype_10')) toAward.push('hype_10');
    if (hyped >= 50 && !awarded.has('hype_50')) toAward.push('hype_50');
    if (listened >= 100 && !awarded.has('listener_100')) toAward.push('listener_100');
    if (streak >= 7 && !awarded.has('streak_7')) toAward.push('streak_7');

    if (toAward.length === 0) return;

    await db.badge.createMany({
      data: toAward.map((type) => ({ userId, type })),
      skipDuplicates: true,
    });
  } catch {
    // Best-effort — never fail the caller
  }
}
