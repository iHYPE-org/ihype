import { describe, expect, it } from 'vitest';
import { albumRelease, isHeld, releaseStatus, resolveRelease } from '@/lib/release-schedule';

const NOW = new Date('2026-09-02T12:00:00.000Z');

describe('resolveRelease (launch now, or on a date — the artist\'s call)', () => {
  it('launches immediately for now, empty and null', () => {
    for (const input of ['now', '', null, undefined]) {
      expect(resolveRelease(input, NOW)).toEqual({ isPublished: true, publishAt: null });
    }
  });
  it('schedules a future moment as unpublished-until-then', () => {
    const at = '2026-09-05T04:00:00.000Z';
    expect(resolveRelease(at, NOW)).toEqual({ isPublished: false, publishAt: new Date(at) });
  });
  it('treats a moment that has already arrived as now', () => {
    expect(resolveRelease('2026-09-01T00:00:00.000Z', NOW)).toEqual({ isPublished: true, publishAt: null });
  });
  it('refuses garbage rather than guessing', () => {
    expect(resolveRelease('next friday', NOW)).toBeNull();
  });
});

describe('albumRelease (the album date cascades to its tracks)', () => {
  it('is nothing when the album sets no date', () => {
    expect(albumRelease(null, NOW)).toBeNull();
  });
  it('schedules tracks to a future album date and releases them for a past one', () => {
    expect(albumRelease(new Date('2026-10-01T00:00:00.000Z'), NOW)).toEqual({ isPublished: false, publishAt: new Date('2026-10-01T00:00:00.000Z') });
    expect(albumRelease(new Date('2026-08-01T00:00:00.000Z'), NOW)).toEqual({ isPublished: true, publishAt: null });
  });
});

describe('isHeld / releaseStatus (a hold is not a schedule)', () => {
  it('names a withheld track held, never scheduled', () => {
    expect(isHeld({ isPublished: false, publishAt: null })).toBe(true);
    expect(releaseStatus({ isPublished: false, publishAt: null }, NOW)).toBe('held');
  });
  it('distinguishes live from scheduled', () => {
    expect(releaseStatus({ isPublished: true, publishAt: null }, NOW)).toBe('live');
    expect(releaseStatus({ isPublished: true, publishAt: new Date('2026-09-01T00:00:00.000Z') }, NOW)).toBe('live');
    expect(releaseStatus({ isPublished: false, publishAt: new Date('2026-09-09T00:00:00.000Z') }, NOW)).toBe('scheduled');
  });
});
