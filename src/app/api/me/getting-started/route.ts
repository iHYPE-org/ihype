import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db, withDbRetry } from '@/lib/db';
import { buildGuide, type GuideSummary } from '@/lib/getting-started';
import { readUnavailableResponse } from '@/lib/read-unavailable';

export const dynamic = 'force-dynamic';

/**
 * The quick-start guide for the signed-in member: which steps apply to their
 * account type and which are already done (see `src/lib/getting-started.ts`).
 *
 * Read by the popup the shell shows a new member, and only when it is about to
 * show — the `/app` layout awaits the session and nothing else (row 509), so
 * this never sits in front of a pane.
 *
 * Scoped to the SESSION: no identifier is taken from the request. The profile
 * read is the one the response IS, so its failure is a 503, never a fan guide
 * handed to an artist; the four counts only tick steps, so each is caught to
 * "not done" — an unticked step still links where the work is done.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Login required.' }, { status: 401 });
  const userId = session.user.id;

  let profile: {
    id: string; slug: string; name: string; type: string;
    avatarImage: string | null; logoImage: string | null; bio: string | null;
    addressLine1: string | null; city: string | null; capacity: number | null;
    stripeConnectOnboarded: boolean; onboardedAt: Date | null;
    payoutMethodKind: string | null; payoutMethodDetails: string | null;
  } | null;
  try {
    profile = await withDbRetry(() =>
      db.profile.findFirst({
        where: { ownerId: userId, type: { in: ['ARTIST', 'VENUE'] } },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true, slug: true, name: true, type: true,
          avatarImage: true, logoImage: true, bio: true,
          addressLine1: true, city: true, capacity: true,
          stripeConnectOnboarded: true, onboardedAt: true,
          payoutMethodKind: true, payoutMethodDetails: true,
        },
      }),
    );
  } catch {
    return readUnavailableResponse('Your getting-started guide');
  }

  const headers = { 'Cache-Control': 'private, no-store' };

  if (!profile) {
    const guide = buildGuide({
      role: 'FAN', profile: null, hasPhoto: false, hasBio: false, trackCount: 0,
      hasVenueDetails: false, payoutsReady: false, payoutMethodSet: false, showCount: 0, onboarded: true,
    });
    return NextResponse.json({ guide, name: null }, { headers });
  }

  const isVenue = profile.type === 'VENUE';
  const profileId = profile.id;
  const [trackCount, showCount] = await Promise.all([
    isVenue
      ? Promise.resolve(0)
      : db.artistMediaAsset.count({ where: { profileId } }).catch(() => 0),
    db.show
      .count({
        where: {
          status: { not: 'CANCELED' },
          OR: [{ headlinerProfileId: profileId }, { venueProfileId: profileId }],
        },
      })
      .catch(() => 0),
  ]);

  const summary: GuideSummary = {
    role: isVenue ? 'VENUE' : 'ARTIST',
    profile: { id: profile.id, slug: profile.slug, name: profile.name },
    hasPhoto: Boolean(profile.avatarImage || profile.logoImage),
    hasBio: Boolean(profile.bio?.trim()),
    trackCount,
    hasVenueDetails: Boolean(profile.addressLine1?.trim() && profile.city?.trim() && profile.capacity),
    payoutsReady: profile.stripeConnectOnboarded,
    payoutMethodSet: Boolean(profile.payoutMethodKind && profile.payoutMethodDetails?.trim()),
    showCount,
    onboarded: Boolean(profile.onboardedAt),
  };

  return NextResponse.json({ guide: buildGuide(summary), name: profile.name }, { headers });
}
