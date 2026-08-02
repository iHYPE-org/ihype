import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getDjAdPlan } from '@/lib/ai-dj-ads';
import { isRadioEnabledRuntime } from '@/lib/runtime-flags';

export const dynamic = 'force-dynamic';

// Advertising recommendation for the signed-in DJ's radio shows, consumed by
// the Radio Show Creator to pre-set ad scope and size ad breaks.
export async function GET() {
  if (!(await isRadioEnabledRuntime())) return NextResponse.json({ error: 'Radio is temporarily paused.', code: 'RADIO_PAUSED' }, { status: 503, headers: { 'Retry-After': '300' } });
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const profile = await db.profile.findFirst({
    where: { ownerId: session.user.id, type: 'DJ' },
    select: { id: true, name: true, genres: true, city: true, stateRegion: true, hypeCount: true },
  }).catch(() => null);

  if (!profile) return NextResponse.json({ error: 'DJ profile required.' }, { status: 404 });

  const [crateSize, radioShowCount] = await Promise.all([
    db.artistMediaAsset.count({ where: { profileId: profile.id, freeUseEnabled: true } }).catch(() => 0),
    db.show.count({ where: { promoterProfileId: profile.id, isRadioShow: true } }).catch(() => 0),
  ]);

  const plan = await getDjAdPlan({
    name: profile.name,
    genres: profile.genres,
    city: profile.city,
    stateRegion: profile.stateRegion,
    hypeCount: profile.hypeCount,
    crateSize,
    radioShowCount,
  });

  return NextResponse.json({ plan });
}
