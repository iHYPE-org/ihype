import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import type { ShowAdClip, AdvertisingScope } from '@/lib/show-composer';

export const dynamic = 'force-dynamic';

const SCOPE_TO_DB: Record<AdvertisingScope, string> = {
  local: 'LOCAL',
  regional: 'REGIONAL',
  national: 'NATIONAL',
  global: 'GLOBAL',
};

/**
 * Real, purchased marketplace ad spots (the self-serve Coverage Builder at
 * /advertise) eligible to fill a DJ radio show's ad break, for the given
 * reach scope. Feeds RadioShowCreator's ad-break picker — falls back to the
 * placeholder catalog (builtInAdClips) client-side when this returns none,
 * exactly as before this endpoint existed.
 *
 * Prisma can't compare two columns (spentCents < budgetCents) in a WHERE
 * clause without raw SQL, so — same pattern as AdBanner.tsx — this fetches
 * a batch ordered by fewest impressions and filters budget-exhausted rows
 * in JS.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Login required' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const scopeParam = (searchParams.get('scope') ?? 'local') as AdvertisingScope;
  const dbScope = SCOPE_TO_DB[scopeParam] ?? SCOPE_TO_DB.local;

  const now = new Date();
  const candidates = await db.ad.findMany({
    where: {
      status: 'APPROVED',
      scope: dbScope,
      audioUrl: { not: null },
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
    },
    orderBy: { impressions: 'asc' },
    take: 20,
    select: { id: true, title: true, audioUrl: true, audioDurationSecs: true, budgetCents: true, spentCents: true },
  });

  const viable = candidates.filter((ad) => ad.budgetCents === 0 || ad.spentCents < ad.budgetCents);

  const clips: ShowAdClip[] = viable.slice(0, 4).map((ad) => ({
    clipId: `mkt_${ad.id}`,
    title: ad.title,
    url: ad.audioUrl as string,
    scope: scopeParam,
    mimeType: 'audio/mpeg',
    durationSeconds: ad.audioDurationSecs ?? undefined,
    notes: 'Marketplace ad — purchased via the Coverage Builder.',
  }));

  return NextResponse.json({ clips });
}
