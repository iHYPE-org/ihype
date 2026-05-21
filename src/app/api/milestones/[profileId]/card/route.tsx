import { NextRequest } from 'next/server';
import { ImageResponse } from 'next/og';
import { db } from '@/lib/db';

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

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: 'linear-gradient(135deg, #0b0e18 0%, #1a0a2e 50%, #0b1628 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
          color: '#ffffff'
        }}
      >
        <div
          style={{
            fontSize: 24,
            letterSpacing: '0.3em',
            opacity: 0.6,
            textTransform: 'uppercase',
            marginBottom: 24
          }}
        >
          iHYPE
        </div>
        <div
          style={{
            fontSize: 96,
            fontWeight: 800,
            background: 'linear-gradient(135deg, #22e5d4, #b44fff)',
            backgroundClip: 'text',
            color: 'transparent',
            lineHeight: 1,
            marginBottom: 16
          }}
        >
          {milestone}
        </div>
        <div
          style={{
            fontSize: 42,
            fontWeight: 600,
            opacity: 0.9
          }}
        >
          {name}
        </div>
        <div
          style={{
            fontSize: 18,
            opacity: 0.45,
            marginTop: 32,
            letterSpacing: '0.1em'
          }}
        >
          ihype.org
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
