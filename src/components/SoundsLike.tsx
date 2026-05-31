import Link from 'next/link';
import { getSoundsLike } from '@/lib/sounds-like';

export async function SoundsLike({ profileId, profileName }: { profileId: string; profileName: string }) {
  const similar = await getSoundsLike(profileId);
  if (similar.length === 0) return null;

  return (
    <div className="panel" style={{ padding: '1.25rem', marginTop: 16 }}>
      <h3 style={{ marginBottom: 12 }}>Fans of {profileName} also like</h3>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {similar.map((p) => (
          <Link
            key={p.id}
            href={`/artists/${p.slug}`}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 80 }}
          >
            {p.avatarImage ? (
              <img
                src={p.avatarImage}
                alt={p.name}
                loading="lazy"
                style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: 'var(--bg-3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 22
                }}
              >
                🎵
              </div>
            )}
            <span style={{ fontSize: 12, textAlign: 'center', maxWidth: 80 }}>{p.name}</span>
            {p.hypeCount > 0 && (
              <span className="meta" style={{ fontSize: 11 }}>{p.hypeCount} HYPE</span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
