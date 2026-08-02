import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { resolveAdBreakClips } from '@/lib/ad-clip-selection';
import type { AdvertisingScope } from '@/lib/show-composer';
import { isRadioEnabledRuntime } from '@/lib/runtime-flags';

export const dynamic = 'force-dynamic';

/**
 * Real, purchased marketplace ad spots (the self-serve Coverage Builder at
 * /advertise) eligible to fill a DJ radio show's ad break, for the given
 * reach scope. Feeds RadioShowCreator's ad-break picker. resolveAdBreakClips
 * falls back to the placeholder catalog (builtInAdClips) when no real
 * campaign exists for the scope — `isMarketplace` tells the client which one
 * it got, so the preview modal's copy stays honest either way.
 */
export async function GET(request: NextRequest) {
  if (!(await isRadioEnabledRuntime())) return NextResponse.json({ error: 'Radio is temporarily paused.', code: 'RADIO_PAUSED' }, { status: 503, headers: { 'Retry-After': '300' } });
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Login required' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const scopeParam = (searchParams.get('scope') ?? 'local') as AdvertisingScope;

  const clips = await resolveAdBreakClips(scopeParam);
  const isMarketplace = clips.some((c) => c.clipId.startsWith('mkt_'));
  return NextResponse.json({ clips, isMarketplace });
}
