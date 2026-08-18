/**
 * HYPE resets every 24 hours, per target.
 *
 * A member can keep hyping an artist they keep coming back to, but only once a
 * day. The window is the anti-false-hype rule: two hypes an hour apart are one
 * enthusiasm, two a day apart are two decisions.
 *
 * It is a TIMESTAMP per target, never a boolean. The boolean it replaced had
 * no notion of when, so a hype was permanent until toggled off — and "hyped"
 * meant "has ever hyped", which is why profile `hypeCount` and the believers
 * board could be read as a headcount and as a total at the same time.
 *
 * Pure and dependency-free: both the API (which enforces the window) and the
 * button (which states the remaining wait rather than letting the API reject
 * the tap) compute from the same functions.
 */

export const HYPE_WINDOW_MS = 24 * 60 * 60 * 1000;

const MINUTE_MS = 60_000;

/** When `lastHypedAt` becomes spendable again. Null means "never hyped". */
export function nextHypeAt(lastHypedAt: Date | string | null | undefined): Date | null {
  if (!lastHypedAt) return null;
  const at = lastHypedAt instanceof Date ? lastHypedAt : new Date(lastHypedAt);
  if (Number.isNaN(at.getTime())) return null;
  return new Date(at.getTime() + HYPE_WINDOW_MS);
}

/** Milliseconds left on the window; 0 when the tap is allowed. */
export function hypeWaitMs(
  lastHypedAt: Date | string | null | undefined,
  now: Date | number = Date.now(),
): number {
  const next = nextHypeAt(lastHypedAt);
  if (!next) return 0;
  const nowMs = typeof now === 'number' ? now : now.getTime();
  return Math.max(0, next.getTime() - nowMs);
}

export function canHype(
  lastHypedAt: Date | string | null | undefined,
  now: Date | number = Date.now(),
): boolean {
  return hypeWaitMs(lastHypedAt, now) === 0;
}

/**
 * The wait, as the control states it: "17h 40m", "40m", "1m".
 *
 * Coarse to the minute on purpose — a second-by-second countdown turns a
 * fairness rule into a game to be timed. Anything under a minute still reads
 * "1m" rather than "0m", because a control that says zero and refuses the tap
 * reads as broken.
 */
/**
 * Milliseconds left, given the moment the window REOPENS rather than the moment
 * it was spent.
 *
 * The API's 429 hands back `nextHypeAt`, not `lastHypedAt`, so a caller holding
 * that had to subtract the window to use `hypeWaitMs` — reconstructing a
 * timestamp it never had in order to derive one it already did. Same rule as
 * everything else here: the API and the controls compute from these functions,
 * so the conversion belongs in them.
 */
export function hypeWaitUntil(
  nextAt: Date | string | null | undefined,
  now: Date | number = Date.now(),
): number {
  if (!nextAt) return 0;
  const at = nextAt instanceof Date ? nextAt : new Date(nextAt);
  if (Number.isNaN(at.getTime())) return 0;
  const nowMs = typeof now === 'number' ? now : now.getTime();
  return Math.max(0, at.getTime() - nowMs);
}

export function formatHypeWait(waitMs: number): string {
  if (waitMs <= 0) return '';
  const minutes = Math.max(1, Math.ceil(waitMs / MINUTE_MS));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours <= 0) return `${rest || 1}m`;
  if (rest === 0) return `${hours}h`;
  return `${hours}h ${rest}m`;
}
