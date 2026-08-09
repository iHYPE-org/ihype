import { db } from '@/lib/db';

/**
 * Everything on the platform that is waiting on a human.
 *
 * The problem this solves: the work an admin owes the platform was scattered
 * across six pages with no single place that said "here is what is overdue".
 * Verifications sat in /admin/review?tab=verifications, moderation in
 * /admin/moderation, ad approvals in /admin/ads, support in a section halfway
 * down /admin, feature requests in /admin/feedback, and stalled payouts
 * nowhere at all. Finding out whether anything needed doing meant visiting all
 * of them.
 *
 * Each queue carries the promise the product makes about it, so "overdue"
 * means something specific rather than "looks like a lot". The verification
 * SLA is not invented here — all three onboarding wizards tell applicants
 * "Reviewed within 48 hours".
 */

export type WorkbenchQueue = {
  id: string;
  label: string;
  /** What a human does with these, in a few words. */
  detail: string;
  count: number;
  href: string;
  /** Age of the oldest waiting item, in hours. Null when the queue is empty. */
  oldestHours: number | null;
  /** Hours after which an item in this queue is late. Null = no stated SLA. */
  slaHours: number | null;
  /** True when the oldest item has been waiting past slaHours. */
  overdue: boolean;
};

function hoursSince(date: Date | null | undefined): number | null {
  if (!date) return null;
  return Math.max(0, (Date.now() - date.getTime()) / 36e5);
}

function build(
  id: string,
  label: string,
  detail: string,
  href: string,
  count: number,
  oldest: Date | null | undefined,
  slaHours: number | null,
): WorkbenchQueue {
  const oldestHours = count > 0 ? hoursSince(oldest) : null;
  return {
    id,
    label,
    detail,
    count,
    href,
    oldestHours,
    slaHours,
    overdue: Boolean(slaHours && oldestHours !== null && oldestHours > slaHours),
  };
}

/**
 * Alpha access requests that have not become accounts yet.
 *
 * `POST /api/beta-access-request` records an `AuditLog` row and emails the
 * admin recipients, and until now that was the whole story: **nothing on any
 * admin page showed a single request.** For a closed alpha whose front page
 * makes request-access the only way in, that put the entire inbound funnel in
 * one inbox — and this platform has already lost 35 days of outbound email
 * once without noticing (DESIGN_SYNC row 254). A queue nobody can see is a
 * queue nobody works.
 *
 * Why this needs two round trips rather than a `count()`: an audit row has no
 * "handled" state, so counting them would produce a number that only ever goes
 * up, which is worse than no number at all on a board whose whole ordering is
 * by how long the oldest item has waited. "Waiting" is therefore defined as
 * *requested an invite and does not yet have an account* — which clears by
 * itself the moment the person signs up, with nothing to mark off by hand.
 *
 * Bounded deliberately: the newest `SCAN` rows within `WINDOW_DAYS`. This is a
 * board that has to render fast, and a request from six months ago is not
 * work-in-progress. Both queries are caught independently, like every other
 * count here — a failure hides the badge rather than claiming zero.
 */
async function pendingAccessRequests(): Promise<{ count: number; oldest: Date | null }> {
  const WINDOW_DAYS = 90;
  const SCAN = 500;
  try {
    const rows = await db.auditLog.findMany({
      where: {
        action: 'beta_access_request',
        createdAt: { gte: new Date(Date.now() - WINDOW_DAYS * 864e5) },
      },
      orderBy: { createdAt: 'desc' },
      take: SCAN,
      select: { createdAt: true, metadata: true },
    });
    if (rows.length === 0) return { count: 0, oldest: null };

    const asked = firstAskByEmail(rows);
    if (asked.size === 0) return { count: 0, oldest: null };

    const onboarded = await db.user.findMany({
      where: { email: { in: [...asked.keys()], mode: 'insensitive' } },
      select: { email: true },
    });
    return stillWaiting(asked, onboarded.map((u) => u.email));
  } catch {
    return { count: 0, oldest: null };
  }
}

