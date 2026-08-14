import { db } from '@/lib/db';
import { getAnalytics } from '@/lib/analytics-metrics';
import { getWorkbenchQueues, orderByUrgency, type WorkbenchQueue } from '@/lib/admin-workbench';
import type { AnalyticsRange } from '@/lib/analytics-engine';
import type { PulseItem, PulseSection, PulseSnapshot } from '@/lib/admin-pulse';

/**
 * The database half of the console's live board.
 *
 * Split from `admin-pulse.ts` because that module is imported by
 * `AdminPulse.tsx`, a CLIENT component: anything it can reach ends up in the
 * browser bundle, and `@/lib/db` deliberately imports the wasm/workerd Prisma
 * engine (see the comment at the top of it). The shapes and the one pure
 * ordering helper live there; every query lives here. Same arrangement as
 * `analytics-engine.ts` / `analytics-metrics.ts`.
 */

const HOUR_MS = 60 * 60 * 1000;

/** Every reader returns null rather than throwing, so one failure is one gap. */
async function safe<T>(read: () => Promise<T>): Promise<T | null> {
  try {
    return await read();
  } catch {
    return null;
  }
}

function ago(date: Date | null | undefined): string | null {
  return date ? date.toISOString() : null;
}

/**
 * ATTENTION — everything waiting on a human, hardest-waiting first.
 *
 * Reuses `getWorkbenchQueues()` rather than re-counting: those queues already
 * carry the turnaround the product actually promises (48h in all three
 * onboarding wizards) and already know when they are overdue. Re-implementing
 * that here would be a second opinion about whether an operator is late.
 */
async function attentionSection(): Promise<PulseSection> {
  const queues = await safe(() => getWorkbenchQueues());
  const ordered = queues ? orderByUrgency(queues) : [];
  const overdue = ordered.filter((q) => q.overdue);
  const waiting = ordered.filter((q) => q.count > 0);

  const total = queues ? waiting.reduce((sum, q) => sum + q.count, 0) : null;

  return {
    id: 'attention',
    label: 'Needs you',
    glyph: '⬟',
    summary: queues === null
      ? 'Queues could not be read.'
      : overdue.length > 0
        ? `${overdue.length} ${overdue.length === 1 ? 'queue is' : 'queues are'} past the turnaround you promise.`
        : waiting.length > 0
          ? `${total} waiting, all inside the promised turnaround.`
          : 'Nothing is waiting on you.',
    badge: total === null || total === 0 ? null : total,
    urgent: overdue.length > 0,
    stats: [],
    items: ordered.map((queue: WorkbenchQueue) => ({
      id: queue.id,
      label: `${queue.label} — ${queue.count}`,
      detail: queue.detail,
      href: queue.href,
      tone: queue.overdue ? 'bad' : queue.count > 0 ? 'warn' : 'ok',
      at: null,
    })),
  };
}

/**
 * LIVE — what is happening right now.
 *
 * Deliberately counts over 1h and 24h rather than a trend window: this is the
 * section that answers "is anything happening", which a 30-day figure cannot.
 */
