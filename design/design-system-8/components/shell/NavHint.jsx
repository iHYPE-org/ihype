const _NH = { ink3: '#8792a6', fm: "'JetBrains Mono',monospace" };

/**
 * With no header and no tab bar, this is the only thing on screen that says
 * where you are. It sits beside the logo trigger and hides while the nav is
 * open, because the fan itself then carries the current module. It sits ABOVE
 * the trigger, not beside it — the player docks to the trigger's right.
 *
 * It is centred on the trigger, not aligned to its left edge: the label is a
 * caption for that button, and a caption that starts where the button starts
 * reads as a stray line of text next to it. `anchor` is the trigger's width,
 * so the two stay centred together if either moves.
 */
export function NavHint({ label, offset = 26, bottom = 112, anchor = 76 }) {
  if (!label) return null;
  return React.createElement('div', {
    style: {
      position: 'absolute', left: offset, bottom, width: anchor,
      textAlign: 'center',
      fontFamily: _NH.fm, fontSize: 10, letterSpacing: '.24em',
      /* The tracking is applied to the right of every glyph including the last,
         so a centred line sits one space left of true. Half the tracking back
         as padding cancels it. */
      paddingLeft: '.24em',
      textTransform: 'uppercase', color: _NH.ink3, pointerEvents: 'none',
    },
  }, label);
}
