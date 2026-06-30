import { NextResponse } from 'next/server';
import { getStationState } from '@/lib/radioStation';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const state = await getStationState();
    return NextResponse.json(state, {
      // Short CDN cache — the station advances slowly and all listeners share it.
      headers: { 'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=15' },
    });
  } catch (err) {
    console.error('[api/radio/station] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
