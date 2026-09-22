import { ImageResponse } from 'next/og';
import { db } from '@/lib/db';
import { getServerT } from '@/lib/i18n/server';
import { BrandMarkImage } from '@/components/brand/BrandMarkImage';
import { OG, OG_FRAME, OG_KICKER } from '@/app/api/og/palette';

export const runtime = 'nodejs';
export const alt = 'Venue on iHYPE';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = await getServerT();
  const profile = await db.profile.findUnique({
    where: { slug },
    select: { name: true, city: true, stateRegion: true, hypeCount: true }
  });

  const name = profile?.name ?? t('venuesSlugOpengraphImage.fallbackName', 'Venue');
  const location = [profile?.city, profile?.stateRegion].filter(Boolean).join(', ');
  const hype = profile?.hypeCount ? `${profile.hypeCount} HYPE` : '';

  return new ImageResponse(
    (
      <div style={OG_FRAME}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <BrandMarkImage accent={OG.accent} height={28} ink={OG.ink} />
          {/* The venue hue is the one thing that tells this card from an artist's, as on the panes. */}
          <span style={{ ...OG_KICKER, color: OG.venue, marginLeft: 24, letterSpacing: '0.16em' }}>
            {t('venuesSlugOpengraphImage.venueTag', 'VENUE')}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 80, fontWeight: 800, color: OG.ink, lineHeight: 0.98, letterSpacing: '-0.04em' }}>
            {name}
          </div>
          <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
            {location ? <span style={{ fontSize: 24, color: OG.ink3 }}>{location}</span> : null}
            {hype ? <span style={{ fontSize: 24, color: OG.venue, fontWeight: 700 }}>{hype}</span> : null}
          </div>
        </div>
        <div style={{ color: OG.ink3, fontSize: 20, letterSpacing: '0.04em' }}>
          {/* One text node, not two: `ihype.org/…/{slug}` is TWO children to Satori and it refuses a
            div holding them without display:flex — which is why this card had never rendered. */}
        {`ihype.org/venues/${slug}`}
        </div>
      </div>
    ),
    { ...size }
  );
}
