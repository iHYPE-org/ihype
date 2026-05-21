import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getBaseUrl } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const show = await db.show.findUnique({ where: { slug }, select: { title: true } });
  const title = show?.title ?? 'iHYPE Show';
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
          background: '#0a0a0f',
          color: '#ffffff',
          fontFamily: 'sans-serif',
          padding: 40
        }}
      >
        <div style={{ fontSize: 18, color: '#ff5029', letterSpacing: 4, marginBottom: 16 }}>
          iHYPE CHECK-IN
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, textAlign: 'center', marginBottom: 32 }}>
          {title}
        </div>
        <div
          style={{
            background: '#ffffff',
            color: '#0a0a0f',
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
        <div style={{ fontSize: 12, color: '#888', marginTop: 20 }}>
          Scan or visit the URL above to check in
        </div>
      </div>
    ),
    { width: 600, height: 400 }
  );
}
