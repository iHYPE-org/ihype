import { describe, expect, it } from 'vitest';
import type { ShowStatus } from '@prisma/client';
import { isUpcomingShow, pastShowWhere, upcomingShowWhere } from '@/lib/profile-detail';

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

describe('pastShowWhere', () => {
  it('counts ENDED whatever the clock says, and SCHEDULED only once it has started', () => {
    expect(pastShowWhere(NOW)).toEqual({
      OR: [
        { status: 'ENDED' },
        { status: 'SCHEDULED', startsAt: { lt: NOW } },
      ],
    });
  });

  it('partitions the public statuses with upcomingShowWhere — a visible show is exactly one of past or upcoming', () => {
    // A LIVE show is upcoming and never past; a SCHEDULED one flips at its
    // start; DRAFT and CANCELED are neither. Both fragments are evaluated the
    // way Prisma would, and the pair must cover SCHEDULED/LIVE/ENDED exactly
    // once so "Past events" and "Shows" on a profile never double-count.
    const upcoming = upcomingShowWhere(NOW);
    const past = pastShowWhere(NOW);
    const matches = (
      where: { OR: { status: ShowStatus; startsAt?: { gte?: Date; lt?: Date } }[] },
      show: { status: ShowStatus; startsAt: Date },
    ) =>
      where.OR.some((clause) => {
        if (clause.status !== show.status) return false;
        if (clause.startsAt?.gte !== undefined && show.startsAt < clause.startsAt.gte) return false;
        if (clause.startsAt?.lt !== undefined && show.startsAt >= clause.startsAt.lt) return false;
        return true;
      });
    const statuses: ShowStatus[] = ['DRAFT', 'SCHEDULED', 'LIVE', 'ENDED', 'CANCELED'];
    for (const status of statuses) {
      for (const startsAt of [at(-HOUR), NOW, at(HOUR)]) {
        const show = { status, startsAt };
        const hits = Number(matches(upcoming, show)) + Number(matches(past, show));
        const visible = status === 'SCHEDULED' || status === 'LIVE' || status === 'ENDED';
        expect(hits, `${status} @ ${startsAt.toISOString()}`).toBe(visible ? 1 : 0);
      }
    }
  });
});
