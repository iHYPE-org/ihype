import { NextRequest } from 'next/server';
import { ImageResponse } from 'next/og';
import { db } from '@/lib/db';
import { BrandMarkImage } from '@/components/brand/BrandMarkImage';
import { OG, OG_FRAME } from '@/app/api/og/palette';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ profileId: string }> }
) {
  const { profileId } = await params;
  const { searchParams } = new URL(request.url);
  const milestone = searchParams.get('milestone') ?? '100 HYPES';

  const profile = await db.profile.findUnique({
    where: { id: profileId },
    select: { name: true }
  });

  const name = profile?.name ?? 'Artist';

  /* The figure used to be painted through `background-clip: text` over
     `linear-gradient(135deg, var(--role-venue), #b44fff)` — and Satori has no
     stylesheet, so `var(--role-venue)` resolved to nothing and the card's one
     number rendered as a purple smear at best. It is the accent, flat. */
  return new ImageResponse(
    (
      <div style={{ ...OG_FRAME, width: 1200, height: 630, alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', marginBottom: 28 }}>
          <BrandMarkImage accent={OG.accent} height={26} ink={OG.ink} />
        </div>
        <div
          style={{
            fontSize: 96,
            fontWeight: 800,
            color: OG.accent,
            letterSpacing: '-0.03em',
            lineHeight: 1,
            marginBottom: 16
          }}
        >
          {milestone}
        </div>
        <div style={{ fontSize: 42, fontWeight: 600, color: OG.ink }}>
          {name}
        </div>
        <div style={{ fontSize: 18, color: OG.ink3, marginTop: 32, letterSpacing: '0.04em' }}>
          ihype.org
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
