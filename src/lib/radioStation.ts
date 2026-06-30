import { db } from '@/lib/db';
import { getDemoOwnerExclusion } from '@/lib/runtime-flags';

export type StationTrack = {
  hexId: string;
  title: string;
  url: string;
  artistName: string;
  artistSlug: string;
  artworkUrl: string | null;
  durationSecs: number;
};

export type StationState = {
  live: boolean;                 // a real DJ show is broadcasting now
  liveShow: { slug: string; title: string } | null;
  nowPlaying: StationTrack | null;
  positionSecs: number;          // how far into nowPlaying the station is
  upNext: StationTrack[];        // the next few tracks in rotation
  rotationLength: number;        // total tracks in the auto-DJ rotation
};

// Fallback when a free-use track has no stored duration.
const NOMINAL_DURATION = 210;
const ROTATION_SIZE = 40;

/**
 * The always-on auto-DJ station. The free-use crate plays on a continuous,
 * deterministic loop seeded by server time, so every listener hears the same
 * track at the same offset — the station is never silent, even with no live
 * DJ. If a DJ show is actually LIVE, that takes precedence (live === true).
 */
export async function getStationState(now: Date = new Date()): Promise<StationState> {
  const [liveShow, rows] = await Promise.all([
    db.show.findFirst({
      where: { isRadioShow: true, status: 'LIVE' },
      orderBy: { startsAt: 'desc' },
      select: { slug: true, title: true },
    }).catch(() => null),
    db.artistMediaAsset.findMany({
      where: {
        freeUseEnabled: true,
        profile: { ...getDemoOwnerExclusion(), type: { in: ['ARTIST', 'DJ'] } },
      },
      orderBy: { profile: { hypeCount: 'desc' } },
      take: ROTATION_SIZE,
      select: {
        hexId: true, title: true, durationSecs: true,
        profile: { select: { name: true, slug: true, avatarImage: true } },
      },
    }).catch(() => [] as Array<{
      hexId: string; title: string; durationSecs: number | null;
      profile: { name: string; slug: string; avatarImage: string | null };
    }>),
  ]);

  const rotation: StationTrack[] = rows.map((t: {
    hexId: string; title: string; durationSecs: number | null;
    profile: { name: string; slug: string; avatarImage: string | null };
  }) => ({
    hexId: t.hexId,
    title: t.title,
    url: `/api/media/${t.hexId}`,
    artistName: t.profile.name,
    artistSlug: t.profile.slug,
    artworkUrl: t.profile.avatarImage ?? null,
    durationSecs: t.durationSecs && t.durationSecs > 0 ? t.durationSecs : NOMINAL_DURATION,
  }));

  if (rotation.length === 0) {
    return {
      live: !!liveShow,
      liveShow: liveShow ?? null,
      nowPlaying: null,
      positionSecs: 0,
      upNext: [],
      rotationLength: 0,
    };
  }

  // Total loop duration, then find where "now" lands inside the looping rotation.
  const loopTotal = rotation.reduce((sum, t) => sum + t.durationSecs, 0);
  const elapsed = Math.floor(now.getTime() / 1000) % loopTotal;

  let cursor = elapsed;
  let index = 0;
  for (let i = 0; i < rotation.length; i++) {
    if (cursor < rotation[i].durationSecs) {
      index = i;
      break;
    }
    cursor -= rotation[i].durationSecs;
  }

  const upNext = [1, 2, 3].map((offset) => rotation[(index + offset) % rotation.length]);

  return {
    live: !!liveShow,
    liveShow: liveShow ?? null,
    nowPlaying: rotation[index],
    positionSecs: cursor,
    upNext,
    rotationLength: rotation.length,
  };
}
