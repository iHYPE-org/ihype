import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import {
  getPromoterDashboard,
  getPromoterEarningsSeries,
  getPromoterTopLinks,
  type PromoterAnalyticsRange,
} from '@/lib/promoterDashboard';
import { formatCurrencyFromCents } from '@/lib/ticketing';
import { getBaseUrl } from '@/lib/utils';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Promoter Analytics · iHYPE',
  description: 'Clicks, conversion, and earnings from your HYPE Links.',
  robots: { index: false, follow: false },
};

const RANGES: { key: PromoterAnalyticsRange; label: string }[] = [
  { key: '7d', label: '7 Days' },
  { key: '30d', label: '30 Days' },
  { key: 'ytd', label: 'YTD' },
];

function isValidRange(v: string | undefined): v is PromoterAnalyticsRange {
  return v === '7d' || v === '30d' || v === 'ytd';
}

export default async function PromoterAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/me/promote/analytics');
  }

  const { range: rangeParam } = await searchParams;
  const range: PromoterAnalyticsRange = isValidRange(rangeParam) ? rangeParam : '30d';

  const [d, series, topLinks] = await Promise.all([
    getPromoterDashboard(session.user.id),
    getPromoterEarningsSeries(session.user.id, range),
    getPromoterTopLinks(session.user.id),
  ]);

  const baseUrl = getBaseUrl();

  // Derived stats — trivial arithmetic on already-fetched lifetime totals,
  // no new queries. Guarded against divide-by-zero.
  const conversionRate = d.clicks > 0 ? (d.ticketsSold / d.clicks) * 100 : 0;
  const avgPerTicketCents = d.ticketsSold > 0 ? Math.round(d.earnedCents / d.ticketsSold) : 0;

  const maxBucketCents = Math.max(1, ...series.map((s) => s.earnedCents));

  // NOTE: the design mock's per-card "+18% this month" deltas are omitted —
  // computing a real prior-period comparison for every stat card would mean
  // duplicating each lifetime query with a second date-bounded window for a
  // number of marginal value; the range tabs below drive a real, honest
  // period-bounded view (the earnings chart) instead of fabricating deltas
  // on lifetime totals.

  return (
    <div className="pa-page">
      <div className="pa-header">
        <h1>Promoter Analytics</h1>
        <p>Clicks, conversion, and earnings from your HYPE Links</p>
      </div>

      <div className="pa-stats-grid">
        <div className="pa-stat-card">
          <div className="pa-stat-label">Total Clicks</div>
          <div className="pa-stat-value">{d.clicks.toLocaleString()}</div>
          <div className="pa-stat-sub">Lifetime, all HYPE Links</div>
        </div>
        <div className="pa-stat-card">
          <div className="pa-stat-label">Tickets Driven</div>
          <div className="pa-stat-value">{d.ticketsSold.toLocaleString()}</div>
          <div className="pa-stat-sub">{d.clicks > 0 ? `${conversionRate.toFixed(1)}% conversion` : 'No clicks yet'}</div>
        </div>
        <div className="pa-stat-card">
          <div className="pa-stat-label">Total Earned</div>
          <div className="pa-stat-value">{formatCurrencyFromCents(d.earnedCents)}</div>
          <div className="pa-stat-sub">Lifetime · {d.ordersDriven} order{d.ordersDriven === 1 ? '' : 's'}</div>
        </div>
        <div className="pa-stat-card">
          <div className="pa-stat-label">Avg per Ticket</div>
          <div className="pa-stat-value">{d.ticketsSold > 0 ? formatCurrencyFromCents(avgPerTicketCents) : '—'}</div>
          <div className="pa-stat-sub">Share of 10% pool</div>
        </div>
      </div>

      <div className="pa-chart-card">
        <div className="pa-chart-head">
          <div>
            <div className="pa-chart-title">Earnings over time</div>
            <div className="pa-chart-sub">Real promoter-pool payouts, bucketed by {range === '7d' ? 'day' : range === '30d' ? 'week' : 'month'}</div>
          </div>
          <div className="pa-range-tabs">
            {RANGES.map((r) => (
              <Link
                key={r.key}
                href={`/me/promote/analytics?range=${r.key}`}
                className={`pa-range-tab${r.key === range ? ' pa-range-tab-active' : ''}`}
              >
                {r.label}
              </Link>
            ))}
          </div>
        </div>
        {series.every((s) => s.earnedCents === 0) ? (
          <div className="pa-chart-empty">No earnings in this period yet.</div>
        ) : (
          <div className="pa-chart-bars">
            {series.map((s, i) => (
              <div className="pa-chart-bar-col" key={i} title={`${s.label}: ${formatCurrencyFromCents(s.earnedCents)}`}>
                <div
                  className="pa-chart-bar"
                  style={{ height: `${Math.max(4, Math.round((s.earnedCents / maxBucketCents) * 100))}%` }}
                />
                <div className="pa-chart-bar-label">{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="pa-links-card">
        <div className="pa-links-head">Top-performing links</div>
        {topLinks.length === 0 ? (
          <div className="pa-links-empty">
            <p>No link activity yet — share your HYPE Link to start earning.</p>
          </div>
        ) : (
          topLinks.map((l) => (
            <div className="pa-link-row" key={l.hexId}>
              <span className="pa-link-url">{`${baseUrl}/h/${l.hexId}`}</span>
              <div className="pa-link-stats">
                <span className="pa-link-clicks">{l.clicks.toLocaleString()} click{l.clicks === 1 ? '' : 's'}</span>
                <span className="pa-link-earned">{formatCurrencyFromCents(l.earnedCents)}</span>
              </div>
            </div>
          ))
        )}
      </div>

      <p className="pa-foot">
        <Link href="/me/promote">Back to Promoter Dashboard</Link>
      </p>

      <style>{`
        .pa-page { max-width: 1000px; margin: 0 auto; padding: 32px 24px 100px; }
        .pa-header { margin-bottom: 32px; }
        .pa-header h1 { font-family: var(--font-display); font-size: 28px; font-weight: 800; letter-spacing: -.02em; margin-bottom: 6px; color: var(--ink); }
        .pa-header p { font-size: 14px; color: var(--ink-a60); }
        .pa-stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(180px, 100%), 1fr)); gap: 16px; margin-bottom: 24px; }
        .pa-stat-card { border: 1px solid var(--line); border-radius: var(--radius-md); padding: 20px; background: var(--bg2); }
        .pa-stat-label { font-family: var(--font-mono); font-size: 10.5px; text-transform: uppercase; letter-spacing: .14em; color: var(--ink-a50); margin-bottom: 8px; }
        .pa-stat-value { font-family: var(--font-display); font-size: 26px; font-weight: 700; color: var(--role-promoter, #ff3e9a); }
        .pa-stat-sub { font-size: 12px; color: var(--ink-a50); margin-top: 4px; }

        .pa-chart-card { border: 1px solid var(--line); border-radius: var(--radius-lg); padding: 24px; background: var(--bg2); margin-bottom: 24px; }
        .pa-chart-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
        .pa-chart-title { font-family: var(--font-display); font-weight: 800; font-size: 16px; color: var(--ink); }
        .pa-chart-sub { font-size: 12px; color: var(--ink-a50); margin-top: 2px; }
        .pa-range-tabs { display: flex; gap: 4px; border: 1px solid var(--line); border-radius: var(--radius-pill); padding: 3px; }
        .pa-range-tab { font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: .08em; padding: 6px 12px; border-radius: var(--radius-pill); text-decoration: none; color: var(--ink-a60); }
        .pa-range-tab-active { background: var(--role-promoter, #ff3e9a); color: #fff; }
        .pa-chart-bars { display: flex; align-items: flex-end; gap: 10px; height: 140px; }
        .pa-chart-bar-col { flex: 1; display: flex; flex-direction: column; align-items: stretch; justify-content: flex-end; height: 100%; }
        .pa-chart-bar { width: 100%; background: linear-gradient(180deg, var(--role-promoter, #ff3e9a), rgba(255,62,154,.25)); border-radius: 6px 6px 0 0; min-height: 4px; }
        .pa-chart-bar-label { font-family: var(--font-mono); font-size: 10px; color: var(--ink-a50); text-align: center; margin-top: 6px; }
        .pa-chart-empty { text-align: center; padding: 30px 0; color: var(--ink-a50); font-size: 13px; }

        .pa-links-card { border: 1px solid var(--line); border-radius: var(--radius-lg); background: var(--bg2); overflow: hidden; margin-bottom: 24px; }
        .pa-links-head { padding: 16px 20px; border-bottom: 1px solid var(--line); font-family: var(--font-mono); font-size: 10.5px; text-transform: uppercase; letter-spacing: .14em; color: var(--ink-a50); }
        .pa-link-row { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--line); gap: 12px; flex-wrap: wrap; }
        .pa-link-row:last-child { border-bottom: none; }
        .pa-link-url { font-family: var(--font-mono); font-size: 12px; color: var(--ink); word-break: break-all; }
        .pa-link-stats { display: flex; gap: 20px; flex-shrink: 0; }
        .pa-link-clicks { font-size: 12px; color: var(--ink-a50); }
        .pa-link-earned { font-size: 12px; font-weight: 700; color: var(--role-promoter, #ff3e9a); }
        .pa-links-empty { text-align: center; padding: 40px 24px; color: var(--ink-a50); }
        .pa-links-empty p { margin: 0; }

        .pa-foot { text-align: center; font-size: 13px; margin-top: 8px; }
        .pa-foot a { color: var(--ink-a60); text-decoration: none; }
        .pa-foot a:hover { color: var(--ink); text-decoration: underline; }

        @media (max-width: 600px) {
          .pa-page { padding: 24px 16px 100px; }
        }
      `}</style>
    </div>
  );
}
