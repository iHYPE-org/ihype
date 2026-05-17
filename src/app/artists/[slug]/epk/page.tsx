import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { getSafeImageUrl } from '@/lib/asset-safety';

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const profile = await db.profile.findUnique({ where: { slug }, select: { name: true } });
  return {
    title: profile ? `${profile.name} — Press Kit` : 'Press Kit',
    robots: { index: false, follow: false },
  };
}

export default async function EpkPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = await db.profile.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      bio: true,
      genres: true,
      city: true,
      stateRegion: true,
      country: true,
      contactInfo: true,
      links: true,
      avatarImage: true,
      type: true,
    },
  });

  if (!profile || (profile.type !== 'ARTIST' && profile.type !== 'DJ')) return notFound();

  const avatarUrl = getSafeImageUrl(profile.avatarImage);
  const location = [profile.city, profile.stateRegion, profile.country].filter(Boolean).join(', ');

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px', fontFamily: 'serif', color: '#111' }}>
      <style>{`@media print { .no-print { display: none !important; } body { background: white; } }`}</style>
      <div className="no-print" style={{ marginBottom: 24 }}>
        <button onClick={() => window.print()} style={{ padding: '8px 18px', cursor: 'pointer' }}>
          Print / Save PDF
        </button>
      </div>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {avatarUrl && (
          <img
            alt={profile.name}
            src={avatarUrl}
            style={{ width: 160, height: 160, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
          />
        )}
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: '0 0 8px', fontSize: 32 }}>{profile.name}</h1>
          {profile.genres.length > 0 && (
            <p style={{ margin: '0 0 4px', color: '#555', fontSize: 14 }}>
              {profile.genres.join(' · ')}
            </p>
          )}
          {location && <p style={{ margin: '0 0 4px', color: '#555', fontSize: 14 }}>{location}</p>}
        </div>
      </div>

      {profile.bio && (
        <section style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 18, borderBottom: '1px solid #ddd', paddingBottom: 6 }}>Bio</h2>
          <p style={{ lineHeight: 1.7, whiteSpace: 'pre-line' }}>{profile.bio}</p>
        </section>
      )}

      {(profile.contactInfo || profile.links) && (
        <section style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 18, borderBottom: '1px solid #ddd', paddingBottom: 6 }}>Contact &amp; Links</h2>
          {profile.contactInfo && <p style={{ margin: '0 0 8px' }}>{profile.contactInfo}</p>}
          {profile.links && <p style={{ margin: 0, whiteSpace: 'pre-line', fontSize: 14 }}>{profile.links}</p>}
        </section>
      )}

      <section style={{ marginTop: 32, fontSize: 12, color: '#aaa' }}>
        <p>Generated via iHYPE · ihype.org</p>
      </section>
    </main>
  );
}