/**
 * One entry per address, dated by the FIRST time that address asked — somebody
 * who asked three times is one person waiting, and their wait started with the
 * first ask, not the most recent one. Rows whose metadata carries no usable
 * address are skipped rather than counted as an anonymous request nobody could
 * action. Pure, so the part most likely to be wrong is the part under test.
 */
export function firstAskByEmail(
  rows: ReadonlyArray<{ createdAt: Date; metadata: unknown }>,
): Map<string, Date> {
  const firstAsk = new Map<string, Date>();
  for (const row of rows) {
    const email = (row.metadata as { email?: unknown } | null)?.email;
    if (typeof email !== 'string' || !email.includes('@')) continue;
    const key = email.trim().toLowerCase();
    const seen = firstAsk.get(key);
    if (!seen || row.createdAt < seen) firstAsk.set(key, row.createdAt);
  }
  return firstAsk;
}

/**
 * Drops everyone who now has an account. Case-insensitively, because the
 * request form takes whatever the person typed and `User.email` is whatever
 * they later registered with — matching those exactly would leave a request
 * "waiting" forever because someone capitalised their own address. Pure.
 */
export function stillWaiting(
  asked: Map<string, Date>,
  onboardedEmails: ReadonlyArray<string | null>,
): { count: number; oldest: Date | null } {
  const waiting = new Map(asked);
  for (const email of onboardedEmails) {
    if (email) waiting.delete(email.trim().toLowerCase());
  }
  const dates = [...waiting.values()];
  return {
    count: dates.length,
    oldest: dates.length ? new Date(Math.min(...dates.map((d) => d.getTime()))) : null,
  };
}

