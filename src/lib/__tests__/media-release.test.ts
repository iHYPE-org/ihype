import { describe, expect, it } from 'vitest';
import { isMediaReleased, releasedMediaWhere } from '../media-release';

describe('media release boundary', () => {
  const now = new Date('2026-08-01T12:00:00.000Z');

  it('allows published immediate and past-due media', () => {
    expect(isMediaReleased({ isPublished: true, publishAt: null }, now)).toBe(true);
    expect(isMediaReleased({ isPublished: true, publishAt: new Date('2026-08-01T11:59:00.000Z') }, now)).toBe(true);
  });

  it('blocks unpublished and future-scheduled media', () => {
    expect(isMediaReleased({ isPublished: false, publishAt: null }, now)).toBe(false);
    expect(isMediaReleased({ isPublished: true, publishAt: new Date('2026-08-01T12:01:00.000Z') }, now)).toBe(false);
  });

  it('builds the same release-time boundary for database lookups', () => {
    expect(releasedMediaWhere(now)).toEqual({
      isPublished: true,
      OR: [{ publishAt: null }, { publishAt: { lte: now } }],
    });
  });
});
