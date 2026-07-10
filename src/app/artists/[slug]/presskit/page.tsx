import { db } from '@/lib/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getBaseUrl } from '@/lib/utils';
import { getCspNonce } from '@/lib/csp-nonce';
import { parsePressKit } from '@/lib/press-kit';
import type { Metadata } from 'next';

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const profile = await db.profile.findUnique({
    where: { slug },
    select: { name: true, headline: true, avatarImage: true },
  });

  if (!profile) return { title: 'Press Kit · iHYPE' };

  const title       = `${profile.name} — Press Kit · iHYPE`;
  const description = profile.headline ?? `Press kit for ${profile.name} on iHYPE`;
  const ogImage      = `/api/og?${new URLSearchParams({ title: profile.name, subtitle: 'Press Kit', type: 'artist' }).toString()}`;

  return {
    title,
    description,
    openGraph: {
      type: 'website',
      siteName: 'iHYPE',
      title,
      description,
      url: `/artists/${slug}/presskit`,
      images: profile.avatarImage ? [{ url: profile.avatarImage }] : [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default async function PressKitPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = await db.profile.findUnique({
    where: { slug },
    select: { name: true, slug: true, bio: true, genres: true, headline: true, heroImage: true, avatarImage: true, links: true, verified: true, pressKitContent: true,
      headlinerShows: { where: { startsAt: { gte: new Date() } }, select: { title: true, startsAt: true, venueProfile: { select: { name: true, city: true } } }, take: 5, orderBy: { startsAt: 'asc' } }
    }
  });
  if (!profile) notFound();

  const nonce = await getCspNonce();
  const baseUrl = getBaseUrl();
  const profileUrl = `${baseUrl}/artists/${slug}`;
  const pressKit = parsePressKit(profile.pressKitContent);

  return (
    <div className="container" style={{ maxWidth: 700, paddingTop: 40, paddingBottom: 60 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>{profile.name} — Press Kit</h1>
        <Link href={`/artists/${slug}`} className="button small secondary">← Back</Link>
      </div>
      {profile.avatarImage && <img src={profile.avatarImage} alt={profile.name} loading="lazy" style={{ width: 120, height: 120, borderRadius: '50%', objectFit: 'cover', marginBottom: 16 }} />}
      {pressKit.tagline && <p style={{ fontSize: 19, fontStyle: 'italic', opacity: 0.85 }}>{pressKit.tagline}</p>}
      {profile.headline && <p style={{ fontSize: 18, fontWeight: 600 }}>{profile.headline}</p>}
      {profile.bio && <p style={{ lineHeight: 1.7 }}>{profile.bio}</p>}
      <p><strong>Genres:</strong> {(profile.genres as string[]).join(', ')}</p>
      <p><strong>Profile:</strong> <a href={profileUrl}>{profileUrl}</a></p>
      {pressKit.contactEmail && (
        <p><strong>Booking / press:</strong> <a href={`mailto:${pressKit.contactEmail}`}>{pressKit.contactEmail}</a></p>
      )}
      {pressKit.quotes.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h2>Press</h2>
          {pressKit.quotes.map((q, i) => (
            <blockquote key={i} style={{ margin: '0 0 14px', paddingLeft: 16, borderLeft: '3px solid rgba(255,80,41,.5)' }}>
              <p style={{ margin: 0, fontStyle: 'italic', lineHeight: 1.6 }}>&ldquo;{q.quote}&rdquo;</p>
              {q.source && <cite style={{ fontSize: 13, opacity: 0.7 }}>— {q.source}</cite>}
            </blockquote>
          ))}
        </section>
      )}
      {pressKit.achievements.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h2>Highlights</h2>
          <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>
            {pressKit.achievements.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </section>
      )}
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
      <script dangerouslySetInnerHTML={{ __html: `document.getElementById('print-btn').onclick=()=>window.print()` }} nonce={nonce} />
    </div>
  );
}
