'use client';
import React from 'react';

/* Re-anchored to design tokens, 2026-08-22. Prop signature UNCHANGED so
   _adherence.oxlintrc.json stays valid — this is strictly internal.
   BUG FIXED: the tint was rgba(6,10,20,.76) and the vignette
   rgba(7,12,23,x) — both NAVY, left over from the Bulletin direction. Over a
   warm cream board and a parchment map they cast everything grey-green. Now
   var(--scrim), which is warm (rgba(10,6,2,.74)) by design. */

/**
 * Two jobs, deliberately in one component because they are the same layer:
 *
 * `Scrim` dims map, panes and player when the nav opens. It sits above the map
 * and the panes but below the fan, and it is a real button so a click anywhere
 * closes the nav and a screen reader has something to announce.
 *
 * `Vignette` is the map's own edge darkening — non-interactive, always present,
 * there so the bottom-left chrome keeps contrast over arbitrary map tiles.
 */
export function Scrim(props) {
  /* Same reason as ArcNav: pass { visible } as `state` from a template so the
     update always lands. */
  const visible = props.state ? Boolean(props.state.visible) : Boolean(props.visible);
  const { onClick, tint = 'var(--scrim)' } = props;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Close navigation"
      tabIndex={visible ? 0 : -1}
      style={{
        position: 'absolute',
        inset: 0,
        border: 0,
        padding: 0,
        background: tint,
        cursor: 'pointer',
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        /* No animation: see ADHERENCE 23. */
      }}
    />
  );
}

export function Vignette({ strength = 0.8 }) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        background: `radial-gradient(70% 60% at 50% 44%, transparent, rgba(var(--scrim-rgb), ${strength}))`,
      }}
    />
  );
}