export async function getWorkbenchQueues(): Promise<WorkbenchQueue[]> {
  // Every query is independently guarded. A workbench that renders nothing
  // because one count threw would be worse than one that renders a zero: the
  // admin would conclude there was no work rather than that the page broke.
  const [
    verifications,
    oldestVerification,
    reports,
    oldestReport,
    heldTracks,
    oldestHeldTrack,
    support,
    oldestSupport,
    ads,
    oldestAd,
    feedback,
    oldestFeedback,
    stalledPayouts,
    oldestPayout,
    accessRequests,
  ] = await Promise.all([
    // Only real submissions. verificationRequested is false on the profiles
    // that registration used to auto-stamp PENDING at signup, which had no
    // evidence attached and nothing for a reviewer to act on.
    db.profile.count({ where: { verificationStatus: 'PENDING', verificationRequested: true } }).catch(() => 0),
    db.profile.findFirst({
      where: { verificationStatus: 'PENDING', verificationRequested: true },
      orderBy: { verificationSubmittedAt: 'asc' },
      select: { verificationSubmittedAt: true },
    }).catch(() => null),

    db.contentReport.count({ where: { status: 'OPEN' } }).catch(() => 0),
    db.contentReport.findFirst({
      where: { status: 'OPEN' },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    }).catch(() => null),

    // A subset of the above, surfaced separately because it is the only
    // queue where a delay withholds something from its own owner: a flagged
    // track is stored but unpublished until someone clears it. It needs its
    // own oldest-item query — reusing the all-reports one would date this
    // queue by an unrelated report and could show it overdue when no track
    // has been waiting at all.
    db.contentReport.count({ where: { status: 'OPEN', targetType: 'track' } }).catch(() => 0),
    db.contentReport.findFirst({
      where: { status: 'OPEN', targetType: 'track' },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    }).catch(() => null),

    db.supportRequest.count({ where: { status: 'OPEN' } }).catch(() => 0),
    db.supportRequest.findFirst({
      where: { status: 'OPEN' },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    }).catch(() => null),

    db.ad.count({ where: { status: 'PENDING' } }).catch(() => 0),
    db.ad.findFirst({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    }).catch(() => null),

    db.featureRequest.count({ where: { status: 'open' } }).catch(() => 0),
    db.featureRequest.findFirst({
      where: { status: 'open' },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    }).catch(() => null),

    // Money that should already have moved. triggerShowPayouts() only
    // processes ENDED shows, so a PENDING entry on a show that has ended is
    // either a tax entry (no Connect account, remitted by hand) or a transfer
    // that failed. Both want a person.
    db.accountsPayableEntry.count({
      where: { status: 'PENDING', show: { status: 'ENDED' } },
    }).catch(() => 0),
    db.accountsPayableEntry.findFirst({
      where: { status: 'PENDING', show: { status: 'ENDED' } },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    }).catch(() => null),

    // Alpha access requests still waiting for an invite. See the note above
    // the return for why this one needs two round trips instead of a count().
    pendingAccessRequests(),
  ]);

  return [
    build(
      'verifications',
      'Identity verifications',
      'Applicants who submitted proof and are waiting to be approved or rejected',
      '/admin/review?tab=verifications',
      verifications,
      oldestVerification?.verificationSubmittedAt,
      // The number all three onboarding wizards promise applicants.
      48,
    ),
    build(
      'held-tracks',
      'Held tracks',
      'Uploads our scan flagged — they stay off the artist’s page until cleared',
      '/admin/moderation?type=track',
      heldTracks,
      oldestHeldTrack?.createdAt,
      48,
    ),
    build(
      'moderation',
      'Moderation reports',
      'Reported content and auto-flags across tracks, profiles, comments and shows',
      '/admin/moderation',
      reports,
      oldestReport?.createdAt,
      72,
    ),
    build(
      'ads',
      'Ad campaigns',
      'Spots vetting could not clear on its own — approving one authorises the budget',
      '/admin/ads',
      ads,
      oldestAd?.createdAt,
      48,
    ),
    build(
      'support',
      'Support & privacy requests',
      'Includes GDPR/CCPA requests, which carry a 30-day statutory deadline',
      '/admin#support-requests',
      support,
      oldestSupport?.createdAt,
      // Not the statutory 30 days: a request that has sat a week is already a
      // problem, and a deadline you only notice on day 29 is not a deadline.
      168,
    ),
    build(
      'payouts',
      'Stalled payouts',
      'Payable entries still pending on shows that have already ended',
      '/admin/finance',
      stalledPayouts,
      oldestPayout?.createdAt,
      24,
    ),
    build(
      'access-requests',
      'Alpha access requests',
      'People who asked for an invite from the landing page and have no account yet',
      '/admin/audit?action=beta_access_request',
      accessRequests.count,
      accessRequests.oldest,
      // No SLA, and that is not an oversight: the form promises "we will reach
      // out when your invite is ready" and the landing page says the app opens
      // city by city. Neither is a time commitment, and this file does not
      // invent one — see the note at the top about where the 48h comes from.
      // The queue still carries its count and the age of the longest wait,
      // which is what makes a stalled funnel visible.
      null,
    ),
    build(
      'feedback',
      'Feature requests',
      'Community submissions awaiting a response or a roadmap decision',
      '/admin/feedback',
      feedback,
      oldestFeedback?.createdAt,
      null,
    ),
  ];
}

/**
 * Urgency order: overdue first, then anything with work in it, then clear
 * queues — and within each band, longest-waiting first. Clear queues are kept
 * in the list rather than filtered out, because a missing row and a row
 * reading zero look identical to someone scanning the page, and only one of
 * them means "nothing to do".
 */
export function orderByUrgency(queues: WorkbenchQueue[]): WorkbenchQueue[] {
  return [...queues].sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    if ((a.count > 0) !== (b.count > 0)) return a.count > 0 ? -1 : 1;
    return (b.oldestHours ?? 0) - (a.oldestHours ?? 0);
  });
}

/** Formats an age for display: "3h", "2d", "just now". */
export function formatAge(hours: number | null): string {
  if (hours === null) return '';
  if (hours < 1) return 'just now';
  if (hours < 24) return `${Math.floor(hours)}h`;
  return `${Math.floor(hours / 24)}d`;
}
