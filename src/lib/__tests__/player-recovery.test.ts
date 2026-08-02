import { describe, expect, it } from 'vitest';
import { MAX_CONSECUTIVE_SKIPS, resolvePlaybackFailure, sanitizePlaybackCheckpoint } from '@/lib/player-recovery';

const base = { consecutiveErrors: 1, queueLength: 5, index: 0, repeatMode: 'off' as const };

describe('resolvePlaybackFailure', () => {
  it('skips to the next track when one is available', () => {
    // The bug this exists for: before the error listener, a dead URL left the
    // player showing "playing" forever and the queue never advanced.
    expect(resolvePlaybackFailure({ ...base, index: 2 })).toEqual({ action: 'skip', nextIndex: 3 });
  });

  it('stops rather than skipping when the queue holds only the failed track', () => {
    expect(resolvePlaybackFailure({ ...base, queueLength: 1, index: 0 })).toEqual({ action: 'stop' });
  });

  it('stops on an empty queue', () => {
    expect(resolvePlaybackFailure({ ...base, queueLength: 0, index: -1 })).toEqual({ action: 'stop' });
  });

  it('wraps to the start at the end of the queue when repeat is all', () => {
    expect(resolvePlaybackFailure({ ...base, index: 4, repeatMode: 'all' }))
      .toEqual({ action: 'skip', nextIndex: 0 });
  });

  it('stops at the end of the queue when repeat is off', () => {
    expect(resolvePlaybackFailure({ ...base, index: 4, repeatMode: 'off' })).toEqual({ action: 'stop' });
  });

  it('does NOT retry the same track under repeat-one', () => {
    // repeat:'one' would otherwise re-request a URL that just failed, forever.
    expect(resolvePlaybackFailure({ ...base, index: 4, repeatMode: 'one' })).toEqual({ action: 'stop' });
  });

  it('gives up once every track in a short queue has failed', () => {
    // 3-track queue, 3 failures — everything is broken, so stop and surface it
    // instead of looping.
    expect(resolvePlaybackFailure({ consecutiveErrors: 3, queueLength: 3, index: 1, repeatMode: 'all' }))
      .toEqual({ action: 'stop' });
  });

  it('caps skipping on a long queue so a total outage surfaces quickly', () => {
    const longQueue = { queueLength: 200, index: 10, repeatMode: 'off' as const };
    expect(resolvePlaybackFailure({ ...longQueue, consecutiveErrors: MAX_CONSECUTIVE_SKIPS - 1 }))
      .toEqual({ action: 'skip', nextIndex: 11 });
    expect(resolvePlaybackFailure({ ...longQueue, consecutiveErrors: MAX_CONSECUTIVE_SKIPS }))
      .toEqual({ action: 'stop' });
  });

  it('keeps skipping while failures stay under the cap', () => {
    for (let errors = 1; errors < MAX_CONSECUTIVE_SKIPS; errors += 1) {
      expect(resolvePlaybackFailure({ ...base, consecutiveErrors: errors, index: 1 }))
        .toEqual({ action: 'skip', nextIndex: 2 });
    }
  });
});

describe('sanitizePlaybackCheckpoint', () => {
  it('restores only bounded local playback state', () => {
    expect(sanitizePlaybackCheckpoint({ trackKey: 'abc_123', currentTime: 82.4, volume: 125, extra: 'ignored' }))
      .toEqual({ trackKey: 'abc_123', currentTime: 82.4, volume: 100 });
  });

  it('rejects malformed or identifying free-form track keys', () => {
    expect(sanitizePlaybackCheckpoint({ trackKey: 'private title with spaces', currentTime: 2, volume: 50 })).toBeNull();
    expect(sanitizePlaybackCheckpoint({ trackKey: 'abc', currentTime: Number.NaN, volume: 50 })).toBeNull();
  });
});
