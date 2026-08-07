import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { isAdminSession } from '@/lib/permissions';
import { WORKBENCH_PATH } from '@/lib/auth-redirects';
import { getServerT } from '@/lib/i18n/server';
import {
  ANALYTICS_RANGES,
  type AnalyticsRange,
  deltaPercent,
  formatDelta,
  formatMetricValue,
  isAnalyticsRange,
} from '@/lib/analytics-engine';
import { getAnalytics, getAudienceBreakdown } from '@/lib/analytics-metrics';

export const metadata = {
  title: 'Analytics | Admin | iHYPE',
  robots: { index: false, follow: false },
};

const RANGE_LABEL: Record<AnalyticsRange, string> = {
  '7d': '7 days',
  '30d': '30 days',
  '90d': '90 days',
  ytd: 'Year to date',
  all: 'All time',
};

/**
 * Platform analytics, from the shared engine.
 *
 * Every figure comes from `analytics-metrics.ts` — the same module the per-type
 * surfaces read — so a number shown to an operator and the same number shown to
 * the account it describes cannot drift apart. That was the point of building
 * the engine: five surfaces held five inline implementations of one question.
 *
 * An em dash means the figure could not be read. It never means zero.
 */
export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams?: Promise<{ range?: string }>;
}) {
  const t = await getServerT();
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  if (!isAdminSession(session)) redirect(WORKBENCH_PATH);

  const params = searchParams ? await searchParams : {};
  const range: AnalyticsRange = isAnalyticsRange(params.range) ? params.range : '30d';

  const [{ metrics, range: resolved }, breakdown] = await Promise.all([
    getAnalytics('platform', { kind: 'platform' }, range),
    getAudienceBreakdown(range),
  ]);

  return (
    <div className="container section admin-console">
      <div className="panel admin-console-panel">
        <div className="admin-console-panel-head">
          <h1 style={{ fontSize: 20, margin: 0 }}>{t('adminAnalyticsPage.heading', 'Analytics')}</h1>
        </div>

        <p className="meta" style={{ marginBottom: 14 }}>
          {t('adminAnalyticsPage.intro', 'Each figure is compared with the equally long period immediately before it. A dash means the number could not be read — it does not mean zero.')}
        </p>

        <nav aria-label={t('adminAnalyticsPage.rangeLabel', 'Time range')} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {ANALYTICS_RANGES.map((option) => (
            <Link
              aria-current={option === range ? 'page' : undefined}
              className={option === range ? 'badge' : 'button secondary'}
              href={`/admin/analytics?range=${option}`}
              key={option}
              style={{ textDecoration: 'none', fontSize: 12, padding: '6px 12px' }}
            >
              {RANGE_LABEL[option]}
            </Link>
          ))}
        </nav>

        <h2 style={{ fontSize: 15, marginBottom: 10 }}>
          {t('adminAnalyticsPage.platformHeading', 'Platform')} · {resolved.days}d
        </h2>
        <div className="admin-health-grid" style={{ marginBottom: 24 }}>
          {metrics.map((metric) => {
            const delta = deltaPercent(metric.value, metric.previous);
            return (
              <div className="admin-health-card" key={metric.id} title={metric.help}>
                <span>{metric.label}</span>
                <strong>{formatMetricValue(metric.value, metric.unit)}</strong>
                <span
                  style={{
                    textTransform: 'none',
                    color: delta === null ? 'var(--muted)' : delta > 0 ? 'var(--role-venue)' : delta < 0 ? 'var(--warning-text)' : 'var(--muted)',
                  }}
                >
                  {formatDelta(delta)} vs {formatMetricValue(metric.previous, metric.unit)}
                </span>
              </div>
            );
          })}
        </div>

        <h2 style={{ fontSize: 15, marginBottom: 4 }}>{t('adminAnalyticsPage.byTypeHeading', 'By account type')}</h2>
        <p className="meta" style={{ marginBottom: 10 }}>
          {t('adminAnalyticsPage.activeDefinition', 'Active means the account hyped or listened in this period. The same definition for every type, so the column can be read down.')}
        </p>
        <div className="admin-list">
          {breakdown.map((row) => {
            const share = row.accounts !== null && row.active !== null && row.accounts > 0
              ? (row.active / row.accounts) * 100
              : null;
            return (
              <div className="admin-list-row" key={row.audience}>
                <strong>{row.label}</strong>
                <span className="meta">
                  {formatMetricValue(row.accounts, 'count')} {t('adminAnalyticsPage.accountsWord', 'accounts')}
                  {' · '}
                  {formatMetricValue(row.active, 'count')} {t('adminAnalyticsPage.activeWord', 'active')}
                  {' · '}
                  {formatMetricValue(share, 'percent')}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
