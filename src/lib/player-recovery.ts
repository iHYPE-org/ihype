/**
 * What the player should do when a track's audio fails to load.
 *
 * Extracted as a pure function because the interesting part is the decision,
 * not the DOM plumbing: skip to the next track, or give up and say so. Getting
 * it wrong in either direction is bad — never skipping strands the listener on
 * a dead track (the bug this fixes), always skipping spins through an entire
 * queue of broken URLs at whatever speed the network returns 404s.
 *
 * A `<audio>` `error` event fires for a 404, a CORS rejection, a DNS failure,
 * or an undecodable file. None of them are recoverable by retrying the same
 * URL, so the only useful responses are "move on" or "stop".
 */

export type RepeatMode = 'off' | 'one' | 'all';

export type PlaybackFailureInput = {
  /** Failures since the last track that actually decoded. Always >= 1 here. */
  consecutiveErrors: number;
  queueLength: number;
  /** Index of the track that just failed; -1 when nothing is selected. */
  index: number;
  repeatMode: RepeatMode;
};

export type PlaybackFailureDecision =
  | { action: 'skip'; nextIndex: number }
  | { action: 'stop' };

/**
 * Cap on consecutive skips. Five is a compromise: enough to ride out a couple
 * of bad uploads in a healthy queue, few enough that a wholly broken queue
 * surfaces almost immediately rather than churning.
 */
export const MAX_CONSECUTIVE_SKIPS = 5;

export type PlaybackCheckpoint = {
  currentTime: number;
  trackKey: string;
  volume: number;
};

export function sanitizePlaybackCheckpoint(value: unknown): PlaybackCheckpoint | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Partial<PlaybackCheckpoint>;
  if (
    typeof candidate.trackKey !== 'string'
    || !/^[a-zA-Z0-9_-]{1,80}$/.test(candidate.trackKey)
    || typeof candidate.currentTime !== 'number'
    || !Number.isFinite(candidate.currentTime)
    || candidate.currentTime < 0
    || typeof candidate.volume !== 'number'
    || !Number.isFinite(candidate.volume)
  ) return null;
  return {
    trackKey: candidate.trackKey,
    currentTime: Math.min(candidate.currentTime, 24 * 60 * 60),
    volume: Math.min(100, Math.max(0, Math.round(candidate.volume))),
  };
}

export function resolvePlaybackFailure({
  consecutiveErrors,
  queueLength,
  index,
  repeatMode,
}: PlaybackFailureInput): PlaybackFailureDecision {
  // Nothing to move on to.
  if (queueLength <= 1) return { action: 'stop' };

  // Every failure budget is bounded by the queue itself: with N tracks there
  // is no point attempting more than N before concluding they are all bad.
  if (consecutiveErrors >= Math.min(queueLength, MAX_CONSECUTIVE_SKIPS)) {
    return { action: 'stop' };
  }

  const hasNext = index >= 0 && index < queueLength - 1;
  if (hasNext) return { action: 'skip', nextIndex: index + 1 };

  // At the end of the queue, only 'all' wraps. 'one' deliberately does not:
  // repeating a track that just failed to load would retry the same dead URL
  // forever.
  if (repeatMode === 'all') return { action: 'skip', nextIndex: 0 };

  return { action: 'stop' };
}
