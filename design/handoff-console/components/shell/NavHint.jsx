import React from 'react';

/* Re-anchored to design tokens, 2026-08-22. Prop signature UNCHANGED so
   _adherence.oxlintrc.json stays valid — this is strictly internal.
   · #bda882 → var(--ink-on-walnut-3). Same value, but naming it says the
     label sits on the walnut cabinet — which is why it must not use --ink-3.
   · fontSize 10 → var(--text-xs) (11px mono floor)
   · letterSpacing .24em → var(--tracking-widest) (.22em, nearest token), and the
     optical-centring padding follows it */

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
  return (
    <div style={{
      position: 'absolute',
      left: offset,
      bottom,
      width: anchor,
      textAlign: 'center',
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--text-xs)',
      letterSpacing: 'var(--tracking-widest)',
      /* The tracking is applied to the right of every glyph including the last,
         so a centred line sits one space left of true. Half the tracking back
         as padding cancels it. */
      paddingLeft: 'var(--tracking-widest)',
      textTransform: 'uppercase',
      color: 'var(--ink-on-walnut-3)',
      pointerEvents: 'none',
    }}>{label}</div>
  );
}
