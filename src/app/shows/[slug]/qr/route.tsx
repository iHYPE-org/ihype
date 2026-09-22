import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getBaseUrl } from '@/lib/utils';
import { getServerT } from '@/lib/i18n/server';
import { BrandMarkImage } from '@/components/brand/BrandMarkImage';
import { OG, OG_KICKER } from '@/app/api/og/palette';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const t = await getServerT();
  const show = await db.show.findUnique({ where: { slug }, select: { title: true } });
  const title = show?.title ?? t('showsSlugQrRoute.ihypeShow', 'iHYPE Show');
  const base = getBaseUrl();
  const checkinUrl = `${base}/shows/${slug}/checkin`;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: OG.bg,
          color: OG.ink,
          fontFamily: 'sans-serif',
          padding: 40
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <BrandMarkImage accent={OG.accent} height={18} ink={OG.ink} />
          <span style={{ ...OG_KICKER, fontSize: 16, color: OG.ink3 }}>
            {t('showsSlugQrRoute.ihypeCheckin', 'iHYPE CHECK-IN')}
          </span>
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, textAlign: 'center', marginBottom: 32 }}>
          {title}
        </div>
        <div
          style={{
            background: OG.bg2,
            color: OG.ink,
            borderRadius: 8,
            padding: '14px 20px',
            fontSize: 14,
            wordBreak: 'break-all',
            maxWidth: 460,
            textAlign: 'center'
          }}
        >
          {checkinUrl}
        </div>
        <div style={{ fontSize: 12, color: OG.ink3, marginTop: 20 }}>
          {t('showsSlugQrRoute.scanOrVisitToCheckin', 'Scan or visit the URL above to check in')}
        </div>
      </div>
    ),
    { width: 600, height: 400 }
  );
}
