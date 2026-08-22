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
