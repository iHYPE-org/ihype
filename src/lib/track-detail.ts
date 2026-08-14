/**
 * A track's copyright state, from its report trail.
 *
 * The state is derived from the latest `ContentReport` raised by
 * `runTrackScanPipeline()` at upload (`src/lib/media-vetting.ts`) — never a
 * hardcoded "Cleared" label, which is what this replaced on both copies of the
 * track page.
 *
 * A track that reaches either page is always `isPublished`, because an ACTIONED
 * report unpublishes it, so only three states are reachable. That reasoning is
 * the load-bearing part: it is why there is no "removed" state here, and it
 * stops being true the moment a page fetches a track without `isPublished`.
 *
 * This returns a STATE, not a label. The public page runs its copy through
 * `getServerT()` and the shell copy currently hardcodes English — a real gap,
 * and the reason the two must not each derive the state as well. One of them
 * having untranslated copy is a bug; the two disagreeing about whether a track
 * is flagged would be a different and worse one.
 */

export type CopyrightState = 'flagged' | 'cleared-reviewed' | 'cleared-unflagged';

export type CopyrightTone = 'ok' | 'pending';

/** `status` is the latest ContentReport's status, or null when there is none. */
export function resolveCopyrightState(status: string | null | undefined): CopyrightState {
  if (status === 'OPEN') return 'flagged';
  if (status === 'DISMISSED') return 'cleared-reviewed';
  return 'cleared-unflagged';
}

/** Flagged reads as pending review; both cleared states read as fine. */
export function copyrightTone(state: CopyrightState): CopyrightTone {
  return state === 'flagged' ? 'pending' : 'ok';
}
