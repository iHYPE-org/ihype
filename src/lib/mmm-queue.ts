/**
 * The player's queue panel, as arithmetic.
 *
 * Queue and history are ONE list split at the current index — what follows is
 * "up next", what precedes is "played", most recent first. That is the design
 * system's rule (ADHERENCE 27) and it is a rule because two independently
 * maintained arrays drift apart, leaving the panel describing a queue that is
 * not the one the player will play.
 *
 * The consequence is that the panel's two halves are VIEWS, and picking a row
 * means inverting the slice that produced it. Played is reversed, so its
 * position counts backwards from the current track — an off-by-one there plays
 * a different song than the one the member pointed at, silently and every time.
 * That is why this is a pure module with tests rather than four lines of index
 * maths inside a component.
 */

export type QueueSplit<T> = {
  /** What follows the current track, in play order. */
  upNext: T[];
  /** What preceded it, MOST RECENT FIRST. */
  played: T[];
};

export function splitQueue<T>(queue: readonly T[], currentIndex: number): QueueSplit<T> {
  // A negative index means nothing is playing: there is no split point, so
  // neither half exists. Treating it as 0 would report the whole queue as
  // "played", which is the opposite of the truth.
  if (currentIndex < 0) return { upNext: [], played: [] };
  return {
    upNext: queue.slice(currentIndex + 1),
    played: queue.slice(0, currentIndex).reverse(),
  };
}

/**
 * The queue entry a panel row came from, or null if the row cannot be resolved
 * — a stale panel after the queue changed under it, say. Null is deliberate:
 * playing "something near where they pointed" is worse than doing nothing.
 */
export function resolvePick<T>(
  queue: readonly T[],
  currentIndex: number,
  list: 'queue' | 'history',
  position: number,
): T | null {
  if (currentIndex < 0 || position < 0) return null;
  const index = list === 'queue'
    ? currentIndex + 1 + position
    // Played is reversed, so position 0 is the track immediately before this
    // one — not the start of the queue.
    : currentIndex - 1 - position;
  if (index < 0 || index >= queue.length) return null;
  return queue[index] ?? null;
}
