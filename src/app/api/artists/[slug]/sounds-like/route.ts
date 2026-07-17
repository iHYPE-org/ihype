import { NextRequest, NextResponse } from 'next/server';
import { getSimilarArtists } from '@/lib/sounds-like';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const similar = await getSimilarArtists(slug);
  return NextResponse.json({ similar });
}
