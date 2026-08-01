import { describe, expect, it } from 'vitest';
import { nextTrapFocus } from '@/lib/focus-trap';

describe('nextTrapFocus', () => {
  it('leaves Tab alone in the middle of the trap', () => {
    expect(nextTrapFocus({ count: 5, activeIndex: 2, shiftKey: false }))
      .toEqual({ focusIndex: null, preventDefault: false });
    expect(nextTrapFocus({ count: 5, activeIndex: 2, shiftKey: true }))
      .toEqual({ focusIndex: null, preventDefault: false });
  });

  it('wraps forward from the last item to the first', () => {
    expect(nextTrapFocus({ count: 4, activeIndex: 3, shiftKey: false }))
      .toEqual({ focusIndex: 0, preventDefault: true });
  });

  it('wraps backward from the first item to the last', () => {
    expect(nextTrapFocus({ count: 4, activeIndex: 0, shiftKey: true }))
      .toEqual({ focusIndex: 3, preventDefault: true });
  });

  it('does not wrap forward from the first item, or backward from the last', () => {
    expect(nextTrapFocus({ count: 4, activeIndex: 0, shiftKey: false }).focusIndex).toBeNull();
    expect(nextTrapFocus({ count: 4, activeIndex: 3, shiftKey: true }).focusIndex).toBeNull();
  });

  // The case a first-/last-only implementation misses entirely: clicking the
  // scrim leaves document.activeElement on <body>, so activeIndex is -1 and no
  // edge condition ever matches — the next Tab walks into the page behind.
  it('pulls focus back in when it has already escaped the trap', () => {
    expect(nextTrapFocus({ count: 4, activeIndex: -1, shiftKey: false }))
      .toEqual({ focusIndex: 0, preventDefault: true });
    expect(nextTrapFocus({ count: 4, activeIndex: -1, shiftKey: true }))
      .toEqual({ focusIndex: 3, preventDefault: true });
  });

  it('treats an out-of-range index as escaped rather than trusting it', () => {
    expect(nextTrapFocus({ count: 3, activeIndex: 9, shiftKey: false }))
      .toEqual({ focusIndex: 0, preventDefault: true });
  });

  it('never swallows Tab when there is nothing to focus', () => {
    // Swallowing here would strand the user: no focusable element to move to
    // and no way to tab out either.
    expect(nextTrapFocus({ count: 0, activeIndex: -1, shiftKey: false }))
      .toEqual({ focusIndex: null, preventDefault: false });
  });

  it('handles a single focusable element by holding focus on it', () => {
    expect(nextTrapFocus({ count: 1, activeIndex: 0, shiftKey: false }))
      .toEqual({ focusIndex: 0, preventDefault: true });
    expect(nextTrapFocus({ count: 1, activeIndex: 0, shiftKey: true }))
      .toEqual({ focusIndex: 0, preventDefault: true });
  });
});
