import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ showId: string }> }
) {
  const { showId } = await params;

  const show = await db.show.findUnique({
    where: { id: showId },
    select: { slug: true },
  });

  if (!show) {
    return NextResponse.json({ error: 'Show not found.' }, { status: 404 });
  }

  const target = `https://ihype.org/shows/${show.slug}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=512x512&margin=10&data=${encodeURIComponent(target)}`;

  // Proxy the image so the response appears to come from ihype.org
  const img = await fetch(qrUrl);
  const body = await img.arrayBuffer();

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'image/png',
      'Content-Disposition': `attachment; filename="qr-${show.slug}.png"`,
      'Cache-Control': 'public, s-maxage=86400',
    },
  });
}
