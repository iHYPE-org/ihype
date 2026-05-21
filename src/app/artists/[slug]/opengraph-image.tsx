import { ImageResponse } from 'next/og';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const alt = 'Artist on iHYPE';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = await db.profile.findUnique({
    where: { slug },
    select: { name: true, headline: true, city: true, stateRegion: true, genres: true, hypeCount: true },
  });

  const name = profile?.name ?? 'Artist';
  const location = [profile?.city, profile?.stateRegion].filter(Boolean).join(', ');
  const genre = profile?.genres?.[0] ?? '';
  const hype = profile?.hypeCount ? `${profile.hypeCount} HYPE` : '';

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
          {genre ? <div style={{ fontSize: 18, color: '#ff5029', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{genre}</div> : null}
          <div style={{ fontSize: 80, fontWeight: 900, color: '#f0ebe5', lineHeight: 0.98, letterSpacing: '-0.04em' }}>{name}</div>
          <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
            {location ? <span style={{ fontSize: 24, color: '#5a5048' }}>{location}</span> : null}
            {hype ? <span style={{ fontSize: 24, color: '#b983ff', fontWeight: 700 }}>{hype}</span> : null}
          </div>
        </div>
        <div style={{ color: '#3a342e', fontSize: 20, letterSpacing: '0.08em' }}>ihype.org/artists/{slug}</div>
      </div>
    ),
    { ...size }
  );
}
