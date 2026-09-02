/**
 * When a track or an album goes live — the artist's call, now or later
 * (owner, 2026-09-02: "Artists can prep an album or single release for a
 * future date or launch it immediately totally up to them").
 *
 * The columns already existed and already gate every public surface:
 * `releasedMediaWhere()` serves a track only when `isPublished` is true and
 * `publishAt` is null or past, and the `publish-scheduled` cron flips
 * `isPublished` on when `publishAt` arrives and tells the artist. So a
 * scheduled release is `{ isPublished: false, publishAt: <future> }`, an
 * immediate one is `{ isPublished: true, publishAt: null }`, and this module
 * is the one place that arithmetic lives.
 *
 * The state it must never touch is a HELD track: `isPublished: false` with no
 * `publishAt`, which is what the upload scan and the moderation queue write
 * when a track is withheld from the page. Releasing that from the editor would
 * be the artist overruling the copyright hold with a date picker, so `isHeld`
 * is checked before any release write and the album cascade skips such rows.
 *
 * Pure, so the rules are unit-tested; the routes do the writes.
 */
export type ReleaseState = { isPublished: boolean; publishAt: Date | null };

/**
 * Parse a release request. `'now'`, `''` or `null` mean launch immediately; an
 * ISO timestamp in the future schedules; one in the past is "now" (the artist
 * picked a moment that has arrived). Returns null for an unparseable value.
 */
export function resolveRelease(input: string | null | undefined, now: Date = new Date()): ReleaseState | null {
  if (input === undefined || input === null || input === '' || input === 'now') {
    return { isPublished: true, publishAt: null };
  }
  const at = new Date(input);
  if (Number.isNaN(at.getTime())) return null;
  if (at.getTime() <= now.getTime()) return { isPublished: true, publishAt: null };
  return { isPublished: false, publishAt: at };
}

/** An album's release moment, as the state its tracks should carry. `null` = the album sets no date. */
export function albumRelease(releasedOn: Date | null | undefined, now: Date = new Date()): ReleaseState | null {
  if (!releasedOn) return null;
  return releasedOn.getTime() <= now.getTime()
    ? { isPublished: true, publishAt: null }
    : { isPublished: false, publishAt: releasedOn };
}

/** Withheld by the scan or a moderator — not scheduled, not live. */
export function isHeld(track: { isPublished: boolean; publishAt: Date | null }): boolean {
  return !track.isPublished && track.publishAt === null;
}

/** For display: `'live' | 'scheduled' | 'held'`. */
export function releaseStatus(track: { isPublished: boolean; publishAt: Date | null }, now: Date = new Date()): 'live' | 'scheduled' | 'held' {
  if (isHeld(track)) return 'held';
  if (track.isPublished && (!track.publishAt || track.publishAt.getTime() <= now.getTime())) return 'live';
  return 'scheduled';
}

/** A date (YYYY-MM-DD, read as midnight UTC) or a full ISO instant, as the routes accept it. */
export function isReleaseInput(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isNaN(Date.parse(value));
}
export function parseReleaseInput(value: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00.000Z`) : new Date(value);
}
