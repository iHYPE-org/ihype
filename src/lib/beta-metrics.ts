import { Prisma } from '@prisma/client/edge';
import { db } from '@/lib/db';
import { demoUserEmails } from '@/lib/runtime-flags';

export type BetaInviteChannel = { code: string; kind: string; signups: number };

export type BetaMetrics = {
  totalUsers: number;
  signups7d: number;
  activatedUsers: number;
  activationRate: number;
  weeklyActiveUsers: number;
  weeklyActiveRate: number;
  radioDjs30d: number;
  recurringDjs30d: number;
  inviteChannels: BetaInviteChannel[];
};

const DAY = 24 * 60 * 60 * 1000;

// Counts distinct active users via a DB-side COUNT(DISTINCT), rather than
// pulling every HypeEvent/ShowRsvp/MediaListen row (unbounded, including a
// full-table "ever active" scan) into Node just to dedupe in JS.
async function countDistinctActiveUsers(since: Date | null, excludeUserIds: string[]): Promise<number> {
  const sinceSql = since ? Prisma.sql`AND "createdAt" >= ${since}` : Prisma.empty;
  const excludeSql = excludeUserIds.length
    ? Prisma.sql`AND "userId" NOT IN (${Prisma.join(excludeUserIds)})`
    : Prisma.empty;

  const rows = await db.$queryRaw<{ count: bigint }[]>(Prisma.sql`
    SELECT COUNT(DISTINCT "userId")::bigint AS count FROM (
      SELECT "userId" FROM "HypeEvent" WHERE true ${sinceSql} ${excludeSql}
      UNION
      SELECT "userId" FROM "ShowRsvp" WHERE true ${sinceSql} ${excludeSql}
      UNION
      SELECT "userId" FROM "MediaListen" WHERE true ${sinceSql} ${excludeSql}
    ) AS active_users
  `).catch(() => [{ count: 0n }]);
  return Number(rows[0]?.count ?? 0);
}

/**
 * Beta launch metrics for the admin console, computed from real activity
 * tables only (HypeEvent / ShowRsvp / MediaListen / Show / AuditLog) —
 * never estimates. Demo accounts are excluded from every number so the
 * dashboard reflects actual beta participants. Activation = a user has
 * ever hyped, RSVP'd, or listened; weekly active = did one of those in
 * the last 7 days. Invite channels group the last 30 days of signups by
 * the invite code recorded in the account_registered audit event.
 */
export async function getBetaMetrics(): Promise<BetaMetrics> {
  const now = Date.now();
  const week = new Date(now - 7 * DAY);
  const month = new Date(now - 30 * DAY);

  const demoUsers = await db.user.findMany({
    where: { email: { in: demoUserEmails } },
    select: { id: true },
  }).catch(() => [] as { id: string }[]);
  const demoIds = new Set(demoUsers.map((u) => u.id));

  const excludeDemoIds = [...demoIds];
  const [totalUsers, signups7d, activatedUsers, weeklyActiveUsers, radioShowGroups, registrationAudits] = await Promise.all([
    db.user.count({ where: { id: { notIn: excludeDemoIds } } }).catch(() => 0),
    db.user.count({ where: { createdAt: { gte: week }, id: { notIn: excludeDemoIds } } }).catch(() => 0),
    countDistinctActiveUsers(null, excludeDemoIds),
    countDistinctActiveUsers(week, excludeDemoIds),
    db.show.groupBy({
      by: ['creatorId'],
      where: { isRadioShow: true, createdAt: { gte: month } },
      _count: { id: true },
    }).catch(() => [] as { creatorId: string; _count: { id: number } }[]),
    db.auditLog.findMany({
      where: { action: 'account_registered', createdAt: { gte: month } },
      select: { metadata: true, actorUserId: true },
      take: 2000,
    }).catch(() => []),
  ]);

  const djGroups = radioShowGroups.filter((g) => !demoIds.has(g.creatorId));
  const recurringDjs30d = djGroups.filter((g) => g._count.id >= 2).length;

  const channelMap = new Map<string, BetaInviteChannel>();
  for (const row of registrationAudits) {
    if (row.actorUserId && demoIds.has(row.actorUserId)) continue;
    const meta = row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? row.metadata as Record<string, unknown>
      : {};
    const code = typeof meta.inviteCode === 'string' && meta.inviteCode ? meta.inviteCode : '(no code)';
    const kind = typeof meta.inviteKind === 'string' && meta.inviteKind ? meta.inviteKind : '—';
    const entry = channelMap.get(code) ?? { code, kind, signups: 0 };
    entry.signups += 1;
    channelMap.set(code, entry);
  }
  const inviteChannels = [...channelMap.values()].sort((a, b) => b.signups - a.signups).slice(0, 12);

  return {
    totalUsers,
    signups7d,
    activatedUsers,
    activationRate: totalUsers > 0 ? activatedUsers / totalUsers : 0,
    weeklyActiveUsers,
    weeklyActiveRate: totalUsers > 0 ? weeklyActiveUsers / totalUsers : 0,
    radioDjs30d: djGroups.length,
    recurringDjs30d,
    inviteChannels,
  };
}
