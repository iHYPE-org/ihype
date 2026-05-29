import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import QRCode from 'qrcode';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ showId: string }> }
) {
  const { showId } = await params;

  const show = await db.show.findUnique({
    where: { id: showId },
    select: { slug: true, title: true },
  });

  if (!show) {
    return NextResponse.json({ error: 'Show not found.' }, { status: 404 });
  }

  const url = `https://ihype.org/shows/${show.slug}`;
  const buffer = await QRCode.toBuffer(url, { type: 'png', width: 512, margin: 2 });
  const uint8 = new Uint8Array(buffer);

  return new NextResponse(uint8, {
    headers: {
      'Content-Type': 'image/png',
      'Content-Disposition': `attachment; filename="qr-${show.slug}.png"`,
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
