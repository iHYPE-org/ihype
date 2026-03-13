import { db } from '@/lib/db';
import { ProfileCard } from '@/components/ProfileCard';

export const dynamic = 'force-dynamic';

export default async function ArtistsIndexPage() {
  const artists = await db.profile.findMany({
    where: { type: 'ARTIST' },
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
        <div className="badge">ARTISTS</div>
        <h1 className="title" style={{ fontSize: '2.7rem' }}>Artists</h1>
        <p className="subtitle">Browse artist profiles, recent hype, and upcoming sets.</p>
      </header>

      <section className="section">
        <div className="grid grid-3">
          {artists.length ? artists.map((profile) => <ProfileCard key={profile.id} profile={profile} />) : <div className="empty">No artists yet.</div>}
        </div>
      </section>
    </main>
  );
}