async function liveSection(now: Date): Promise<PulseSection> {
  const hourAgo = new Date(now.getTime() - HOUR_MS);
  const dayAgo = new Date(now.getTime() - 24 * HOUR_MS);

  const [
    signupsHour, signupsDay,
    ordersHour, ordersDay,
    listensHour,
    activeDay,
    recentSignups,
    recentOrders,
  ] = await Promise.all([
    safe(() => db.user.count({ where: { createdAt: { gte: hourAgo } } })),
    safe(() => db.user.count({ where: { createdAt: { gte: dayAgo } } })),
    safe(() => db.ticketOrder.count({ where: { createdAt: { gte: hourAgo } } })),
    safe(() => db.ticketOrder.count({ where: { createdAt: { gte: dayAgo } } })),
    safe(() => db.mediaListen.count({ where: { createdAt: { gte: hourAgo } } })),
    safe(() => db.user.count({ where: { lastLoginAt: { gte: dayAgo } } })),
    safe(() => db.user.findMany({
      where: { createdAt: { gte: dayAgo } },
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: { id: true, email: true, username: true, role: true, createdAt: true },
    })),
    safe(() => db.ticketOrder.findMany({
      where: { createdAt: { gte: dayAgo } },
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: {
        id: true, status: true, quantity: true, totalChargeCents: true, createdAt: true,
        show: { select: { title: true, slug: true } },
      },
    })),
  ]);

  const items: PulseItem[] = [
    ...(recentSignups ?? []).map((user) => ({
      id: `signup-${user.id}`,
      label: `Signed up — ${user.username ?? user.email ?? 'account'}`,
      detail: `New ${String(user.role).toLowerCase()} account`,
      href: '/admin/users',
      tone: 'ok' as const,
      at: ago(user.createdAt),
    })),
    ...(recentOrders ?? []).map((order) => ({
      id: `order-${order.id}`,
      label: `${order.quantity} ticket${order.quantity === 1 ? '' : 's'} — ${order.show?.title ?? 'show'}`,
      detail: `${order.status} · $${(order.totalChargeCents / 100).toFixed(2)}`,
      href: order.show?.slug ? `/shows/${order.show.slug}` : '/admin/finance',
      // A RESERVED order is a held seat that may never be paid for — the same
      // distinction `tickets_sold` makes in the metric catalogue.
      tone: order.status === 'CAPTURED' ? 'ok' as const : 'warn' as const,
      at: ago(order.createdAt),
    })),
  ].sort((a, b) => (b.at ?? '').localeCompare(a.at ?? '')).slice(0, 10);

  const quiet = signupsDay === 0 && ordersDay === 0;

  return {
    id: 'live',
    label: 'Live',
    glyph: '◈',
    summary: quiet
      ? 'Nothing in the last 24 hours.'
      : `${signupsDay ?? '—'} signups and ${ordersDay ?? '—'} orders in 24h.`,
    badge: null,
    urgent: false,
    stats: [
      { id: 'signups_1h', label: 'Signups · 1h', help: 'Accounts created in the last hour.', value: signupsHour, previous: null, unit: 'count' },
      { id: 'signups_24h', label: 'Signups · 24h', help: 'Accounts created in the last 24 hours.', value: signupsDay, previous: null, unit: 'count' },
      { id: 'orders_1h', label: 'Orders · 1h', help: 'Ticket orders started in the last hour, any status.', value: ordersHour, previous: null, unit: 'count' },
      { id: 'orders_24h', label: 'Orders · 24h', help: 'Ticket orders started in the last 24 hours, any status.', value: ordersDay, previous: null, unit: 'count' },
      { id: 'listens_1h', label: 'Listens · 1h', help: 'Track plays recorded in the last hour.', value: listensHour, previous: null, unit: 'count' },
      { id: 'active_24h', label: 'Signed in · 24h', help: 'Accounts that signed in during the last 24 hours.', value: activeDay, previous: null, unit: 'count' },
    ],
    items,
  };
}

/**
 * MONEY — what has been taken, what is owed, what is stuck.
 *
 * `payouts_pending` is the one that matters operationally: a PENDING
 * `AccountsPayableEntry` on a show that has already ended is money the
 * platform owes and has not moved.
 */
async function moneySection(now: Date): Promise<PulseSection> {
  const dayAgo = new Date(now.getTime() - 24 * HOUR_MS);

  const [captured24h, refunds24h, pendingPayouts, releasedTotal, stalled, recentRefunds] = await Promise.all([
    safe(async () => (await db.ticketOrder.aggregate({
      where: { status: 'CAPTURED', chargedAt: { gte: dayAgo } },
      _sum: { totalChargeCents: true },
    }))._sum.totalChargeCents ?? 0),
    safe(() => db.ticketOrder.count({ where: { refundedAt: { gte: dayAgo } } })),
    safe(async () => (await db.accountsPayableEntry.aggregate({
      where: { status: 'PENDING' },
      _sum: { amountCents: true },
    }))._sum.amountCents ?? 0),
    safe(async () => (await db.accountsPayableEntry.aggregate({
      where: { status: 'RELEASED' },
      _sum: { amountCents: true },
    }))._sum.amountCents ?? 0),
    // Owed on a show that already ended: the payout cron should have moved it.
    safe(() => db.accountsPayableEntry.count({
      where: { status: 'PENDING', show: { startsAt: { lt: dayAgo } } },
    })),
    safe(() => db.ticketOrder.findMany({
      where: { refundedAt: { not: null } },
      orderBy: { refundedAt: 'desc' },
      take: 5,
      select: { id: true, totalChargeCents: true, refundedAt: true, show: { select: { title: true } } },
    })),
  ]);

  return {
    id: 'money',
    label: 'Money',
    glyph: '◆',
    summary: stalled === null
      ? 'Payout state could not be read.'
      : stalled > 0
        ? `${stalled} payout ${stalled === 1 ? 'entry is' : 'entries are'} still pending on a show that has ended.`
        : 'No payouts stalled.',
    badge: stalled && stalled > 0 ? stalled : null,
    urgent: Boolean(stalled && stalled > 0),
    stats: [
      { id: 'captured_24h', label: 'Captured · 24h', help: 'Charged to buyers in the last 24 hours.', value: captured24h, previous: null, unit: 'cents' },
      { id: 'payouts_pending', label: 'Owed', help: 'Payable entries not yet transferred.', value: pendingPayouts, previous: null, unit: 'cents' },
      { id: 'payouts_released', label: 'Paid out', help: 'Payable entries actually transferred, all time.', value: releasedTotal, previous: null, unit: 'cents' },
      { id: 'refunds_24h', label: 'Refunds · 24h', help: 'Orders refunded in the last 24 hours.', value: refunds24h, previous: null, unit: 'count' },
      { id: 'payouts_stalled', label: 'Stalled', help: 'Owed on a show that has already ended.', value: stalled, previous: null, unit: 'count' },
    ],
    items: (recentRefunds ?? []).map((order) => ({
      id: `refund-${order.id}`,
      label: `Refunded $${(order.totalChargeCents / 100).toFixed(2)} — ${order.show?.title ?? 'show'}`,
      detail: 'Buyer refunded in full',
      href: '/admin/finance',
      tone: 'warn' as const,
      at: ago(order.refundedAt),
    })),
  };
}

