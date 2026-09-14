/**
 * Wall clock ↔ instant, in a named zone.
 *
 * A show's door time is a WALL CLOCK on the venue's own clock; `Show.startsAt`
 * stores the INSTANT that reading corresponds to, and `Show.timeZone` names the
 * clock. Rendering is `formatDoorTime()` in `format-locale.ts`; this module is
 * the other direction — the two conversions an EDITOR needs, so an organiser in
 * one zone correcting a show in another reads and types the venue's clock
 * rather than their own.
 *
 * Both are pure and both go through `Intl`, which is the only thing in a
 * browser or a Worker that knows a zone's offset history. No dependency, and no
 * hand-written DST table — a table is wrong the first time a government moves a
 * transition, which they do.
 */

/** The `datetime-local` shape: wall clock, no offset, minute precision. */
const WALL_CLOCK = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

function partsInZone(instant: Date, zone: string): Record<string, string> {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const out: Record<string, string> = {};
  for (const part of fmt.formatToParts(instant)) out[part.type] = part.value;
  return out;
}

/**
 * What `instant` reads on the clock in `zone`, as a `datetime-local` value
 * ("2026-03-15T21:00"). Read through `formatToParts` rather than off a
 * formatted string, so the locale cannot change the shape.
 */
export function wallClockInZone(instant: Date, zone: string): string {
  const p = partsInZone(instant, zone);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/**
 * The instant at which the clock in `zone` reads `wall`.
 *
 * Solved by iteration rather than by looking an offset up, because there is no
 * API that gives you one: read the wall clock as if it were UTC, see what that
 * instant actually reads in the zone, and correct by the difference. A second
 * pass settles the case where the correction itself crosses a DST transition.
 *
 * Two readings are genuinely ambiguous and both are resolved deterministically
 * rather than reported: an hour that occurs twice (the autumn fall-back) yields
 * one of the two instants, and an hour that never occurs (the spring-forward
 * gap) yields the instant just past the gap. A show is not scheduled in either
 * hour often enough to be worth an error state the organiser cannot act on.
 */
export function instantFromWallClock(wall: string, zone: string): Date | null {
  if (!WALL_CLOCK.test(wall)) return null;
  const target = Date.parse(`${wall}:00Z`);
  if (Number.isNaN(target)) return null;
  let guess = target;
  try {
    for (let i = 0; i < 2; i += 1) {
      const seen = Date.parse(`${wallClockInZone(new Date(guess), zone)}:00Z`);
      if (Number.isNaN(seen)) return null;
      const drift = target - seen;
      if (drift === 0) break;
      guess += drift;
    }
  } catch {
    /* A zone Intl cannot resolve. The caller's fallback is the browser's own
       clock, which `new Date(wall)` already gives. */
    return null;
  }
  return new Date(guess);
}
