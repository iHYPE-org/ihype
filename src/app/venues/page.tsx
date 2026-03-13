import { db } from '@/lib/db';
import { ProfileCard } from '@/components/ProfileCard';

export const dynamic = 'force-dynamic';

export default async function VenuesIndexPage() {
  const venues = await db.profile.findMany({
    where: { type: 'VENUE' },
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
        <div className="badge">VENUES</div>
        <h1 className="title" style={{ fontSize: '2.7rem' }}>Venues</h1>
        <p className="subtitle">Browse venue profiles, booking requests, and current hype.</p>
      </header>

      <section className="section">
        <div className="grid grid-3">
          {venues.length ? venues.map((profile) => <ProfileCard key={profile.id} profile={profile} />) : <div className="empty">No venues yet.</div>}
        </div>
      </section>
    </main>
  );
}
