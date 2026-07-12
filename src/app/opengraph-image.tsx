import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const alt = 'iHYPE — Independent music discovery for the scene';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OgImage() {
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
        {/* Top: wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ color: '#fff7ec', fontSize: 36, fontWeight: 900, letterSpacing: '0.06em' }}>i</span>
          <span style={{ color: '#ff5029', fontSize: 36, fontWeight: 900, letterSpacing: '0.06em' }}>HYPE</span>
        </div>

        {/* Centre: headline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: 72, fontWeight: 900, color: '#f0ebe5', lineHeight: 1.05, letterSpacing: '-0.03em' }}>
            <span>Independent music,</span>
            <span style={{ color: '#ff5029' }}>built for the scene.</span>
          </div>
          <div style={{ fontSize: 28, color: '#5a5048', maxWidth: 780 }}>
            Completely free · Not-for-profit · 0% ticket fees
          </div>
        </div>

        {/* Bottom: domain */}
        <div style={{ color: '#3a342e', fontSize: 22, letterSpacing: '0.08em' }}>ihype.org</div>
      </div>
    ),
    { ...size }
  );
}
