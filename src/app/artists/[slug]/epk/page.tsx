import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { getSafeImageUrl } from '@/lib/asset-safety';
import { getCspNonce } from '@/lib/csp-nonce';
import { parsePressKit } from '@/lib/press-kit';

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
      galleryImage: true,
      aboutContent: true,
      pressKitContent: true,
      type: true,
    },
  });

  if (!profile || (profile.type !== 'ARTIST' && profile.type !== 'DJ')) return notFound();

  const nonce = await getCspNonce();
  const avatarUrl = getSafeImageUrl(profile.avatarImage);
  const galleryUrl = getSafeImageUrl(profile.galleryImage);
  const location = [profile.city, profile.stateRegion, profile.country].filter(Boolean).join(', ');
  const pressKit = parsePressKit(profile.pressKitContent);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px', fontFamily: 'serif', color: '#111' }}>
      <style>{`@media print { .no-print { display: none !important; } body { background: white; } }`}</style>
      <div className="no-print" style={{ marginBottom: 24 }}>
        {/* Server Component — a function prop here crashes RSC serialization
            (this page rendered a hard error for every visitor). Wire the
            handler with the same inline-script pattern the sibling presskit
            page already uses. */}
        <button id="epk-print-btn" type="button" style={{ padding: '8px 18px', cursor: 'pointer' }}>
          Print / Save PDF
        </button>
        <script dangerouslySetInnerHTML={{ __html: `document.getElementById('epk-print-btn').onclick=()=>window.print()` }} nonce={nonce} />
      </div>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {avatarUrl && (
          <img
            alt={profile.name}
            src={avatarUrl}
            loading="lazy"
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
          {pressKit.tagline && (
            <p style={{ margin: '8px 0 0', fontSize: 16, fontStyle: 'italic', color: '#333' }}>{pressKit.tagline}</p>
          )}
        </div>
      </div>

      {pressKit.quotes.length > 0 && (
        <section style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 18, borderBottom: '1px solid #ddd', paddingBottom: 6 }}>Press</h2>
          {pressKit.quotes.map((q, i) => (
            <blockquote key={i} style={{ margin: '0 0 14px', paddingLeft: 16, borderLeft: '3px solid #ddd' }}>
              <p style={{ margin: 0, fontStyle: 'italic', lineHeight: 1.6 }}>&ldquo;{q.quote}&rdquo;</p>
              {q.source && <cite style={{ fontSize: 13, color: '#555' }}>— {q.source}</cite>}
            </blockquote>
          ))}
        </section>
      )}

      {pressKit.achievements.length > 0 && (
        <section style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 18, borderBottom: '1px solid #ddd', paddingBottom: 6 }}>Highlights</h2>
          <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>
            {pressKit.achievements.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </section>
      )}

      {galleryUrl && (
        <section style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 18, borderBottom: '1px solid #ddd', paddingBottom: 6 }}>Press Photo</h2>
          <img
            alt={`${profile.name} press photo`}
            src={galleryUrl}
            loading="lazy"
            style={{ maxWidth: '100%', maxHeight: 400, objectFit: 'cover', borderRadius: 4 }}
          />
        </section>
      )}

      {profile.bio && (
        <section style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 18, borderBottom: '1px solid #ddd', paddingBottom: 6 }}>Bio</h2>
          <p style={{ lineHeight: 1.7, whiteSpace: 'pre-line' }}>{profile.bio}</p>
        </section>
      )}

      {profile.aboutContent && (() => {
        let techRider: string | null = null;
        try {
          const parsed = JSON.parse(profile.aboutContent!);
          if (parsed && typeof parsed === 'object') {
            const entries = Object.entries(parsed)
              .filter(([, v]) => v && v !== 'false')
              .map(([k]) => k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()))
              .join(', ');
            if (entries) techRider = entries;
          }
        } catch {
          techRider = profile.aboutContent!;
        }
        if (!techRider) return null;
        return (
          <section style={{ marginTop: 32 }}>
            <h2 style={{ fontSize: 18, borderBottom: '1px solid #ddd', paddingBottom: 6 }}>Technical Rider</h2>
            <p style={{ lineHeight: 1.7, whiteSpace: 'pre-line' }}>{techRider}</p>
          </section>
        );
      })()}

      {(profile.contactInfo || profile.links || pressKit.contactEmail) && (
        <section style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 18, borderBottom: '1px solid #ddd', paddingBottom: 6 }}>Contact &amp; Links</h2>
          {pressKit.contactEmail && (
            <p style={{ margin: '0 0 8px' }}>
              Booking / press: <a href={`mailto:${pressKit.contactEmail}`}>{pressKit.contactEmail}</a>
            </p>
          )}
          {profile.contactInfo && <p style={{ margin: '0 0 8px' }}>{profile.contactInfo}</p>}
          {profile.links && <p style={{ margin: 0, whiteSpace: 'pre-line', fontSize: 14 }}>{profile.links}</p>}
        </section>
      )}

      <section style={{ marginTop: 32, fontSize: 12, color: '#aaa' }}>
        <p>Generated via iHYPE · ihype.org</p>
      </section>
    </div>
  );
}
