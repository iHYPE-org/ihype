import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const title    = searchParams.get('title')    ?? 'iHYPE';
  const subtitle = searchParams.get('subtitle') ?? 'Independent music for the scene';
  const type     = searchParams.get('type')     ?? 'default'; // show | artist | default
  const kicker   = searchParams.get('kicker')   ?? '';

  const accent = '#ff5029';
  const teal   = '#22e5d4';
  const purple = '#b983ff';
  const bg     = '#0a0805';
  const bg2    = '#100d09';

  const typeColor = type === 'show' ? teal : type === 'artist' ? purple : accent;
  const typeLabel = type === 'show' ? 'SHOW' : type === 'artist' ? 'ARTIST' : 'iHYPE';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: bg,
          fontFamily: 'system-ui, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background gradient orbs */}
        <div style={{
          position: 'absolute', top: -120, left: -80,
          width: 500, height: 500, borderRadius: '50%',
          background: `radial-gradient(circle, ${accent}18 0%, transparent 70%)`,
          display: 'flex',
        }} />
        <div style={{
          position: 'absolute', bottom: -100, right: -60,
          width: 400, height: 400, borderRadius: '50%',
          background: `radial-gradient(circle, ${typeColor}14 0%, transparent 70%)`,
          display: 'flex',
        }} />

        {/* Grid overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
          display: 'flex',
        }} />

        {/* Top bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '44px 56px 0',
        }}>
          {/* Logo wordmark */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: `linear-gradient(135deg, ${accent}, #ff3e6e)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, fontWeight: 900, color: '#fff',
            }}>H</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: '#fff', letterSpacing: '-0.04em' }}>iHYPE</div>
          </div>

          {/* Type badge */}
          <div style={{
            padding: '7px 18px', borderRadius: 99,
            background: `${typeColor}22`,
            border: `1.5px solid ${typeColor}55`,
            fontSize: 13, fontWeight: 700, color: typeColor, letterSpacing: '0.12em',
            display: 'flex',
          }}>
            {typeLabel}
          </div>
        </div>

        {/* Main content */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          justifyContent: 'center', padding: '0 56px',
        }}>
          {kicker && (
            <div style={{
              fontSize: 14, fontWeight: 700, color: typeColor,
              letterSpacing: '0.16em', textTransform: 'uppercase',
              marginBottom: 16,
              display: 'flex',
            }}>
              {kicker}
            </div>
          )}
          <div style={{
            fontSize: title.length > 40 ? 52 : title.length > 25 ? 62 : 72,
            fontWeight: 900, color: '#f0ebe5',
            letterSpacing: '-0.04em', lineHeight: 0.95,
            marginBottom: 24,
            display: 'flex',
          }}>
            {title}
          </div>
          {subtitle && (
            <div style={{
              fontSize: 22, color: 'rgba(240,235,229,0.55)',
              letterSpacing: '-0.01em', lineHeight: 1.4,
              display: 'flex',
            }}>
              {subtitle.slice(0, 100)}
            </div>
          )}
        </div>

        {/* Bottom bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 56px 44px',
        }}>
          <div style={{ fontSize: 16, color: 'rgba(240,235,229,0.3)', letterSpacing: '0.04em', display: 'flex' }}>
            ihype.org
          </div>
          <div style={{
            fontSize: 14, color: 'rgba(240,235,229,0.4)', letterSpacing: '0.04em',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: teal, display: 'flex' }} />
            0% fees · 45/45/10 split
          </div>
        </div>

        {/* Accent bottom stripe */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 4,
          background: `linear-gradient(90deg, ${accent}, ${typeColor})`,
          display: 'flex',
        }} />
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
