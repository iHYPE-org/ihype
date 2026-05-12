import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isAdminSession } from '@/lib/permissions';
import { AdminVerificationQueue } from './AdminVerificationQueue';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Verification Queue | iHYPE Admin',
  robots: { index: false, follow: false }
};

export default async function AdminVerificationsPage() {
  const session = await auth();
  if (!isAdminSession(session)) redirect('/home');

  const pendingProfiles = await db.profile.findMany({
    where: { verificationStatus: { in: ['PENDING', 'REJECTED'] } },
    select: {
      id: true,
      slug: true,
      hexId: true,
      name: true,
      type: true,
      city: true,
      stateRegion: true,
      country: true,
      contactInfo: true,
      verificationNotes: true,
      verificationStatus: true,
      verificationSubmittedAt: true,
      verificationReviewedAt: true,
      hypeCount: true,
      owner: {
        select: {
          id: true,
          email: true,
          name: true,
          username: true,
          createdAt: true
        }
      }
    },
    orderBy: [{ verificationSubmittedAt: 'asc' }, { createdAt: 'asc' }]
  });

  const verifiedCount = await db.profile.count({
    where: { verificationStatus: 'VERIFIED' }
  });

  return (
    <main className="container section">
      <section className="panel" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div className="badge">Admin</div>
            <h1 style={{ margin: '0.5rem 0 0.25rem', fontSize: '1.8rem' }}>Verification Queue</h1>
            <p className="meta">
              Review artist and venue ownership claims. Verifying a profile sets the verified badge
              and unlocks booker-visible signals.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div className="stat" style={{ minWidth: '120px', textAlign: 'center' }}>
              <strong>{pendingProfiles.filter(p => p.verificationStatus === 'PENDING').length}</strong>
              <span>Pending</span>
            </div>
            <div className="stat" style={{ minWidth: '120px', textAlign: 'center' }}>
              <strong>{pendingProfiles.filter(p => p.verificationStatus === 'REJECTED').length}</strong>
              <span>Rejected</span>
            </div>
            <div className="stat" style={{ minWidth: '120px', textAlign: 'center' }}>
              <strong>{verifiedCount}</strong>
              <span>Verified total</span>
            </div>
          </div>
        </div>
      </section>

      <AdminVerificationQueue profiles={pendingProfiles} />
    </main>
  );
}
