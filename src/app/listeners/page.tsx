import { db } from '@/lib/db';
import { ProfileCard } from '@/components/ProfileCard';

export const dynamic = 'force-dynamic';

export default async function ListenersIndexPage() {
  const listeners = await db.profile.findMany({
    where: { type: 'LISTENER' },
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
        <div className="badge">LISTENERS</div>
        <h1 className="title" style={{ fontSize: '2.7rem' }}>Listeners</h1>
        <p className="subtitle">Browse listener pages, saved shows, top fives, and community stats.</p>
      </header>

      <section className="section">
        <div className="grid grid-3">
          {listeners.length ? listeners.map((profile) => <ProfileCard key={profile.id} profile={profile} />) : <div className="empty">No listeners yet.</div>}
        </div>
      </section>
    </main>
  );
}
