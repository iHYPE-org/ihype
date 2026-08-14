import { describe, expect, it } from 'vitest';
import { resolvePick, splitQueue } from '@/lib/mmm-queue';

const QUEUE = ['a', 'b', 'c', 'd', 'e'];

describe('splitQueue', () => {
  it('splits one list at the current index, played most recent first', () => {
    expect(splitQueue(QUEUE, 2)).toEqual({ upNext: ['d', 'e'], played: ['b', 'a'] });
  });

  it('reports neither half when nothing is playing', () => {
    // -1 is the provider's "no current track". Treating it as 0 would report
    // the whole queue as already played.
    expect(splitQueue(QUEUE, -1)).toEqual({ upNext: [], played: [] });
  });

  it('handles both ends of the queue', () => {
    expect(splitQueue(QUEUE, 0)).toEqual({ upNext: ['b', 'c', 'd', 'e'], played: [] });
    expect(splitQueue(QUEUE, 4)).toEqual({ upNext: [], played: ['d', 'c', 'b', 'a'] });
  });

  it('does not mutate the queue it was given', () => {
    const original = [...QUEUE];
    splitQueue(QUEUE, 3);
    expect(QUEUE).toEqual(original);
  });
});

describe('resolvePick', () => {
  it('round-trips every row of both halves back to the track it came from', () => {
    for (let index = 0; index < QUEUE.length; index += 1) {
      const { upNext, played } = splitQueue(QUEUE, index);
      upNext.forEach((track, position) => {
        expect(resolvePick(QUEUE, index, 'queue', position)).toBe(track);
      });
      // The half that actually catches off-by-ones: played is reversed, so
      // position 0 is the track immediately BEFORE the current one.
      played.forEach((track, position) => {
        expect(resolvePick(QUEUE, index, 'history', position)).toBe(track);
      });
    }
  });

  it('answers null rather than a neighbouring track when a row cannot be resolved', () => {
    expect(resolvePick(QUEUE, 2, 'queue', 99)).toBeNull();
    expect(resolvePick(QUEUE, 2, 'history', 99)).toBeNull();
    expect(resolvePick(QUEUE, 0, 'history', 0)).toBeNull();
    expect(resolvePick(QUEUE, -1, 'queue', 0)).toBeNull();
    expect(resolvePick([], 0, 'queue', 0)).toBeNull();
  });
});
