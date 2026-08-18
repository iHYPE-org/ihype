import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { isAdminSession } from '@/lib/permissions';
import { WORKBENCH_PATH } from '@/lib/auth-redirects';
import { db } from '@/lib/db';

export const metadata = {
  title: 'Authorizations · Payment holds | Admin | iHYPE',
  robots: { index: false, follow: false },
};

function money(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '—';
  return `$${(cents / 100).toFixed(2)}`;
}

function count(value: number | null): string {
  return value === null ? '—' : String(value);
}

function day(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : '—';
}

/**
 * Stripe holds placed on ad campaign budgets.
 *
 * Ad billing is pre-auth-then-capture: a vetted campaign authorizes its full
 * quoted budget with `capture_method: 'manual'`, and the ad-settlement cron
 * captures only the `spentCents` actually delivered once `endsAt` passes — or
 * releases the hold outright if nothing aired.
 *
 * That leaves money sitting on an advertiser's card between those two moments,
 * and the only way to see it was one campaign at a time inside /admin/ads. A
 * hold that never settles is a card held against a campaign that has finished,
 * so the ended-but-still-held count is the point of this page.
 */
export default async function AdminPaymentHoldsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  if (!isAdminSession(session)) redirect(WORKBENCH_PATH);

  const now = new Date();

  const [held, awaiting, settledCount, heldAgg] = await Promise.all([
    // Authorized but not yet settled: the money actually on hold right now.
    db.ad
      .findMany({
        where: { authorizedAt: { not: null }, settledAt: null },
        orderBy: { authorizedAt: 'asc' },
        take: 200,
        select: {
          id: true,
          title: true,
          status: true,
          budgetCents: true,
          spentCents: true,
          impressions: true,
          authorizedAt: true,
          endsAt: true,
          stripePaymentIntentId: true,
        },
      })
      .catch(() => null),
    db.ad.count({ where: { status: 'AWAITING_PAYMENT' } }).catch(() => null),
    db.ad.count({ where: { settledAt: { not: null } } }).catch(() => null),
    db.ad
      .aggregate({
        where: { authorizedAt: { not: null }, settledAt: null },
        _sum: { budgetCents: true, spentCents: true },
      })
      .catch(() => null),
  ]);

  // A campaign whose run has ended but whose hold is still open. Settlement
  // shares the payouts cron slot daily, so anything here a day past endsAt was
  // missed by it.
  const overdue = (held ?? []).filter((a) => a.endsAt !== null && a.endsAt < now);

  const metrics: Array<[string, string]> = [
    ['Open holds', held === null ? '—' : String(held.length)],
    ['Authorized', heldAgg === null ? '—' : money(heldAgg._sum.budgetCents ?? 0)],
    ['Delivered', heldAgg === null ? '—' : money(heldAgg._sum.spentCents ?? 0)],
    ['Awaiting checkout', count(awaiting)],
    ['Settled to date', count(settledCount)],
    ['Ended, still held', held === null ? '—' : String(overdue.length)],
  ];

  return (
    <div className="container section admin-console">
      <section className="panel admin-console-panel">
        <h1 style={{ fontSize: '1.25rem', marginBottom: 4 }}>Payment holds</h1>
        <p className="meta">
          Ad campaign budgets authorized on Stripe and not yet captured or released. Campaign
          review is on <Link href="/admin/ads">Payments · Ad campaigns</Link>; device access is on{' '}
          <Link href="/admin/authorizations">Devices</Link>.
        </p>

        <div className="admin-metric-grid" style={{ marginBottom: 20 }}>
          {metrics.map(([label, value]) => (
            <article className="card admin-metric-card" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </article>
          ))}
        </div>

        {overdue.length > 0 && (
          <div className="empty" style={{ marginBottom: 16 }}>
            {overdue.length} campaign{overdue.length === 1 ? ' has' : 's have'} ended with the hold
            still open. Settlement runs daily, so anything more than a day past its end date did not
            settle and the advertiser&rsquo;s card is still held.
          </div>
        )}

        {held === null ? (
          <div className="empty">
            Holds could not be read. That is a failed query — it does not mean no money is on hold.
          </div>
        ) : held.length === 0 ? (
          <div className="empty">No open authorizations. Every campaign has been captured or released.</div>
        ) : (
          <div className="admin-list">
            {held.map((a) => {
              const isOverdue = a.endsAt !== null && a.endsAt < now;
              return (
                <div className="admin-list-row" key={a.id}>
                  <span>{a.title}</span>
                  <strong>{money(a.budgetCents)}</strong>
                  <small>
                    delivered {money(a.spentCents)} · {a.impressions} impression
                    {a.impressions === 1 ? '' : 's'} ·{' '}
                    <code>{a.stripePaymentIntentId ?? 'no payment intent'}</code>
                  </small>
                  <small>
                    {a.status} · held since {day(a.authorizedAt)} · ends {day(a.endsAt)}
                    {isOverdue ? ' · ENDED, STILL HELD' : ''}
                  </small>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