/**
 * GROWTH — the trend figures, straight from the catalogue.
 *
 * This section deliberately owns no queries of its own. Everything here is
 * `getAnalytics('platform', …)`, so `/admin` and `/admin/analytics` cannot
 * report different numbers for the same question.
 */
async function growthSection(range: AnalyticsRange, now: Date): Promise<PulseSection> {
  const analytics = await safe(() => getAnalytics('platform', { kind: 'platform' }, range, now));
  const metrics = analytics?.metrics ?? [];

  const rising = metrics.filter(
    (metric) => metric.value !== null && metric.previous !== null && metric.value > metric.previous,
  ).length;

  return {
    id: 'growth',
    label: 'Growth',
    glyph: '△',
    summary: analytics === null
      ? 'Analytics could not be read.'
      : metrics.length === 0
        ? 'No platform metrics are defined.'
        : `${rising} of ${metrics.length} measures are up on the previous period.`,
    badge: null,
    urgent: false,
    stats: metrics.map((metric) => ({
      id: metric.id,
      label: metric.label,
      help: metric.help,
      value: metric.value,
      previous: metric.previous,
      unit: metric.unit,
    })),
    items: [],
  };
}

/**
 * COMMS — everything the platform said, and everything said to it.
 *
 * Email delivery is the half nobody watches: `sendOperationalEmail` logs a
 * failure to Sentry, and Sentry is not the console. A failed send here is a
 * member who was never told their show was cancelled.
 */
async function commsSection(now: Date): Promise<PulseSection> {
  const dayAgo = new Date(now.getTime() - 24 * HOUR_MS);

  const [sent24h, failed24h, openSupport, recentEmails, recentSupport] = await Promise.all([
    safe(() => db.emailDeliveryLog.count({ where: { createdAt: { gte: dayAgo }, status: 'SENT' } })),
    safe(() => db.emailDeliveryLog.count({ where: { createdAt: { gte: dayAgo }, status: { not: 'SENT' } } })),
    safe(() => db.supportRequest.count({ where: { status: 'OPEN' } })),
    safe(() => db.emailDeliveryLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: { id: true, type: true, recipient: true, status: true, error: true, createdAt: true },
    })),
    safe(() => db.supportRequest.findMany({
      where: { status: 'OPEN' },
      orderBy: { createdAt: 'asc' },
      take: 6,
      select: { id: true, subject: true, type: true, email: true, createdAt: true },
    })),
  ]);

  return {
    id: 'comms',
    label: 'Comms',
    glyph: '✉',
    summary: failed24h === null
      ? 'Delivery log could not be read.'
      : failed24h > 0
        ? `${failed24h} email${failed24h === 1 ? '' : 's'} failed to send in the last 24 hours.`
        : `${sent24h ?? '—'} sent in 24h, none failed.`,
    badge: failed24h && failed24h > 0 ? failed24h : null,
    urgent: Boolean(failed24h && failed24h > 0),
    stats: [
      { id: 'email_sent_24h', label: 'Sent · 24h', help: 'Emails delivered in the last 24 hours.', value: sent24h, previous: null, unit: 'count' },
      { id: 'email_failed_24h', label: 'Failed · 24h', help: 'Emails that did not send in the last 24 hours.', value: failed24h, previous: null, unit: 'count' },
      { id: 'support_open', label: 'Open support', help: 'Support requests nobody has answered.', value: openSupport, previous: null, unit: 'count' },
    ],
    items: [
      ...(recentSupport ?? []).map((request) => ({
        id: `support-${request.id}`,
        label: request.subject,
        detail: `${request.type} · ${request.email ?? 'no address'}`,
        href: '/admin/moderation',
        tone: 'warn' as const,
        at: ago(request.createdAt),
      })),
      ...(recentEmails ?? []).map((email) => ({
        id: `email-${email.id}`,
        label: `${email.type} → ${email.recipient}`,
        detail: email.status === 'SENT' ? 'Delivered' : `Failed — ${email.error ?? 'no reason recorded'}`,
        href: '/admin/audit',
        tone: email.status === 'SENT' ? 'ok' as const : 'bad' as const,
        at: ago(email.createdAt),
      })),
    ].slice(0, 12),
  };
}

