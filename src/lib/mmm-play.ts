/**
 * Turning a list of rows into something the player can actually play.
 *
 * ## Why this is a module rather than four inline maps
 *
 * Every MUSIC surface holds rows that are nearly playable — a station's tracks,
 * the recommended list, the national chart — and each one was mapping them to
 * the player's shape inline, or not at all. `RadioTab` had the only correct
 * version, including the filter that matters: a row with no stored audio cannot
 * be played, and leaving it in the queue stalls the player on a dead entry.
 * `ChartsTab` dropped `mediaUrl` in its own row type, so the chart could not be
 * played at all despite the endpoint returning it.
 *
 * One conversion, one filter, one place to fix. Pure and dependency-free so it
 * can be tested without a DOM or a network.
 */
import type { MediaTrack } from '@/components/GlobalMediaPlayer';

/** The common shape of a playable row across the MUSIC endpoints. */
export type PlayableRow = {
  id?: string | null;
  hexId?: string | null;
  title?: string | null;
  artistName?: string | null;
  artistSlug?: string | null;
  /* The audio, under either of the two names the app's own columns use:
     `ArtistMediaAsset.storageUrl` surfaces as `mediaUrl` through the station and
     chart endpoints, while `FanPlaylistItem` stores it as `url`. One concept,
     two column names, so this accepts both rather than making four callers
     rename a field on the way in. */
  mediaUrl?: string | null;
  url?: string | null;
  artworkUrl?: string | null;
  /* An advertising break mixed into a station rotation carries this; a music
     row never does. It has to survive the conversion or the player cannot tell
     a paid spot from a song, which is both an unbilled impression and a
     MediaListen written against an artist who did not perform it. */
  adClipId?: string | null;
};

/**
 * Rows to a queue, dropping anything unplayable.
 *
 * The filter is the load-bearing part and it is not defensive coding: these
 * endpoints return rows whose `storageUrl` is null — a track uploaded but never
 * stored, or held by moderation — and the player advances through its queue by
 * index. One dead entry is a stall, not a skip.
 *
 * `id` prefers `hexId` because that is what the rest of the app addresses a
 * track by (`/app/tracks/[hexId]`, the embed route), so a queue entry and a link
 * agree. `mediaId` carries the same value: the impression and listen endpoints
 * key on it.
 */
export function toQueue(rows: readonly PlayableRow[]): MediaTrack[] {
  const queue: MediaTrack[] = [];
  for (const row of rows) {
    const url = row.mediaUrl || row.url;
    if (!url) continue;
    const id = row.hexId || row.id;
    if (!id) continue;
    const adClipId = row.adClipId ?? null;
    queue.push({
      id,
      /* An ad is not media anyone listened to, so it carries no `mediaId` —
         that field is what gates the listen write in the player. */
      mediaId: adClipId ? null : row.hexId || row.id || null,
      adClipId,
      title: row.title || 'Untitled',
      artistName: row.artistName || 'Unknown artist',
      url,
      artistProfileSlug: row.artistSlug || null,
      artworkUrl: row.artworkUrl ?? null,
    });
  }
  return queue;
}

/**
 * The station the transport falls back to when the surface offers nothing.
 *
 * Deterministic on purpose: the same tap in the same place must start the same
 * thing, so this is the first station in the endpoint's own order rather than a
 * random pick. The endpoint orders them itself, and its first entry is the
 * broadest — which is what "just play something" wants.
 *
 * Returns null for an empty list rather than throwing: no stations is a real
 * state on a new install, and the caller's job is then to leave the transport
 * alone rather than to fail.
 */
export function defaultStationSlug(stations: readonly { slug?: string | null }[]): string | null {
  for (const station of stations) if (station.slug) return station.slug;
  return null;
}
