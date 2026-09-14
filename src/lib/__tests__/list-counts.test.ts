import { describe, expect, it } from 'vitest';
import { isTruncatedList, visibleUnreadCount } from '../list-counts';

describe('visibleUnreadCount', () => {
  it('shows the whole set, not the page — the defect this exists for', () => {
    // Seventy unread, fifty on screen of which fifty are unread.
    expect(visibleUnreadCount(70, 50, 0)).toBe(70);
  });

  it('falls to the page count when no count was taken, and never to zero', () => {
    expect(visibleUnreadCount(null, 12, 0)).toBe(12);
    expect(visibleUnreadCount(null, 0, 0)).toBe(0);
  });

  it('comes down as the member marks rows read here', () => {
    expect(visibleUnreadCount(70, 45, 5)).toBe(65);
    expect(visibleUnreadCount(70, 0, 70)).toBe(0);
  });

  it('never drops below what is visibly unread on screen', () => {
    // A stale or lagging server count must not hide rows the member can see.
    expect(visibleUnreadCount(2, 9, 0)).toBe(9);
    expect(visibleUnreadCount(0, 3, 0)).toBe(3);
  });

  it('never goes negative', () => {
    expect(visibleUnreadCount(3, 0, 10)).toBe(0);
  });
});

describe('isTruncatedList', () => {
  it('is true only when the set is larger than the page', () => {
    expect(isTruncatedList(50, 70)).toBe(true);
    expect(isTruncatedList(50, 50)).toBe(false);
    expect(isTruncatedList(0, 0)).toBe(false);
  });

  it('says nothing when the count failed — "showing all of them" is a claim too', () => {
    expect(isTruncatedList(50, null)).toBe(false);
  });
});
