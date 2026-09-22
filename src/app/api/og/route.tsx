import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { BrandMarkImage } from '@/components/brand/BrandMarkImage';
import { OG, OG_FRAME, OG_KICKER } from './palette';

export const dynamic = 'force-dynamic';

/**
 * The generic share card: `?title=&subtitle=&type=&kicker=`.
 *
 * Until 2026-09-22 this was the fullest expression of the generated look in
 * the product — a navy ground, two blurred "gradient orbs" in the corners, a
 * 60px grid overlay, an orange-to-pink gradient tile with an `H` in it beside
 * a system-font "iHYPE", a teal type badge, and a two-hue gradient stripe
 * along the bottom. It is the ground, the mark, the words and one kicker now,
 * from the same palette as the other eight image routes.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const title    = searchParams.get('title')    ?? 'iHYPE';
  const subtitle = searchParams.get('subtitle') ?? 'Independent music for the scene';
  const type     = searchParams.get('type')     ?? 'default'; // show | artist | wrapped | playlist | journal | default
  const kicker   = searchParams.get('kicker')   ?? '';

  /* A fan's own things (their scene, their playlist) take the fan hue; everything else the accent. */
  const typeColor = type === 'wrapped' || type === 'playlist' ? OG.fan : OG.accent;
  const typeLabel =
    type === 'show' ? 'SHOW' :
    type === 'artist' ? 'ARTIST' :
    type === 'wrapped' ? 'MY SCENE' :
    type === 'playlist' ? 'PLAYLIST' :
    type === 'journal' ? 'JOURNAL' :
    '';

  return new ImageResponse(
    (
      <div style={{ ...OG_FRAME, padding: '56px 56px 44px' }}>
        {/* Top bar: the mark, and the type of thing this is */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <BrandMarkImage accent={OG.accent} height={30} ink={OG.ink} />
          {typeLabel && (
            <div style={{ ...OG_KICKER, fontSize: 14, letterSpacing: '0.12em', color: OG.ink3, display: 'flex' }}>
              {typeLabel}
            </div>
          )}
        </div>

        {/* Main content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {kicker && (
            <div style={{ ...OG_KICKER, fontSize: 14, letterSpacing: '0.16em', color: typeColor, marginBottom: 16, display: 'flex' }}>
              {kicker}
            </div>
          )}
          <div style={{
            fontSize: title.length > 40 ? 52 : title.length > 25 ? 62 : 72,
            fontWeight: 800, color: OG.ink,
            letterSpacing: '-0.04em', lineHeight: 0.95,
            marginBottom: 24,
            display: 'flex',
          }}>
            {title}
          </div>
          {subtitle && (
            <div style={{ fontSize: 22, color: OG.ink3, letterSpacing: '-0.01em', lineHeight: 1.4, display: 'flex' }}>
              {subtitle.slice(0, 100)}
            </div>
          )}
        </div>

        {/* Bottom bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 16, color: OG.ink3, letterSpacing: '0.04em', display: 'flex' }}>
            ihype.org
          </div>
          <div style={{ fontSize: 14, color: OG.ink3, letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: OG.accent, display: 'flex' }} />
            0% fees · 70/20/10 split
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
