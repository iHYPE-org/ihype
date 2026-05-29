import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function AdvertiserDashboard() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  // Show the user's own campaigns using the new Ad model
  const campaigns = await db.ad.findMany({
    where: { advertiserId: session.user.id },
    include: { slot: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });

  const totalImpressions = campaigns.reduce((s, c) => s + c.impressions, 0);
  const totalClicks = campaigns.reduce((s, c) => s + c.clicks, 0);

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 60 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1>My Ad Campaigns</h1>
        <Link href="/advertise" className="button small">Submit new ad</Link>
      </div>

      {campaigns.length > 0 && (
        <div style={{ display: 'flex', gap: 24, marginBottom: 24 }}>
          <div className="panel" style={{ padding: '14px 20px', flex: 1, textAlign: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 24 }}>{totalImpressions.toLocaleString()}</div>
            <div className="meta">Total impressions</div>
          </div>
          <div className="panel" style={{ padding: '14px 20px', flex: 1, textAlign: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 24 }}>{totalClicks.toLocaleString()}</div>
            <div className="meta">Total clicks</div>
          </div>
          <div className="panel" style={{ padding: '14px 20px', flex: 1, textAlign: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 24 }}>
              {totalImpressions > 0 ? `${((totalClicks / totalImpressions) * 100).toFixed(2)}%` : '—'}
            </div>
            <div className="meta">CTR</div>
          </div>
        </div>
      )}

      {campaigns.length === 0 && (
        <p className="meta">No campaigns yet. <Link href="/advertise">Submit your first ad</Link>.</p>
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
              <span className={`badge ${campaign.status === 'APPROVED' ? 'success' : campaign.status === 'PENDING' ? 'warning' : ''}`}>
                {campaign.status}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 24 }}>
              <div><div style={{ fontWeight: 700 }}>{campaign.impressions.toLocaleString()}</div><div className="meta">Impressions</div></div>
              <div><div style={{ fontWeight: 700 }}>{campaign.clicks.toLocaleString()}</div><div className="meta">Clicks</div></div>
              <div>
                <div style={{ fontWeight: 700 }}>
                  {campaign.impressions > 0 ? `${((campaign.clicks / campaign.impressions) * 100).toFixed(2)}%` : '—'}
                </div>
                <div className="meta">CTR</div>
              </div>
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
          </div>
        ))}
      </div>
    </div>
  );
}
