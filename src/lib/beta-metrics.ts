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

async function distinctActiveUserIds(since: Date | null): Promise<Set<string>> {
  const createdAt = since ? { gte: since } : undefined;
  const [hypes, rsvps, listens] = await Promise.all([
    db.hypeEvent.findMany({ where: { createdAt }, select: { userId: true }, distinct: ['userId'] }).catch(() => []),
    db.showRsvp.findMany({ where: { createdAt }, select: { userId: true }, distinct: ['userId'] }).catch(() => []),
    db.mediaListen.findMany({ where: { createdAt }, select: { userId: true }, distinct: ['userId'] }).catch(() => []),
  ]);
  const ids = new Set<string>();
  for (const row of [...hypes, ...rsvps, ...listens]) ids.add(row.userId);
  return ids;
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

  const [totalUsers, signups7d, everActive, weeklyActive, radioShowGroups, registrationAudits] = await Promise.all([
    db.user.count({ where: { id: { notIn: [...demoIds] } } }).catch(() => 0),
    db.user.count({ where: { createdAt: { gte: week }, id: { notIn: [...demoIds] } } }).catch(() => 0),
    distinctActiveUserIds(null),
    distinctActiveUserIds(week),
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

  for (const id of demoIds) {
    everActive.delete(id);
    weeklyActive.delete(id);
  }

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
    activatedUsers: everActive.size,
    activationRate: totalUsers > 0 ? everActive.size / totalUsers : 0,
    weeklyActiveUsers: weeklyActive.size,
    weeklyActiveRate: totalUsers > 0 ? weeklyActive.size / totalUsers : 0,
    radioDjs30d: djGroups.length,
    recurringDjs30d,
    inviteChannels,
  };
}
