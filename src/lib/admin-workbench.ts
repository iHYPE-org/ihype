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
 * `POST /api/beta-access-request` records the ask twice: an append-only
 * `AuditLog` row, and an `AccessRequest` row that an operator can actually
 * decide at /admin/users?tab=requests. This counts the second.
 *
 * It used to scan the audit log, because that was all there was — 500 rows
 * over 90 days, deduplicated by address in memory, which under-counted a
 * busier funnel and could not tell an approved request from an untouched one.
 * The table it reads now is already one row per address and carries the
 * decision, so the count is exact and a request an operator has already
 * handled leaves the queue.
 *
 * The second query stays, and it is the reason this is not a bare `count()`:
 * an address that has since acquired an account got in by another door, and
 * a queue that goes on demanding attention for somebody already inside is a
 * queue people learn to ignore. That clears itself with nothing to mark off
 * by hand — the same rule the tab renders as "Signed up".
 *
 * Both queries are caught together, like every other count here: a failure
 * hides the badge rather than claiming zero.
 */
async function pendingAccessRequests(): Promise<{ count: number; oldest: Date | null }> {
  const SCAN = 500;
  try {
    const rows = await db.accessRequest.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      take: SCAN,
      select: { email: true, createdAt: true },
    });
    if (rows.length === 0) return { count: 0, oldest: null };

    const onboarded = await db.user.findMany({
      where: { email: { in: rows.map((r) => r.email), mode: 'insensitive' } },
      select: { email: true },
    });
    const hasAccount = new Set(onboarded.map((u) => (u.email ?? '').trim().toLowerCase()));

    // Ordered oldest-first above, so the first survivor IS the longest wait.
    const waiting = rows.filter((r) => !hasAccount.has(r.email.trim().toLowerCase()));
    return { count: waiting.length, oldest: waiting[0]?.createdAt ?? null };
  } catch {
    return { count: 0, oldest: null };
  }
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
      '/admin/users?tab=requests',
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
