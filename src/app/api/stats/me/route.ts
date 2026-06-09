import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Login required' }, { status: 401 });
    }

    const userId = session.user.id;
    const role = session.user.role ?? 'FAN';

    // ── Owned profiles ─────────────────────────────────────────────
    const profiles = await db.profile.findMany({
      where: { ownerId: userId },
      select: { id: true, type: true, hypeCount: true, name: true, slug: true }
    });
    const profileIds = profiles.map(p => p.id);
    const primaryProfile = profiles[0] ?? null;

    // ── Hype given ─────────────────────────────────────────────────
    const [hypeGivenShows, hypeGivenProfiles] = await Promise.all([
      db.hypeEvent.count({ where: { userId } }),
      db.profileHypeEvent.count({ where: { userId } })
    ]);
    const hypeGiven = hypeGivenShows + hypeGivenProfiles;

    // ── Hype received (from owned profiles + owned shows) ──────────
    const [ownedShowsHype, profilesHypeSum] = await Promise.all([
      db.show.aggregate({
        where: { creatorId: userId },
        _sum: { hypeCount: true }
      }),
      profiles.reduce((sum, p) => sum + p.hypeCount, 0)
    ]);
    const hypeReceived = (ownedShowsHype._sum.hypeCount ?? 0) + profilesHypeSum;
    const hypeRating = primaryProfile?.hypeCount ?? 0;

    // ── Song & show plays ──────────────────────────────────────────
    const [songPlays, showPlays] = await Promise.all([
      db.mediaListen.count({ where: { userId } }),
      db.showListen.count({ where: { userId } })
    ]);

    // ── Role-specific stats ────────────────────────────────────────
    let showStats: Record<string, unknown> | null = null;
    let ticketStats: Record<string, unknown> | null = null;
    let earningsStats: Record<string, unknown> | null = null;
    let geoStats: Array<{ region: string; country: string; count: number }> = [];
    let fanStats: Record<string, unknown> | null = null;

    const isCreator = ['ARTIST', 'DJ', 'VENUE'].includes(role);

    if (isCreator) {
      // Shows created by this user
      const shows = await db.show.findMany({
        where: { creatorId: userId },
        select: {
          id: true,
          status: true,
          isTicketed: true,
          ticketsSoldCount: true,
          ticketCapacity: true,
          hypeCount: true
        }
      });

      const totalTicketsSold = shows.reduce((s, sh) => s + sh.ticketsSoldCount, 0);
      const totalCapacity = shows.reduce((s, sh) => s + (sh.ticketCapacity ?? 0), 0);
      const showIds = shows.map(s => s.id);

      showStats = {
        total: shows.length,
        live: shows.filter(s => s.status === 'LIVE').length,
        scheduled: shows.filter(s => s.status === 'SCHEDULED').length,
        ended: shows.filter(s => s.status === 'ENDED').length,
        draft: shows.filter(s => s.status === 'DRAFT').length,
        ticketed: shows.filter(s => s.isTicketed).length,
        ticketsSold: totalTicketsSold,
        capacity: totalCapacity
      };

      // Ticket orders for creator's shows (CAPTURED only)
      if (showIds.length > 0) {
        const [orderAgg, orderGeo] = await Promise.all([
          db.ticketOrder.aggregate({
            where: { showId: { in: showIds }, status: 'CAPTURED' },
            _sum: { totalChargeCents: true, quantity: true }
          }),
          db.ticketOrder.findMany({
            where: { showId: { in: showIds }, status: 'CAPTURED' },
            select: { locationStateRegion: true, locationCountry: true },
            take: 2000
          })
        ]);

        ticketStats = {
          sold: orderAgg._sum.quantity ?? 0,
          revenueCents: orderAgg._sum.totalChargeCents ?? 0
        };

        // Aggregate geo
        const geoMap = new Map<string, number>();
        for (const o of orderGeo) {
          const region = o.locationStateRegion || 'Unknown';
          const country = o.locationCountry || 'Unknown';
          const key = `${region}||${country}`;
          geoMap.set(key, (geoMap.get(key) ?? 0) + 1);
        }
        geoStats = Array.from(geoMap.entries())
          .map(([key, count]) => {
            const [region, country] = key.split('||');
            return { region, country, count };
          })
          .sort((a, b) => b.count - a.count)
          .slice(0, 12);
      }

      // Earnings from accounts payable (their profile payout entries)
      if (profileIds.length > 0) {
        const earnings = await db.accountsPayableEntry.aggregate({
          where: {
            profileId: { in: profileIds },
            status: 'RELEASED',
            category: { in: ['VENUE_PAYOUT', 'ARTIST_PAYOUT', 'PROMOTER_AFFILIATE'] }
          },
          _sum: { amountCents: true }
        });
        earningsStats = {
          releasedCents: earnings._sum.amountCents ?? 0
        };
      }
    }

    // ── Fan-specific ───────────────────────────────────────────────
    if (role === 'FAN' || !isCreator) {
      const [ticketOrders, completedSongs, completedShows] = await Promise.all([
        db.ticketOrder.aggregate({
          where: { buyerUserId: userId, status: 'CAPTURED' },
          _sum: { quantity: true },
          _count: { id: true }
        }),
        db.mediaListen.count({ where: { userId, completedAt: { not: null } } }),
        db.showListen.count({ where: { userId } })
      ]);

      fanStats = {
        ticketsBought: ticketOrders._sum.quantity ?? 0,
        showsAttended: ticketOrders._count.id,
        songsCompleted: completedSongs,
        showsCompleted: completedShows
      };
    }

    return NextResponse.json({
      role,
      hype: { given: hypeGiven, received: hypeReceived, rating: hypeRating },
      plays: { songs: songPlays, shows: showPlays },
      profiles: profiles.map(p => ({ id: p.id, type: p.type, name: p.name, slug: p.slug, hypeCount: p.hypeCount })),
      showStats,
      ticketStats,
      earningsStats,
      geoStats,
      fanStats
    });
  } catch (err) {
    console.error('[api/stats/me] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
