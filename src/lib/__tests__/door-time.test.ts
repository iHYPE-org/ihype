import { describe, expect, it } from 'vitest';
import { formatDoorTime, isValidTimeZone } from '@/lib/format-locale';
import { instantFromWallClock, wallClockInZone } from '@/lib/zoned-time';

/**
 * A show's door time is the venue's wall clock (DESIGN_SYNC row 464).
 *
 * The defect these hold against: `Show.startsAt` is an instant, every reader
 * formatted it with no zone, and the runtime's zone on Cloudflare is UTC — so
 * a 9pm Saturday show in Portland was sold on a page reading "Sunday, March 15
 * · 1:00 AM".
 */
const NINE_PM_SATURDAY_IN_PORTLAND = new Date('2026-03-15T01:00:00Z');
const PORTLAND = 'America/New_York';

describe('formatDoorTime', () => {
  it('renders the venue night, not the Worker day', () => {
    const utc = formatDoorTime('en', NINE_PM_SATURDAY_IN_PORTLAND, null, {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    });
    const venue = formatDoorTime('en', NINE_PM_SATURDAY_IN_PORTLAND, PORTLAND, {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    });
    // The harness runs in UTC, which is what the Worker does.
    expect(utc).toBe('Sunday, March 15, 2026');
    expect(venue).toBe('Saturday, March 14, 2026');
  });

  it('names the zone whenever it shows a clock, and never when it does not', () => {
    expect(formatDoorTime('en', NINE_PM_SATURDAY_IN_PORTLAND, PORTLAND, { hour: 'numeric', minute: '2-digit' }))
      .toBe('9:00 PM EDT');
    expect(formatDoorTime('en', NINE_PM_SATURDAY_IN_PORTLAND, PORTLAND, { month: 'short', day: 'numeric' }))
      .toBe('Mar 14');
  });

  it('keeps the clock in the member language', () => {
    expect(formatDoorTime('fr', NINE_PM_SATURDAY_IN_PORTLAND, PORTLAND, { hour: 'numeric', minute: '2-digit' }))
      .toContain('21:00');
  });

  it('degrades to the runtime zone rather than throwing on a zone Intl rejects', () => {
    expect(() => formatDoorTime('en', NINE_PM_SATURDAY_IN_PORTLAND, 'Mars/Olympus', { hour: 'numeric', minute: '2-digit' }))
      .not.toThrow();
    expect(formatDoorTime('en', NINE_PM_SATURDAY_IN_PORTLAND, 'Mars/Olympus', { hour: 'numeric', minute: '2-digit' }))
      .toBe(formatDoorTime('en', NINE_PM_SATURDAY_IN_PORTLAND, null, { hour: 'numeric', minute: '2-digit' }));
  });
});

describe('isValidTimeZone', () => {
  it('accepts a real IANA name and refuses anything else', () => {
    expect(isValidTimeZone(PORTLAND)).toBe(true);
    expect(isValidTimeZone('UTC')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
    expect(isValidTimeZone(null)).toBe(false);
    expect(isValidTimeZone(42)).toBe(false);
  });
});

describe('zoned-time', () => {
  it('round-trips an instant through a zone', () => {
    const wall = wallClockInZone(NINE_PM_SATURDAY_IN_PORTLAND, PORTLAND);
    expect(wall).toBe('2026-03-14T21:00');
    expect(instantFromWallClock(wall, PORTLAND)?.toISOString()).toBe(NINE_PM_SATURDAY_IN_PORTLAND.toISOString());
  });

  it('round-trips across a DST transition, which is what the second pass is for', () => {
    // US DST began 2026-03-08. A wall clock either side resolves to a different offset.
    for (const wall of ['2026-03-07T21:00', '2026-03-09T21:00', '2026-11-02T21:00', '2026-07-04T21:00']) {
      const instant = instantFromWallClock(wall, PORTLAND);
      expect(instant, wall).not.toBeNull();
      expect(wallClockInZone(instant!, PORTLAND), wall).toBe(wall);
    }
  });

  it('refuses a value that is not a datetime-local reading', () => {
    expect(instantFromWallClock('2026-03-14', PORTLAND)).toBeNull();
    expect(instantFromWallClock('2026-03-14T21:00:00Z', PORTLAND)).toBeNull();
    expect(instantFromWallClock('not a date', PORTLAND)).toBeNull();
    expect(instantFromWallClock('2026-03-14T21:00', 'Mars/Olympus')).toBeNull();
  });
});
