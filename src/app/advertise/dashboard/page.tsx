import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import Link from 'next/link';
import { CampaignCancelButton } from '@/components/CampaignCancelButton';

export const dynamic = 'force-dynamic';

export default async function AdvertiserDashboard() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?callbackUrl=/advertise/dashboard');

  // Show the user's own campaigns using the new Ad model
  const [campaigns, advertiserAccount] = await Promise.all([
    db.ad.findMany({
      where: { advertiserId: session.user.id },
      include: { slot: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    db.advertiserAccount.findUnique({
      where: { userId: session.user.id },
      select: { companyName: true, website: true },
    }),
  ]);

  const totalImpressions = campaigns.reduce((s, c) => s + c.impressions, 0);
  const totalSpentCents = campaigns.reduce((s, c) => s + c.spentCents, 0);
  const totalBudgetCents = campaigns.reduce((s, c) => s + c.budgetCents, 0);
  // Effective CPM — real cost-per-1000-impressions derived from actual spend,
  // not a fabricated rate. Undefined (rendered as "—") until there's at least
  // one impression to divide by.
  const effectiveCpmCents = totalImpressions > 0 ? (totalSpentCents / totalImpressions) * 1000 : null;
  const activeCampaigns = campaigns.filter((c) => c.status === 'APPROVED').length;

  // Day-by-day breakdown, last 14 days, aggregated across all the
  // advertiser's campaigns. AdImpression rows have no per-day rollup
  // column, and Prisma can't truncate a timestamp to a date in a groupBy
  // without raw SQL, so this fetches the raw rows for the window and
  // buckets them in JS — fine at this volume (a self-serve advertiser's
  // own campaigns, 14 days).
  const DAYS = 14;
  const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000);
  const dailyImpressions = campaigns.length
    ? await db.adImpression.findMany({
        where: { adId: { in: campaigns.map((c) => c.id) }, createdAt: { gte: since } },
        select: { createdAt: true },
      })
    : [];

  const dayBuckets = new Map<string, number>();
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    dayBuckets.set(d.toISOString().slice(0, 10), 0);
  }
  for (const row of dailyImpressions) {
    const key = row.createdAt.toISOString().slice(0, 10);
    if (dayBuckets.has(key)) dayBuckets.set(key, (dayBuckets.get(key) ?? 0) + 1);
  }
  const dailyRows = Array.from(dayBuckets.entries());
  const maxDaily = Math.max(1, ...dailyRows.map(([, n]) => n));

  return (
    <div className="container ad-dash" style={{ paddingTop: 24, paddingBottom: 60 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1>My Ad Campaigns</h1>
          {advertiserAccount && (
            <p className="meta" style={{ marginTop: 4 }}>
              {advertiserAccount.companyName}
              {advertiserAccount.website && (
                <>
                  {' · '}
                  <a href={advertiserAccount.website} rel="noreferrer noopener" target="_blank">{advertiserAccount.website}</a>
                </>
              )}
            </p>
          )}
        </div>
        <Link href="/advertise" className="button small">+ New Campaign</Link>
      </div>

      {campaigns.length > 0 && (
        <div className="ad-dash-stats">
          <div className="ad-dash-stat-card">
            <div className="ad-dash-stat-label">Spend</div>
            <div className="ad-dash-stat-val" style={{ color: 'var(--accent, #ff5029)' }}>${(totalSpentCents / 100).toFixed(2)}</div>
            <div className="ad-dash-stat-sub">Across {campaigns.length} campaign{campaigns.length === 1 ? '' : 's'}</div>
          </div>
          <div className="ad-dash-stat-card">
            <div className="ad-dash-stat-label">Impressions</div>
            <div className="ad-dash-stat-val">{totalImpressions.toLocaleString()}</div>
            <div className="ad-dash-stat-sub">Lifetime</div>
          </div>
          <div className="ad-dash-stat-card">
            <div className="ad-dash-stat-label">Effective CPM</div>
            <div className="ad-dash-stat-val">{effectiveCpmCents !== null ? `$${(effectiveCpmCents / 100).toFixed(2)}` : '—'}</div>
            <div className="ad-dash-stat-sub">Real spend ÷ impressions</div>
          </div>
          <div className="ad-dash-stat-card">
            <div className="ad-dash-stat-label">Active Campaigns</div>
            <div className="ad-dash-stat-val">{activeCampaigns}</div>
            <div className="ad-dash-stat-sub">${(totalBudgetCents / 100 - totalSpentCents / 100).toFixed(2)} budget remaining</div>
          </div>
        </div>
      )}

      {campaigns.length === 0 && (
        <p className="meta">No campaigns yet. <Link href="/advertise">Submit your first ad</Link>.</p>
      )}

      {campaigns.length > 0 && (
        <div className="panel" style={{ padding: '16px 20px', marginBottom: 24 }}>
          <div style={{ fontWeight: 600, marginBottom: 12 }}>Impressions, last {DAYS} days</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 80 }}>
            {dailyRows.map(([day, count]) => (
              <div key={day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }} title={`${day}: ${count} impressions`}>
                <div style={{ width: '100%', minHeight: 2, height: `${Math.max(2, (count / maxDaily) * 64)}px`, background: 'var(--accent, #ff5029)', borderRadius: 2 }} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            <span className="meta">{dailyRows[0]?.[0]}</span>
            <span className="meta">{dailyRows[dailyRows.length - 1]?.[0]}</span>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {campaigns.map(campaign => (
          <div key={campaign.id} className="panel" style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 16 }}>{campaign.title}</div>
                <div className="meta">{campaign.slot?.name ?? 'Unknown slot'} · Submitted {new Date(campaign.createdAt).toLocaleDateString()}</div>
                {campaign.clickUrl && (
                  <div className="meta" style={{ marginTop: 4 }}>
                    <a href={campaign.clickUrl} target="_blank" rel="noreferrer noopener">{campaign.clickUrl}</a>
                  </div>
                )}
              </div>
              <span className={`badge ${campaign.status === 'APPROVED' ? 'success' : campaign.status === 'PENDING' || campaign.status === 'PAUSED' || campaign.status === 'AWAITING_PAYMENT' ? 'warning' : campaign.status === 'REJECTED' ? 'error' : ''}`}>
                {campaign.status === 'AWAITING_PAYMENT' ? 'AWAITING PAYMENT' : campaign.status}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 24 }}>
              <div><div style={{ fontWeight: 700 }}>{campaign.impressions.toLocaleString()}</div><div className="meta">Impressions</div></div>
              <div>
                <div style={{ fontWeight: 700 }}>${((campaign.budgetCents - campaign.spentCents) / 100).toFixed(2)}</div>
                <div className="meta">Budget remaining</div>
              </div>
            </div>
            {(campaign.startsAt || campaign.endsAt) && (
              <div className="meta" style={{ marginTop: 8 }}>
                {campaign.startsAt && `Starts: ${new Date(campaign.startsAt).toLocaleDateString()}`}
                {campaign.startsAt && campaign.endsAt && ' · '}
                {campaign.endsAt && `Ends: ${new Date(campaign.endsAt).toLocaleDateString()}`}
              </div>
            )}
            {(campaign.status === 'APPROVED' || campaign.status === 'PENDING' || campaign.status === 'PAUSED' || campaign.status === 'AWAITING_PAYMENT') && (
              <div style={{ marginTop: 12 }}>
                <CampaignCancelButton campaignId={campaign.id} status={campaign.status} />
              </div>
            )}
          </div>
        ))}
      </div>

      <style>{`
        .ad-dash-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px; margin-bottom: 24px; }
        .ad-dash-stat-card { border: 1px solid var(--line); border-radius: var(--radius-md); background: var(--bg2); padding: 16px 18px; }
        .ad-dash-stat-label { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: .14em; color: var(--ink-a50); margin-bottom: 6px; }
        .ad-dash-stat-val { font-family: var(--font-display); font-weight: 800; font-size: 22px; color: var(--ink); }
        .ad-dash-stat-sub { font-size: 11.5px; color: var(--ink-a50); margin-top: 2px; }
      `}</style>
    </div>
  );
}
