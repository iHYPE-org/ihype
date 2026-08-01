/**
 * The focus-trap decision, as a pure function.
 *
 * The app shell's drawer is an overlay with a scrim, so it has to keep Tab
 * inside itself. The DOM wiring around that is trivial; the *decision* is where
 * the bugs live, and it fails in two directions that are easy to get wrong:
 *
 *  - trapping too little lets a keyboard user tab past the scrim into content
 *    they cannot see and cannot dismiss;
 *  - trapping too eagerly (e.g. always forcing focus to the first item) makes
 *    Tab useless inside the drawer itself.
 *
 * There is a third case that is easy to miss entirely: focus can already be
 * OUTSIDE the trap when Tab is pressed — clicking the scrim leaves
 * `document.activeElement` on `<body>`. Wrapping logic written only in terms of
 * "am I on the first/last item" never fires there, and the next Tab escapes.
 *
 * Kept separate from the component so it can be tested without a DOM
 * environment, matching the precedent set by `src/lib/player-recovery.ts`.
 */

export type FocusTrapInput = {
  /** How many focusable elements the trap currently holds. */
  count: number;
  /**
   * Index of the focused element within the trap, or -1 when focus is not
   * inside the trap at all (scrim click, programmatic blur, initial open).
   */
  activeIndex: number;
  /** Whether Shift was held — i.e. the user is tabbing backwards. */
  shiftKey: boolean;
};

export type FocusTrapDecision = {
  /** Index to move focus to, or null to let the browser handle this Tab. */
  focusIndex: number | null;
  /** Whether the caller must preventDefault() on the event. */
  preventDefault: boolean;
};

const LET_BROWSER_HANDLE: FocusTrapDecision = { focusIndex: null, preventDefault: false };

export function nextTrapFocus({ count, activeIndex, shiftKey }: FocusTrapInput): FocusTrapDecision {
  // Nothing focusable: never swallow the keystroke, or Tab becomes a no-op the
  // user cannot escape.
  if (count <= 0) return LET_BROWSER_HANDLE;

  const first = 0;
  const last = count - 1;
  const outside = activeIndex < 0 || activeIndex > last;

  // Focus already escaped — pull it back to the edge the user is heading for.
  if (outside) {
    return { focusIndex: shiftKey ? last : first, preventDefault: true };
  }

  if (shiftKey && activeIndex === first) {
    return { focusIndex: last, preventDefault: true };
  }
  if (!shiftKey && activeIndex === last) {
    return { focusIndex: first, preventDefault: true };
  }

  // Somewhere in the middle: the browser's own order is correct, and overriding
  // it here is what makes a trap feel broken.
  return LET_BROWSER_HANDLE;
}
