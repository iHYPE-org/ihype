import { ImageResponse } from 'next/og';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const alt = 'Fan on iHYPE';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const profile = await db.profile.findUnique({
    where: { slug },
    select: { name: true, city: true, stateRegion: true, type: true, ownerId: true },
  });

  if (!profile || profile.type !== 'LISTENER') {
    // Fallback card for missing/non-fan profiles.
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%', height: '100%',
            display: 'flex', flexDirection: 'column',
            justifyContent: 'space-between',
            background: '#0a0805',
            padding: '72px 80px',
            fontFamily: 'sans-serif',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ color: '#fff7ec', fontSize: 28, fontWeight: 900, letterSpacing: '0.06em' }}>i</span>
            <span style={{ color: '#ff5029', fontSize: 28, fontWeight: 900, letterSpacing: '0.06em' }}>HYPE</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 18, color: '#22e5d4', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>My scene</div>
            <div style={{ fontSize: 64, fontWeight: 900, color: '#f0ebe5', lineHeight: 0.98, letterSpacing: '-0.03em' }}>Fan on iHYPE</div>
            <div style={{ fontSize: 24, color: '#5a5048' }}>Independent music, built for the scene.</div>
          </div>
          <div style={{ color: '#3a342e', fontSize: 20, letterSpacing: '0.08em' }}>ihype.org/fans/{slug}</div>
        </div>
      ),
      { ...size }
    );
  }

  const [followCount, topArtistFollows, rsvpCount] = await Promise.all([
    db.follow.count({ where: { followerId: profile.ownerId } }),
    db.follow.findMany({
      where: { followerId: profile.ownerId, followeeProfile: { type: 'ARTIST' } },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: { followeeProfile: { select: { name: true } } },
    }),
    db.showRsvp.count({ where: { userId: profile.ownerId } }),
  ]);

  const topArtists = topArtistFollows.map((f) => f.followeeProfile.name).filter(Boolean);
  const city = [profile.city, profile.stateRegion].filter(Boolean).join(', ');

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%',
          display: 'flex', flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#0a0805',
          padding: '72px 80px',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ color: '#fff7ec', fontSize: 28, fontWeight: 900, letterSpacing: '0.06em' }}>i</span>
          <span style={{ color: '#ff5029', fontSize: 28, fontWeight: 900, letterSpacing: '0.06em' }}>HYPE</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 18, color: '#22e5d4', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>My scene</div>
          <div style={{ fontSize: 68, fontWeight: 900, color: '#f0ebe5', lineHeight: 0.98, letterSpacing: '-0.03em' }}>{profile.name}</div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            {city && <span style={{ fontSize: 22, color: '#5a5048' }}>{city}</span>}
            <span style={{ fontSize: 22, color: '#5a5048' }}>{followCount} following</span>
            <span style={{ fontSize: 22, color: '#5a5048' }}>{rsvpCount} {rsvpCount === 1 ? 'show' : 'shows'} RSVP&apos;d</span>
          </div>
          {topArtists.length > 0 && (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
              {topArtists.map((name) => (
                <span
                  key={name}
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: '#ff5029',
                    background: 'rgba(255,80,41,0.15)',
                    padding: '6px 16px',
                    borderRadius: 999,
                  }}
                >
                  {name}
                </span>
              ))}
            </div>
          )}
        </div>
        <div style={{ color: '#3a342e', fontSize: 20, letterSpacing: '0.08em' }}>ihype.org/fans/{slug}</div>
      </div>
    ),
    { ...size }
  );
}
