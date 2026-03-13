import { db } from '@/lib/db';
import { ProfileCard } from '@/components/ProfileCard';

export const dynamic = 'force-dynamic';

export default async function PromotersIndexPage() {
  const promoters = await db.profile.findMany({
    where: { type: 'DJ' },
    orderBy: [{ verified: 'desc' }, { name: 'asc' }],
    select: {
      id: true,
      type: true,
      slug: true,
      hexId: true,
      name: true,
      city: true,
      country: true,
      hypeCount: true,
      bio: true,
      genres: true,
      avatarImage: true
    }
  });

  return (
    <main className="container section">
      <header className="profile-header">
        <div className="badge">PROMOTERS</div>
        <h1 className="title" style={{ fontSize: '2.7rem' }}>Promoters</h1>
        <p className="subtitle">Browse promoter profiles, their hype, and the shows they are helping bring to life.</p>
      </header>

      <section className="section">
        <div className="grid grid-3">
          {promoters.length ? promoters.map((profile) => <ProfileCard key={profile.id} profile={profile} />) : <div className="empty">No promoters yet.</div>}
        </div>
      </section>
    </main>
  );
}
