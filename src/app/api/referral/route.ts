import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getBaseUrl } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { username: true, isEighteenOrOlder: true, profiles: { select: { hexId: true, type: true }, orderBy: { createdAt: 'asc' } } }
    });
    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (!user.isEighteenOrOlder) {
      return NextResponse.json(
        {
          error: 'Referral links require you to be 18 or older. Confirm your age in Settings to start referring.',
          code: 'AGE_18_REQUIRED',
        },
        { status: 403 },
      );
    }

    const baseUrl = getBaseUrl();
    const fanProfile = user.profiles.find(p => p.type === 'LISTENER') ?? user.profiles[0];
    const artistProfile = user.profiles.find(p => p.type === 'ARTIST');
    const venueProfile = user.profiles.find(p => p.type === 'VENUE');
    const djProfile = user.profiles.find(p => p.type === 'DJ');

    const hexId = fanProfile?.hexId ?? null;
    // "HYPE Link" — short /h/{code} alias that resolves to the same
    // /register?ref= flow (see src/app/h/[code]/page.tsx).
    const referralLink = hexId
      ? `${baseUrl}/h/${hexId}`
      : `${baseUrl}/h/${user.username}`;

    const artistLink = artistProfile?.hexId ? `${baseUrl}/h/${artistProfile.hexId}` : null;
    const venueLink = venueProfile?.hexId ? `${baseUrl}/h/${venueProfile.hexId}` : null;
    const djLink = djProfile?.hexId ? `${baseUrl}/h/${djProfile.hexId}` : null;

    // Count referrals — username-based and hexId-based
    const usernameCount = await db.auditLog.count({
      where: {
        action: 'REFERRAL_SIGNUP',
        metadata: { path: ['referrer'], equals: user.username }
      }
    });
    const hexIdCount = hexId
      ? await db.auditLog.count({
          where: {
            action: 'REFERRAL_SIGNUP',
            metadata: { path: ['referrerHexId'], equals: hexId }
          }
        })
      : 0;
    // Use the higher of the two counts (deduplicated via username check in register route)
    const referralCount = Math.max(usernameCount, hexIdCount);

    // Get the last 10 referrals
    const recentLogs = await db.auditLog.findMany({
      where: {
        action: 'REFERRAL_SIGNUP',
        metadata: { path: ['referrer'], equals: user.username }
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { entityId: true, createdAt: true }
    });

    const userIds = recentLogs.map((l) => l.entityId).filter(Boolean) as string[];
    const referredUsers = userIds.length > 0
      ? await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, username: true } })
      : [];
    const usernameById = new Map(referredUsers.map((u) => [u.id, u.username]));

    const referrals = recentLogs
      .filter((l) => l.entityId && usernameById.has(l.entityId))
      .map((l) => ({
        username: usernameById.get(l.entityId!)!,
        joinedAt: l.createdAt.toISOString()
      }));

    const shareText = referralCount > 0
      ? `I've brought ${referralCount} ${referralCount === 1 ? 'friend' : 'friends'} to iHYPE! Join the music community → ${referralLink}`
      : `Join me on iHYPE — the music community → ${referralLink}`;

    return NextResponse.json({ referralLink, referralCount, referrals, shareText, artistLink, venueLink, djLink });
  } catch (err) {
    console.error('[api/referral] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
