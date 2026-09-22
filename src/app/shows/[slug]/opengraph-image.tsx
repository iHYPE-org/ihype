import { ImageResponse } from 'next/og';
import { db } from '@/lib/db';
import { getServerT } from '@/lib/i18n/server';
import { formatDoorTime } from '@/lib/format-locale';
import { BrandMarkImage } from '@/components/brand/BrandMarkImage';
import { OG, OG_FRAME, OG_KICKER } from '@/app/api/og/palette';

export const runtime = 'nodejs';
export const alt = 'Show on iHYPE';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = await getServerT();
  const show = await db.show.findUnique({
    where: { slug },
    select: {
      title: true, startsAt: true, timeZone: true, status: true,
      venueProfile: { select: { name: true, city: true, stateRegion: true } },
      headlinerProfile: { select: { name: true } },
    },
  });

  const title = show?.title ?? t('showsSlugOpengraphImage.show', 'Show');
  const date = show?.startsAt
    ? formatDoorTime('en', show.startsAt, show.timeZone, { month: 'short', day: 'numeric', year: 'numeric' })
    : '';
  const venue = show?.venueProfile?.name ?? '';
  const city = [show?.venueProfile?.city, show?.venueProfile?.stateRegion].filter(Boolean).join(', ');
  const headliner = show?.headlinerProfile?.name ?? '';
  const isLive = show?.status === 'LIVE';

  return new ImageResponse(
    (
      <div style={OG_FRAME}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <BrandMarkImage accent={OG.accent} height={28} ink={OG.ink} />
          {isLive && (
            <span style={{ marginLeft: 16, fontSize: 14, fontWeight: 800, letterSpacing: '0.12em', color: OG.bg, background: OG.accent, padding: '4px 12px', borderRadius: 999 }}>{t('showsSlugOpengraphImage.liveBadge', '● LIVE')}</span>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {date && (
            <div style={{ ...OG_KICKER, color: OG.accent }}>
              {date}
            </div>
          )}
          <div style={{ fontSize: 72, fontWeight: 800, color: OG.ink, lineHeight: 0.98, letterSpacing: '-0.03em' }}>{title}</div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            {headliner && <span style={{ fontSize: 22, color: OG.ink2 }}>{headliner}</span>}
            {venue && <span style={{ fontSize: 22, color: OG.ink3 }}>{venue}</span>}
            {city && <span style={{ fontSize: 22, color: OG.ink3 }}>{city}</span>}
          </div>
        </div>
        <div style={{ color: OG.ink3, fontSize: 20, letterSpacing: '0.04em' }}>{/* One text node, not two: `ihype.org/…/{slug}` is TWO children to Satori and it refuses a
            div holding them without display:flex — which is why this card had never rendered. */}
        {`ihype.org/shows/${slug}`}</div>
      </div>
    ),
    { ...size }
  );
}
