import { describe, expect, it } from 'vitest';
import { nextHeld } from '@/components/mmm/MmmPlayIntent';

/**
 * The transition behind the dock's play intent.
 *
 * This exists because the first version of that provider shipped an unbounded
 * render loop: `register` was rebuilt on every state change, the consumer's
 * effect depended on it, and each call allocated a fresh wrapper — so
 * registering caused a re-render which caused a registration. It took the
 * Workerd server down in CI and failed 18 tests as collateral, which is the
 * only reason it surfaced at all; nothing here could see it.
 *
 * Identity is the property under test, not equality. `toBe` throughout.
 */
describe('nextHeld', () => {
  it('keeps the same reference when the same intent is registered again', () => {
    const intent = () => {};
    const first = nextHeld(null, intent);
    expect(first).not.toBeNull();
    // The second registration must not produce a new object: a new reference is
    // a new context value, and a new context value re-renders every consumer.
    expect(nextHeld(first, intent)).toBe(first);
  });

  it('keeps null as null, so clearing twice is not a state change', () => {
    expect(nextHeld(null, null)).toBeNull();
    const held = nextHeld(null, () => {});
    expect(nextHeld(held, null)).toBeNull();
  });

  it('replaces the wrapper when the intent itself changes', () => {
    // The deck advancing to the next card is exactly this: a new closure over a
    // new card, which must win — a stale intent would play the wrong track.
    const first = nextHeld(null, () => {});
    const second = nextHeld(first, () => {});
    expect(second).not.toBe(first);
  });

  it('holds the function rather than calling it', () => {
    // `useState(fn)` would treat a bare function as an updater and CALL it,
    // which here means starting playback at registration time.
    let called = false;
    const held = nextHeld(null, () => { called = true; });
    expect(called).toBe(false);
    held!.run();
    expect(called).toBe(true);
  });
});
