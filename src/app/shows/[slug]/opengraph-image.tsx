import { ImageResponse } from 'next/og';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const alt = 'Show on iHYPE';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const show = await db.show.findUnique({
    where: { slug },
    select: {
      title: true, startsAt: true, status: true, isRadioShow: true,
      venueProfile: { select: { name: true, city: true, stateRegion: true } },
      headlinerProfile: { select: { name: true } },
    },
  });

  const title = show?.title ?? 'Show';
  const date = show?.startsAt
    ? new Date(show.startsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';
  const venue = show?.venueProfile?.name ?? '';
  const city = [show?.venueProfile?.city, show?.venueProfile?.stateRegion].filter(Boolean).join(', ');
  const headliner = show?.headlinerProfile?.name ?? '';
  const isLive = show?.status === 'LIVE';

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: '#fff7ec', fontSize: 28, fontWeight: 900, letterSpacing: '0.06em' }}>i</span>
          <span style={{ color: '#ff5029', fontSize: 28, fontWeight: 900, letterSpacing: '0.06em' }}>HYPE</span>
          {isLive && (
            <span style={{ marginLeft: 16, fontSize: 14, fontWeight: 800, letterSpacing: '0.12em', color: '#ff5029', background: 'rgba(255,80,41,0.15)', padding: '4px 12px', borderRadius: 999 }}>● LIVE</span>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {(date || show?.isRadioShow) && (
            <div style={{ fontSize: 18, color: '#22e5d4', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              {show?.isRadioShow ? 'Radio Show' : date}
            </div>
          )}
          <div style={{ fontSize: 72, fontWeight: 900, color: '#f0ebe5', lineHeight: 0.98, letterSpacing: '-0.03em' }}>{title}</div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            {headliner && <span style={{ fontSize: 22, color: '#5a5048' }}>{headliner}</span>}
            {venue && <span style={{ fontSize: 22, color: '#5a5048' }}>{venue}</span>}
            {city && <span style={{ fontSize: 22, color: '#5a5048' }}>{city}</span>}
          </div>
        </div>
        <div style={{ color: '#3a342e', fontSize: 20, letterSpacing: '0.08em' }}>ihype.org/shows/{slug}</div>
      </div>
    ),
    { ...size }
  );
}
