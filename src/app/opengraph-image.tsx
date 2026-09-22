import { ImageResponse } from 'next/og';
import { BrandMarkImage } from '@/components/brand/BrandMarkImage';
import { OG, OG_FRAME } from '@/app/api/og/palette';

export const runtime = 'nodejs';
export const alt = 'iHYPE — Independent music discovery for the scene';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OgImage() {
  return new ImageResponse(
    (
      <div style={OG_FRAME}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <BrandMarkImage accent={OG.accent} height={36} ink={OG.ink} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: 72, fontWeight: 800, color: OG.ink, lineHeight: 1.05, letterSpacing: '-0.03em' }}>
            <span>Independent music,</span>
            <span style={{ color: OG.accent }}>built for the scene.</span>
          </div>
          <div style={{ fontSize: 28, color: OG.ink3, maxWidth: 780 }}>
            Completely free · Not-for-profit · 0% ticket fees
          </div>
        </div>

        <div style={{ color: OG.ink3, fontSize: 22, letterSpacing: '0.04em' }}>ihype.org</div>
      </div>
    ),
    { ...size }
  );
}
