import { ImageResponse } from 'next/og';
import { db } from '@/lib/db';
import { getServerT } from '@/lib/i18n/server';
import { BrandMarkImage } from '@/components/brand/BrandMarkImage';
import { OG, OG_FRAME, OG_KICKER } from '@/app/api/og/palette';

export const runtime = 'nodejs';
export const alt = 'Fan on iHYPE';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const t = await getServerT();
  const { slug } = await params;

  const profile = await db.profile.findUnique({
    where: { slug },
    select: { name: true, city: true, stateRegion: true, type: true, ownerId: true },
  });

  if (!profile || profile.type !== 'LISTENER') {
    // Fallback card for missing/non-fan profiles.
    return new ImageResponse(
      (
        <div style={OG_FRAME}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <BrandMarkImage accent={OG.accent} height={28} ink={OG.ink} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ ...OG_KICKER, color: OG.fan }}>{t('fansSlugOpengraphImage.kicker', 'My scene')}</div>
            <div style={{ fontSize: 64, fontWeight: 800, color: OG.ink, lineHeight: 0.98, letterSpacing: '-0.03em' }}>{t('fansSlugOpengraphImage.fallbackTitle', 'Fan on iHYPE')}</div>
            <div style={{ fontSize: 24, color: OG.ink3 }}>{t('fansSlugOpengraphImage.fallbackSubtitle', 'Independent music, built for the scene.')}</div>
          </div>
          <div style={{ color: OG.ink3, fontSize: 20, letterSpacing: '0.04em' }}>{/* One text node, not two: `ihype.org/…/{slug}` is TWO children to Satori and it refuses a
            div holding them without display:flex — which is why this card had never rendered. */}
        {`ihype.org/fans/${slug}`}</div>
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
  // Fan profiles never publish a location (public-location.ts); this card is
  // unauthenticated and was painting the fan's city into a PNG.
  const city = '';

  return new ImageResponse(
    (
      <div style={OG_FRAME}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <BrandMarkImage accent={OG.accent} height={28} ink={OG.ink} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ ...OG_KICKER, color: OG.fan }}>{t('fansSlugOpengraphImage.kicker', 'My scene')}</div>
          <div style={{ fontSize: 68, fontWeight: 800, color: OG.ink, lineHeight: 0.98, letterSpacing: '-0.03em' }}>{profile.name}</div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            {city && <span style={{ fontSize: 22, color: OG.ink3 }}>{city}</span>}
            <span style={{ fontSize: 22, color: OG.ink3 }}>{followCount} {t('fansSlugOpengraphImage.following', 'following')}</span>
            <span style={{ fontSize: 22, color: OG.ink3 }}>{rsvpCount} {rsvpCount === 1 ? t('fansSlugOpengraphImage.showSingular', 'show') : t('fansSlugOpengraphImage.showPlural', 'shows')} {t('fansSlugOpengraphImage.rsvpd', "RSVP'd")}</span>
          </div>
          {topArtists.length > 0 && (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
              {topArtists.map((name) => (
                <span
                  key={name}
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: OG.ink,
                    background: OG.bg2,
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
        <div style={{ color: OG.ink3, fontSize: 20, letterSpacing: '0.04em' }}>{`ihype.org/fans/${slug}`}</div>
      </div>
    ),
    { ...size }
  );
}
