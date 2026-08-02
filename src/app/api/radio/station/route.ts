import { NextResponse } from 'next/server';
import { getStationState } from '@/lib/radioStation';
import { log } from '@/lib/logger';
import { isRadioEnabledRuntime } from '@/lib/runtime-flags';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    if (!(await isRadioEnabledRuntime())) return NextResponse.json({ error: 'Radio is temporarily paused.', code: 'RADIO_PAUSED' }, { status: 503, headers: { 'Retry-After': '300' } });
    const state = await getStationState();
    return NextResponse.json(state, {
      // Short CDN cache — the station advances slowly and all listeners share it.
      headers: { 'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=15' },
    });
  } catch (err) {
    log.error('[api/radio/station]', err instanceof Error ? err : { error: String(err) }, 'error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
