import { db } from '@/lib/db';
import { getDiscoveryStreak } from '@/lib/streaks';

type BadgeType = 'first_hype' | 'hype_10' | 'hype_50' | 'listener_100' | 'streak_7' | 'referral_1' | 'referral_5' | 'referral_10' | 'early_fan';

export async function checkAndAwardBadges(userId: string, opts?: { referrerUsername?: string }): Promise<void> {
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

    // Early Fan: user was among the first 25 hypers on any profile that now has hypeCount >= 100
    if (!awarded.has('early_fan')) {
      const userHypeEvents = await db.profileHypeEvent.findMany({
        where: { userId, profile: { hypeCount: { gte: 100 } } },
        select: { profileId: true, createdAt: true },
        take: 100
      });
      if (userHypeEvents.length > 0) {
        const counts = await Promise.all(
          userHypeEvents.map((e) =>
            db.profileHypeEvent.count({
              where: { profileId: e.profileId, createdAt: { lt: e.createdAt } }
            })
          )
        );
        if (counts.some((c) => c < 25)) toAward.push('early_fan');
      }
    }

    if (opts?.referrerUsername) {
      const referralCount = await db.auditLog.count({
        where: {
          action: 'REFERRAL_SIGNUP',
          metadata: { path: ['referrer'], equals: opts.referrerUsername }
        }
      });
      if (referralCount >= 1 && !awarded.has('referral_1')) toAward.push('referral_1');
      if (referralCount >= 5 && !awarded.has('referral_5')) toAward.push('referral_5');
      if (referralCount >= 10 && !awarded.has('referral_10')) toAward.push('referral_10');
    }

    if (toAward.length === 0) return;

    await db.badge.createMany({
      data: toAward.map((type) => ({ userId, type })),
      skipDuplicates: true,
    });
  } catch {
    // Best-effort — never fail the caller
  }
}
