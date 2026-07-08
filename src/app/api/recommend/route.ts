import { NextResponse } from 'next/server';
import type { ProfileType } from '@prisma/client';
import { auth } from '@/lib/auth';
import { detectRequestLocation } from '@/lib/request-location';
import { getRecommendations } from '@/lib/recommendations';
import { enhanceRecommendationsWithAI } from '@/lib/ai-recommendations';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const typeParam = searchParams.get('type')?.toUpperCase() as ProfileType | null;
    const limitParam = Number.parseInt(searchParams.get('limit') ?? '40', 10);
    const limit = Number.isNaN(limitParam) ? 40 : limitParam;
    const useAI = searchParams.get('ai') !== '0';

    const [session, requestLocation] = await Promise.all([
      auth().catch(() => null),
      detectRequestLocation().catch(() => null),
    ]);

    const result = await getRecommendations(session?.user?.id ?? null, requestLocation, {
      type: typeParam,
      limit,
    });

    if (!useAI) return NextResponse.json({ ...result, aiEnhanced: false });

    const { profiles, aiEnhanced } = await enhanceRecommendationsWithAI(result.profiles, {
      genres: result.meta.viewerGenres,
      city: result.meta.viewerCity,
      stateRegion: result.meta.viewerState,
      hasHypeHistory: result.meta.viewerHasHypeHistory,
    });

    return NextResponse.json({ ...result, profiles, aiEnhanced });
  } catch (err) {
    console.error('[api/recommend] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
