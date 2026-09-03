import { describe, expect, it } from 'vitest';
import { defaultStationSlug, toQueue } from '@/lib/mmm-play';

describe('toQueue', () => {
  it('drops a row with no stored audio rather than queueing a dead entry', () => {
    // The player advances by index, so an unplayable entry is a stall, not a
    // skip. These endpoints really do return null storageUrl — a track
    // uploaded but not stored, or held by moderation.
    const queue = toQueue([
      { hexId: 'a', title: 'One', artistName: 'X', mediaUrl: 'https://r2/a.mp3' },
      { hexId: 'b', title: 'Two', artistName: 'Y', mediaUrl: null },
      { hexId: 'c', title: 'Three', artistName: 'Z', mediaUrl: 'https://r2/c.mp3' },
    ]);
    expect(queue.map((t) => t.id)).toEqual(['a', 'c']);
  });

  it('addresses a track by hexId, so a queue entry and a link agree', () => {
    const [track] = toQueue([{ id: 'row-1', hexId: 'deadbeef', title: 'T', artistName: 'A', mediaUrl: 'u' }]);
    expect(track.id).toBe('deadbeef');
    expect(track.mediaId).toBe('deadbeef');
  });

  it('falls back to id when a row carries no hexId', () => {
    const [track] = toQueue([{ id: 'row-1', title: 'T', artistName: 'A', mediaUrl: 'u' }]);
    expect(track.id).toBe('row-1');
  });

  it('drops a row with a url but no identity — it could not be addressed later', () => {
    expect(toQueue([{ title: 'T', artistName: 'A', mediaUrl: 'u' }])).toEqual([]);
  });

  it('names the unnamed rather than rendering blank rows in the queue panel', () => {
    const [track] = toQueue([{ hexId: 'a', mediaUrl: 'u' }]);
    expect(track.title).toBe('Untitled');
    expect(track.artistName).toBe('Unknown artist');
  });

  it('is empty for an empty list, not undefined', () => {
    expect(toQueue([])).toEqual([]);
  });

  it('accepts `url` as well as `mediaUrl`, which are the same column twice', () => {
    // Station and chart rows carry `mediaUrl`; FanPlaylistItem stores the same
    // thing as `url`. A playlist that silently produced an empty queue was the
    // bug this branch exists to prevent.
    const [track] = toQueue([{ hexId: 'a', title: 'T', artistName: 'A', url: 'https://r2/a.mp3' }]);
    expect(track.url).toBe('https://r2/a.mp3');
  });

  it('prefers mediaUrl when a row somehow carries both', () => {
    const [track] = toQueue([{ hexId: 'a', mediaUrl: 'from-media', url: 'from-url' }]);
    expect(track.url).toBe('from-media');
  });
});

describe('defaultStationSlug', () => {
  it('takes the first station, so the same tap always starts the same thing', () => {
    expect(defaultStationSlug([{ slug: 'local' }, { slug: 'new' }])).toBe('local');
  });

  it('skips an entry with no slug rather than returning a broken URL', () => {
    expect(defaultStationSlug([{ slug: null }, { slug: 'new' }])).toBe('new');
  });

  it('returns null when there are no stations — a real state on a new install', () => {
    expect(defaultStationSlug([])).toBeNull();
  });
});

/**
 * The memo key `useRegisterQueue` builds from its rows.
 *
 * Restated here rather than reached through React, because what it has to
 * guarantee is testable on its own: unchanged data must produce an unchanged
 * key. A fresh array with the same contents re-renders on every registration —
 * six renders, six state changes, measured — so the key is what stops the
 * registration churning. It is the same fault that took the Workerd server down
 * when the play-intent provider was first added, arriving by another route.
 */
function queueKey(rows: readonly { id?: string | null; hexId?: string | null; mediaUrl?: string | null; url?: string | null }[]) {
  return rows.map((row) => `${row.hexId ?? row.id ?? ''}|${row.mediaUrl ?? row.url ?? ''}`).join(',');
}

describe('the queue memo key', () => {
  it('is identical for a fresh array with the same contents', () => {
    // Exactly what a server component re-rendering a literal produces, and what
    // a client tab rebuilds from state that has not moved.
    const a = queueKey([{ hexId: 'a', mediaUrl: 'u1' }, { hexId: 'b', mediaUrl: 'u2' }]);
    const b = queueKey([{ hexId: 'a', mediaUrl: 'u1' }, { hexId: 'b', mediaUrl: 'u2' }]);
    expect(a).toBe(b);
  });

  it('changes when the audio changes, even at the same identity', () => {
    // A track re-stored at a new URL must re-register, or the queue plays the
    // old file.
    expect(queueKey([{ hexId: 'a', mediaUrl: 'u1' }])).not.toBe(queueKey([{ hexId: 'a', mediaUrl: 'u2' }]));
  });

  it('changes when the order changes — a playlist reordered is a new queue', () => {
    expect(queueKey([{ hexId: 'a' }, { hexId: 'b' }])).not.toBe(queueKey([{ hexId: 'b' }, { hexId: 'a' }]));
  });

  it('distinguishes a shorter list from a longer one with the same head', () => {
    expect(queueKey([{ hexId: 'a' }])).not.toBe(queueKey([{ hexId: 'a' }, { hexId: 'b' }]));
  });
});

/**
 * Advertising breaks in a station rotation.
 *
 * The station endpoint mixes paid spots into the rows it serves, and the player
 * has to be able to tell one from a song for two separate reasons: an ad that
 * looks like a track is never billed, and a track that looks like an ad — or an
 * ad carrying a `mediaId` — writes a listen against an artist who did not
 * perform it. Both hang on this conversion carrying one field through.
 */
describe('toQueue and advertising breaks', () => {
  it('carries adClipId through so the player can report the impression', () => {
    const [ad] = toQueue([
      { hexId: 'mkt_ad1', title: 'Spot', mediaUrl: 'https://cdn/spot.mp3', adClipId: 'mkt_ad1' },
    ]);
    expect(ad.adClipId).toBe('mkt_ad1');
  });

  it('gives an ad no mediaId, so it can never write a MediaListen', () => {
    const [ad] = toQueue([
      { hexId: 'mkt_ad1', title: 'Spot', mediaUrl: 'https://cdn/spot.mp3', adClipId: 'mkt_ad1' },
    ]);
    // `persistCompletedMediaListen` returns early without one — that null is
    // the whole guard, not a tidiness choice.
    expect(ad.mediaId).toBeNull();
  });

  it('leaves a music row exactly as it was', () => {
    const [track] = toQueue([{ hexId: 'abc', title: 'Song', mediaUrl: 'https://cdn/song.mp3' }]);
    expect(track.mediaId).toBe('abc');
    expect(track.adClipId).toBeNull();
  });

  it('drops an ad with no audio, like any other unplayable row', () => {
    // A break the player cannot decode is a stall, not a skip — the same reason
    // the filter exists for tracks.
    expect(toQueue([{ hexId: 'mkt_ad1', title: 'Spot', adClipId: 'mkt_ad1', mediaUrl: null }])).toHaveLength(0);
  });
});
