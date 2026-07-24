import { db } from '@/lib/db';

export interface HypeStreak {
  streak: number;
  daysActive: number;
}

/** Consecutive-days HYPE streak (UTC), computed from real AuditLog `hype_*` actions over the last 60 days. */
export async function getHypeStreak(userId: string): Promise<HypeStreak> {
  const logs = await db.auditLog.findMany({
    where: {
      actorUserId: userId,
      action: { startsWith: 'hype_' },
      createdAt: { gte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) },
    },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  }).catch(() => []);

  const days = new Set(logs.map((l) => l.createdAt.toISOString().slice(0, 10)));
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 60; i++) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (days.has(key)) streak++;
    else if (i > 0) break; // allow today to not have hyped yet (i=0)
  }

  return { streak, daysActive: days.size };
}