/**
 * SYSTEM — is the platform itself healthy.
 *
 * Kept to things with an operator action behind them. `/api/health` and the
 * heartbeat answer "is it up"; this answers "is it misbehaving".
 */
async function systemSection(now: Date): Promise<PulseSection> {
  const dayAgo = new Date(now.getTime() - 24 * HOUR_MS);

  const [spamFlags, heldTracks, failedLogins, recentAudit] = await Promise.all([
    safe(() => db.notification.count({ where: { type: 'SPAM_FLAG', createdAt: { gte: dayAgo } } })),
    safe(() => db.contentReport.count({ where: { status: 'OPEN', targetType: 'track' } })),
    safe(() => db.auditLog.count({
      where: { action: { contains: 'rate_limited' }, createdAt: { gte: dayAgo } },
    })),
    safe(() => db.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: { id: true, action: true, entityType: true, createdAt: true },
    })),
  ]);

  return {
    id: 'system',
    label: 'System',
    glyph: '⚙',
    summary: spamFlags && spamFlags > 0
      ? `${spamFlags} spam flag${spamFlags === 1 ? '' : 's'} raised in 24h.`
      : 'Nothing unusual in the last 24 hours.',
    badge: null,
    urgent: false,
    stats: [
      { id: 'spam_flags_24h', label: 'Spam flags · 24h', help: 'Accounts auto-flagged in the last 24 hours.', value: spamFlags, previous: null, unit: 'count' },
      { id: 'held_tracks', label: 'Held tracks', help: 'Uploads flagged and awaiting a decision.', value: heldTracks, previous: null, unit: 'count' },
      { id: 'rate_limited_24h', label: 'Rate limited · 24h', help: 'Requests refused by a rate limiter in the last 24 hours.', value: failedLogins, previous: null, unit: 'count' },
    ],
    items: (recentAudit ?? []).map((entry) => ({
      id: `audit-${entry.id}`,
      label: entry.action,
      detail: entry.entityType,
      href: '/admin/audit',
      tone: 'ok' as const,
      at: ago(entry.createdAt),
    })),
  };
}

/**
 * Assembles the whole snapshot.
 *
 * Sections run concurrently and each is already failure-tolerant, so the
 * snapshot always has six sections — a section that could not read its data
 * says so in its own summary rather than vanishing. A missing section and a
 * section reading zero look identical while scanning, which is the same
 * reasoning that keeps clear queues on the workbench board.
 */
export async function getAdminPulse(
  range: AnalyticsRange = '30d',
  now: Date = new Date(),
): Promise<PulseSnapshot> {
  const sections = await Promise.all([
    attentionSection(),
    liveSection(now),
    moneySection(now),
    growthSection(range, now),
    commsSection(now),
    systemSection(now),
  ]);

  return {
    capturedAt: now.toISOString(),
    range,
    sections,
  };
}

/**
 * Sections worth opening the console for, hardest first.
 *
 * Pure, so it is tested without a database. Urgent before not; within each,
 * the larger badge first; a section with no badge sorts last among its peers
 * rather than above them.
 */
export function orderPulseSections(sections: PulseSection[]): PulseSection[] {
  return [...sections].sort((a, b) => {
    if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
    return (b.badge ?? -1) - (a.badge ?? -1);
  });
}
