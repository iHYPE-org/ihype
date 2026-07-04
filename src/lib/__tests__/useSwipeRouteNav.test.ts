import { describe, expect, it } from 'vitest';
import { resolveSwipeTarget, SWIPE_ROUTE_ORDER } from '@/lib/useSwipeRouteNav';

describe('resolveSwipeTarget', () => {
  it('moves to the next route on a leftward swipe', () => {
    expect(resolveSwipeTarget('/listen', -120, 0)).toBe('/shows');
    expect(resolveSwipeTarget('/shows', -120, 0)).toBe('/pages');
  });

  it('moves to the previous route on a rightward swipe', () => {
    expect(resolveSwipeTarget('/shows', 120, 0)).toBe('/listen');
    expect(resolveSwipeTarget('/pages', 120, 0)).toBe('/shows');
  });

  it('wraps around at either end of the list', () => {
    expect(resolveSwipeTarget('/listen', 120, 0)).toBe('/pages');
    expect(resolveSwipeTarget('/pages', -120, 0)).toBe('/listen');
  });

  it('ignores swipes below the distance threshold', () => {
    expect(resolveSwipeTarget('/listen', -40, 0)).toBeNull();
  });

  it('ignores swipes that are more vertical than horizontal', () => {
    expect(resolveSwipeTarget('/listen', -80, 100)).toBeNull();
  });

  it('does nothing when not on one of the three swipeable pages', () => {
    expect(resolveSwipeTarget('/discover', -120, 0)).toBeNull();
  });

  it('exposes the route order used for index math', () => {
    expect(SWIPE_ROUTE_ORDER).toEqual(['/listen', '/shows', '/pages']);
  });
});
