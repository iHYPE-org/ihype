import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { log } from '@/lib/logger';
import { getRecommendations } from '@/lib/recommendations';
import { releasedMediaWhere } from '@/lib/media-release';
import { detectRequestLocation } from '@/lib/request-location';
import type { RequestLocation } from '@/lib/request-location';

export const dynamic = 'force-dynamic';

const LIMIT = 25;

/**
 * `GET /api/recommend` — the multi-signal recommender (`recommendations.ts`)
 * as the MUSIC module's Recommended tab reads it: one playable track per
 * recommended artist, each carrying the engine's own reason.
 *
 * Two rules, both the owner's (2026-09-01):
 *
 *  1. **Say nothing until it makes sense.** `ready` is false until the viewer
 *     has left a taste signal — a hype, a discover action, a follow, or a fan
 *     request — and the tab then shows an honest empty state, not a preview
 *     and not a chart dressed as a recommendation. See `isRecommendationReady`.
 *  2. **One track per act.** A recommendation is of an artist; the track is
 *     how the tab lets the dock's transport play it. Newest released track
 *     with stored audio, because a row with no audio stalls the player.
 *
 * Signed-in only — the engine reads the viewer's own hypes, follows, seeds and
 * requests — and `private, no-store` for the same reason.
 */
export type RecommendTrack = {
  id: string;
  hexId: string;
  title: string;
  artistName: string;
  artistSlug: string;
  mediaUrl: string | null;
  artworkUrl: string | null;
  reason: string;
  reasonKind: string;
};

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Login required.' }, { status: 401 });
    const viewerId = session.user.id;

    /* The fan's own location first — the address they chose to give — else
       the request's edge geolocation, the same order the request route uses. */
    const ownProfile = await db.profile.findFirst({
      where: { ownerId: viewerId, OR: [{ city: { not: null } }, { stateRegion: { not: null } }] },
      orderBy: { createdAt: 'asc' },
      select: { city: true, stateRegion: true, country: true, postalCode: true, latitude: true, longitude: true },
    }).catch(() => null);
    const location: RequestLocation | null = ownProfile
      ? { city: ownProfile.city, stateRegion: ownProfile.stateRegion, country: ownProfile.country, postalCode: ownProfile.postalCode, latitude: ownProfile.latitude, longitude: ownProfile.longitude, source: 'unknown' as const }
      : await detectRequestLocation().catch(() => null);

    const result = await getRecommendations(viewerId, location, { type: 'ARTIST', limit: LIMIT });
    if (!result.meta.ready) {
      return NextResponse.json(
        { ready: false, tracks: [], signals: result.meta.viewerSignals },
        { headers: { 'Cache-Control': 'private, no-store' } },
      );
    }

    const artistIds = result.profiles.map((profile) => profile.id);
    const rows = artistIds.length
      ? await db.artistMediaAsset.findMany({
          where: { profileId: { in: artistIds }, storageUrl: { not: null }, ...releasedMediaWhere(), profile: { discoverable: true } },
          orderBy: [{ createdAt: 'desc' }],
          select: { id: true, hexId: true, title: true, storageUrl: true, artworkUrl: true, profileId: true, album: { select: { artworkUrl: true } } },
        }).catch(() => [])
      : [];
    const newestByArtist = new Map<string, (typeof rows)[number]>();
    for (const row of rows) if (!newestByArtist.has(row.profileId)) newestByArtist.set(row.profileId, row);

    const tracks: RecommendTrack[] = [];
    for (const profile of result.profiles) {
      const track = newestByArtist.get(profile.id);
      if (!track) continue; // an act with no playable track is not a row this tab can offer
      tracks.push({
        id: track.id,
        hexId: track.hexId,
        title: track.title,
        artistName: profile.name,
        artistSlug: profile.slug,
        mediaUrl: track.storageUrl,
        artworkUrl: track.artworkUrl ?? track.album?.artworkUrl ?? profile.avatarImage,
        reason: profile.reason.text,
        reasonKind: profile.reason.kind,
      });
    }

    return NextResponse.json(
      { ready: true, tracks, signals: result.meta.viewerSignals },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    log.error('[api/recommend]', error instanceof Error ? error : { error: String(error) }, 'error');
    return NextResponse.json({ error: 'Recommendations are temporarily unavailable.' }, { status: 500 });
  }
}
