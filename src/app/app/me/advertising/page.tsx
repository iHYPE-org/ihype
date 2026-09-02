import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import Link from 'next/link';
import { CampaignCancelButton } from '@/components/CampaignCancelButton';
import { getServerT } from '@/lib/i18n/server';
import { REFUND_WINDOW_BUSINESS_DAYS } from '@/lib/ad-settlement-plan';

export const dynamic = 'force-dynamic';

export default async function AdvertiserDashboard() {
  const t = await getServerT();
  const session = await auth();
  if (!session?.user?.id) redirect('/login?callbackUrl=/app/me/advertising');

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
  // Money the advertiser has actually been sent back, from the settlement
  // record — never inferred from budget − spent, which is a projection.
  const totalRefundedCents = campaigns.reduce((s, c) => s + (c.refundedCents ?? 0), 0);
  const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const day = (d: Date) => new Date(d).toLocaleDateString();

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
    <div className="mmm-advertiser ad-dash">
      <Link className="mmm-charter-back" href="/app/me?section=profiles">‹ Profiles</Link>
      <div className="mmm-advertiser-head">
        <div>
          <p className="mmm-eyebrow mmm-eyebrow-accent">Advertiser profile</p>
          <h1>{t('advertiseDashboardPage.title', 'My Ad Campaigns')}</h1>
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
        <Link href="/app/me/advertising/new" className="mmm-btn-primary mmm-advertiser-new">{t('advertiseDashboardPage.newCampaign', '+ New Campaign')}</Link>
      </div>

      {campaigns.length > 0 && (
        <div className="ad-dash-stats">
          <div className="ad-dash-stat-card">
            <div className="ad-dash-stat-label">{t('advertiseDashboardPage.spend', 'Spend')}</div>
            <div className="ad-dash-stat-val" style={{ color: 'var(--accent-text)' }}>${(totalSpentCents / 100).toFixed(2)}</div>
            <div className="ad-dash-stat-sub">{t('advertiseDashboardPage.acrossCampaigns', 'Across')} {campaigns.length} {campaigns.length === 1 ? t('advertiseDashboardPage.campaignSingular', 'campaign') : t('advertiseDashboardPage.campaignPlural', 'campaigns')}</div>
          </div>
          <div className="ad-dash-stat-card">
            <div className="ad-dash-stat-label">{t('advertiseDashboardPage.impressions', 'Impressions')}</div>
            <div className="ad-dash-stat-val">{totalImpressions.toLocaleString()}</div>
            <div className="ad-dash-stat-sub">{t('advertiseDashboardPage.lifetime', 'Lifetime')}</div>
          </div>
          <div className="ad-dash-stat-card">
            <div className="ad-dash-stat-label">{t('advertiseDashboardPage.effectiveCpm', 'Effective CPM')}</div>
            <div className="ad-dash-stat-val">{effectiveCpmCents !== null ? `$${(effectiveCpmCents / 100).toFixed(2)}` : '—'}</div>
            <div className="ad-dash-stat-sub">{t('advertiseDashboardPage.effectiveCpmSub', 'Real spend ÷ impressions')}</div>
          </div>
          <div className="ad-dash-stat-card">
            <div className="ad-dash-stat-label">{t('advertiseDashboardPage.activeCampaigns', 'Active Campaigns')}</div>
            <div className="ad-dash-stat-val">{activeCampaigns}</div>
            <div className="ad-dash-stat-sub">${(totalBudgetCents / 100 - totalSpentCents / 100).toFixed(2)} {t('advertiseDashboardPage.budgetRemaining', 'budget remaining')}</div>
          </div>
          {totalRefundedCents > 0 && (
            <div className="ad-dash-stat-card">
              <div className="ad-dash-stat-label">{t('advertiseDashboardPage.refunded', 'Refunded')}</div>
              <div className="ad-dash-stat-val">{dollars(totalRefundedCents)}</div>
              <div className="ad-dash-stat-sub">{t('advertiseDashboardPage.refundedSub', 'Unspent budget sent back to your card')}</div>
            </div>
          )}
        </div>
      )}

      {campaigns.length > 0 && (
        <p className="meta ad-dash-refund-policy">
          {t(
            'advertiseDashboardPage.refundPolicy',
            `How billing works: a campaign is charged in full when you pay at checkout. When its run ends, or you cancel it, whatever was not spent is refunded to the card you paid with — usually on your statement within ${REFUND_WINDOW_BUSINESS_DAYS} business days — and the amount and Stripe refund reference appear on the campaign below. iHYPE absorbs the card-processing fee; nothing is deducted from the refund.`,
          )}
        </p>
      )}

      {campaigns.length === 0 && (
        <div className="mmm-empty-state">
          <strong>{t('advertiseDashboardPage.noCampaigns', 'No campaigns yet.')}</strong>
          <p>Choose an audience, upload a radio-style spot and see the full price before checkout.</p>
          <div className="mmm-empty-actions">
            <Link className="mmm-btn-primary" href="/app/me/advertising/new">{t('advertiseDashboardPage.submitFirstAd', 'Build your first campaign')}</Link>
          </div>
        </div>
      )}

      {campaigns.length > 0 && (
        <div className="panel" style={{ padding: '16px 20px', marginBottom: 24 }}>
          <div style={{ fontWeight: 600, marginBottom: 12 }}>{t('advertiseDashboardPage.impressionsLastDays', 'Impressions, last')} {DAYS} {t('advertiseDashboardPage.days', 'days')}</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 80 }}>
            {dailyRows.map(([day, count]) => (
              <div key={day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }} title={`${day}: ${count} impressions`}>
                <div style={{ width: '100%', minHeight: 2, height: `${Math.max(2, (count / maxDaily) * 64)}px`, background: 'var(--accent)', borderRadius: 2 }} />
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
                <div style={{ fontWeight: 600, fontSize: '1rem' }}>{campaign.title}</div>
                <div className="meta">{campaign.slot?.name ?? t('advertiseDashboardPage.unknownSlot', 'Unknown slot')} · {t('advertiseDashboardPage.submitted', 'Submitted')} {new Date(campaign.createdAt).toLocaleDateString()}</div>
                {campaign.clickUrl && (
                  <div className="meta" style={{ marginTop: 4 }}>
                    <a href={campaign.clickUrl} target="_blank" rel="noreferrer noopener">{campaign.clickUrl}</a>
                  </div>
                )}
              </div>
              <span className={`badge ${campaign.status === 'APPROVED' ? 'success' : campaign.status === 'PENDING' || campaign.status === 'PAUSED' || campaign.status === 'AWAITING_PAYMENT' ? 'warning' : campaign.status === 'REJECTED' ? 'error' : ''}`}>
                {campaign.status === 'AWAITING_PAYMENT' ? t('advertiseDashboardPage.awaitingPayment', 'AWAITING PAYMENT') : campaign.status}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <div><div style={{ fontWeight: 700 }}>{campaign.impressions.toLocaleString()}</div><div className="meta">{t('advertiseDashboardPage.impressions', 'Impressions')}</div></div>
              <div>
                <div style={{ fontWeight: 700 }}>{dollars(campaign.budgetCents)}</div>
                <div className="meta">{campaign.authorizedAt ? t('advertiseDashboardPage.paid', 'Paid') : t('advertiseDashboardPage.quoted', 'Quoted')}</div>
              </div>
              <div>
                <div style={{ fontWeight: 700 }}>{dollars(Math.min(campaign.spentCents, campaign.budgetCents))}</div>
                <div className="meta">{t('advertiseDashboardPage.spent', 'Spent')}</div>
              </div>
              {campaign.settledAt ? (
                <div>
                  <div style={{ fontWeight: 700 }}>{campaign.refundedCents === null ? '—' : dollars(campaign.refundedCents)}</div>
                  <div className="meta">{t('advertiseDashboardPage.refunded', 'Refunded')}</div>
                </div>
              ) : (
                <div>
                  <div style={{ fontWeight: 700 }}>${((campaign.budgetCents - Math.min(campaign.spentCents, campaign.budgetCents)) / 100).toFixed(2)}</div>
                  <div className="meta">{t('advertiseDashboardPage.budgetRemainingLabel', 'Budget remaining')}</div>
                </div>
              )}
            </div>
            {/* The money line: what was charged, what came back, and when. A
                settled campaign reads from the settlement record; a live one
                states the promise; one not yet paid says nothing was charged. */}
            <div className="meta ad-dash-money">
              {campaign.settledAt ? (
                campaign.refundedCents === null ? (
                  <>{t('advertiseDashboardPage.settledOn', 'Settled')} {day(campaign.settledAt)}.</>
                ) : campaign.refundedCents > 0 ? (
                  <>
                    {t('advertiseDashboardPage.settledOn', 'Settled')} {day(campaign.settledAt)} · {dollars(campaign.refundedCents)} {t('advertiseDashboardPage.refundedToCard', 'refunded to the card you paid with, usually on your statement within')} {REFUND_WINDOW_BUSINESS_DAYS} {t('advertiseDashboardPage.businessDays', 'business days')}
                    {campaign.settledChargedCents !== null && campaign.settledChargedCents > 0 && <> · {dollars(campaign.settledChargedCents)} {t('advertiseDashboardPage.keptForDelivery', 'kept for delivered spend')}</>}
                    {campaign.stripeRefundId && <> · {t('advertiseDashboardPage.refundRef', 'Stripe refund ref')} <code>{campaign.stripeRefundId}</code></>}
                  </>
                ) : (
                  <>{t('advertiseDashboardPage.settledOn', 'Settled')} {day(campaign.settledAt)} · {t('advertiseDashboardPage.nothingToRefund', 'the full budget was delivered, so there was nothing to refund')}</>
                )
              ) : campaign.authorizedAt ? (
                <>
                  {t('advertiseDashboardPage.chargedOn', 'Charged')} {dollars(campaign.budgetCents)} {t('advertiseDashboardPage.on', 'on')} {day(campaign.authorizedAt)} · {t('advertiseDashboardPage.unspentPromise', 'unspent budget is refunded to that card when the run ends or if you cancel')}
                </>
              ) : campaign.status === 'AWAITING_PAYMENT' ? (
                <>{t('advertiseDashboardPage.notChargedYet', 'Nothing charged yet — paying charges the full budget, and whatever is unspent at the end is refunded.')}</>
              ) : (
                <>{t('advertiseDashboardPage.notCharged', 'Nothing has been charged for this campaign.')}</>
              )}
            </div>
            {(campaign.startsAt || campaign.endsAt) && (
              <div className="meta" style={{ marginTop: 8 }}>
                {campaign.startsAt && `${t('advertiseDashboardPage.starts', 'Starts')}: ${new Date(campaign.startsAt).toLocaleDateString()}`}
                {campaign.startsAt && campaign.endsAt && ' · '}
                {campaign.endsAt && `${t('advertiseDashboardPage.ends', 'Ends')}: ${new Date(campaign.endsAt).toLocaleDateString()}`}
              </div>
            )}
            {(campaign.status === 'APPROVED' || campaign.status === 'PENDING' || campaign.status === 'PAUSED' || campaign.status === 'AWAITING_PAYMENT') && (
              <div style={{ marginTop: 12 }}>
                <CampaignCancelButton
                  campaignId={campaign.id}
                  status={campaign.status}
                  charged={Boolean(campaign.authorizedAt) && !campaign.settledAt}
                  unspentCents={campaign.budgetCents - Math.min(campaign.spentCents, campaign.budgetCents)}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <style>{`
        .ad-dash-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px; margin-bottom: 24px; }
        .ad-dash-stat-card { border: 1px solid var(--line); border-radius: var(--radius-md); background: var(--bg2); padding: 16px 18px; }
        .ad-dash-stat-label { font-family: var(--font-mono); font-size: 0.6875rem; text-transform: uppercase; letter-spacing: .14em; color: var(--ink-a65); margin-bottom: 6px; }
        .ad-dash-stat-val { font-family: var(--font-display); font-weight: 800; font-size: 1.375rem; color: var(--ink); }
        .ad-dash-stat-sub { font-size: 0.9375rem; color: var(--ink-a65); margin-top: 2px; }
        .ad-dash-refund-policy { margin: -8px 0 24px; max-width: 72ch; }
        .ad-dash-money { margin-top: 8px; overflow-wrap: anywhere; }
        .ad-dash-money code { font-family: var(--font-mono); }
      `}</style>
    </div>
  );
}
