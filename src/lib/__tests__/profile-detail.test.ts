import { describe, expect, it } from 'vitest';
import type { ShowStatus } from '@prisma/client';
import { isUpcomingShow, upcomingShowWhere } from '@/lib/profile-detail';

const NOW = new Date('2026-08-14T20:00:00.000Z');
const at = (offsetMs: number) => new Date(NOW.getTime() + offsetMs);
const HOUR = 3_600_000;

describe('isUpcomingShow', () => {
  it('lists a scheduled show in the future', () => {
    expect(isUpcomingShow({ status: 'SCHEDULED', startsAt: at(HOUR) }, NOW)).toBe(true);
    expect(isUpcomingShow({ status: 'SCHEDULED', startsAt: NOW }, NOW)).toBe(true);
  });

  it('keeps a LIVE show that started in the past', () => {
    // The bug in both shell copies: `startsAt >= now` drops the show on stage,
    // which is the one a member opening a venue page most wants to see.
    expect(isUpcomingShow({ status: 'LIVE', startsAt: at(-2 * HOUR) }, NOW)).toBe(true);
  });

  it('drops a scheduled show that has already started', () => {
    expect(isUpcomingShow({ status: 'SCHEDULED', startsAt: at(-1) }, NOW)).toBe(false);
  });

  it('never lists a DRAFT, even a future one', () => {
    // The bug in both public copies. A draft's own detail page 404s for
    // everyone but its creator, so listing it disclosed a show the next click
    // then denied.
    expect(isUpcomingShow({ status: 'DRAFT', startsAt: at(HOUR) }, NOW)).toBe(false);
  });

  it('never lists a CANCELED show as upcoming', () => {
    expect(isUpcomingShow({ status: 'CANCELED', startsAt: at(HOUR) }, NOW)).toBe(false);
  });

  it('drops every non-public status whatever the clock says', () => {
    const statuses: ShowStatus[] = ['DRAFT', 'CANCELED', 'ENDED'];
    for (const status of statuses) {
      expect(isUpcomingShow({ status, startsAt: at(HOUR) }, NOW), status).toBe(false);
      expect(isUpcomingShow({ status, startsAt: at(-HOUR) }, NOW), status).toBe(false);
    }
  });
});

describe('upcomingShowWhere', () => {
  it('is a disjunction, so LIVE is not gated on the clock', () => {
    // The query form has to say the same thing as the predicate. Expressed as
    // `status in (...) AND startsAt >= now` it reads identically and is not.
    expect(upcomingShowWhere(NOW)).toEqual({
      OR: [
        { status: 'LIVE' },
        { status: 'SCHEDULED', startsAt: { gte: NOW } },
      ],
    });
  });

  it('agrees with isUpcomingShow on every combination it can express', () => {
    const where = upcomingShowWhere(NOW);
    const matches = (show: { status: ShowStatus; startsAt: Date }) =>
      where.OR.some((clause) => {
        if (clause.status !== show.status) return false;
        const floor = 'startsAt' in clause ? clause.startsAt?.gte : undefined;
        return floor === undefined || show.startsAt >= floor;
      });
    const statuses: ShowStatus[] = ['DRAFT', 'SCHEDULED', 'LIVE', 'ENDED', 'CANCELED'];
    for (const status of statuses) {
      for (const startsAt of [at(-HOUR), NOW, at(HOUR)]) {
        expect(matches({ status, startsAt }), `${status} @ ${startsAt.toISOString()}`)
          .toBe(isUpcomingShow({ status, startsAt }, NOW));
      }
    }
  });
});
