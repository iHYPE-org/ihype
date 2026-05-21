import { db } from '@/lib/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getBaseUrl } from '@/lib/utils';

export default async function PressKitPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = await db.profile.findUnique({
    where: { slug },
    select: { name: true, slug: true, bio: true, genres: true, headline: true, heroImage: true, avatarImage: true, links: true, verified: true,
      headlinerShows: { where: { startsAt: { gte: new Date() } }, select: { title: true, startsAt: true, venueProfile: { select: { name: true, city: true } } }, take: 5, orderBy: { startsAt: 'asc' } }
    }
  });
  if (!profile) notFound();

  const baseUrl = getBaseUrl();
  const profileUrl = `${baseUrl}/artists/${slug}`;

  return (
    <div className="container" style={{ maxWidth: 700, paddingTop: 40, paddingBottom: 60 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>{profile.name} — Press Kit</h1>
        <Link href={`/artists/${slug}`} className="button small secondary">← Back</Link>
      </div>
      {profile.avatarImage && <img src={profile.avatarImage} alt={profile.name} style={{ width: 120, height: 120, borderRadius: '50%', objectFit: 'cover', marginBottom: 16 }} />}
      {profile.headline && <p style={{ fontSize: 18, fontWeight: 600 }}>{profile.headline}</p>}
      {profile.bio && <p style={{ lineHeight: 1.7 }}>{profile.bio}</p>}
      <p><strong>Genres:</strong> {(profile.genres as string[]).join(', ')}</p>
      <p><strong>Profile:</strong> <a href={profileUrl}>{profileUrl}</a></p>
      {profile.headlinerShows.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h2>Upcoming Shows</h2>
          {profile.headlinerShows.map((s, i) => (
            <p key={i}>{s.title} — {s.venueProfile?.name}, {s.venueProfile?.city} — {s.startsAt ? new Date(s.startsAt).toLocaleDateString() : ''}</p>
          ))}
        </section>
      )}
      <div style={{ marginTop: 32, display: 'flex', gap: 12 }}>
        <button className="button" onClick={undefined} type="button" id="print-btn" suppressHydrationWarning>Print / Save PDF</button>
      </div>
      <script dangerouslySetInnerHTML={{ __html: `document.getElementById('print-btn').onclick=()=>window.print()` }} />
    </div>
  );
}
