import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { isAdminSession } from '@/lib/permissions';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function AdvertiserDashboard() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  // Ad submissions lack a submitterUserId field, so non-admin users would see
  // all advertisers' data. Gate to admins until that migration lands.
  if (!isAdminSession(session)) redirect('/workbench');

  const ads = await db.adSubmission.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, advertiserName: true, tier: true, status: true, createdAt: true, impressions: true }
  });

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 60 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1>My Ads</h1>
        <Link href="/advertise" className="button small">Submit new ad</Link>
      </div>
      {ads.length === 0 && <p className="meta">No ads yet. <Link href="/advertise">Submit your first ad</Link>.</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {ads.map(ad => (
          <div key={ad.id} className="panel" style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 600 }}>{ad.advertiserName}</div>
                <div className="meta">{ad.tier} · Submitted {new Date(ad.createdAt).toLocaleDateString()}</div>
              </div>
              <span className={`badge ${ad.status === 'ACTIVE' ? 'success' : ad.status === 'PENDING' ? 'warning' : ''}`}>{ad.status}</span>
            </div>
            <div style={{ display: 'flex', gap: 24, marginTop: 12 }}>
              <div><div style={{ fontWeight: 700 }}>{ad.impressions ?? 0}</div><div className="meta">Impressions</div></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
