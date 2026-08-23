'use client';
import React from 'react';

/* Re-anchored to design tokens, 2026-08-22. Prop signature UNCHANGED so
   _adherence.oxlintrc.json stays valid — this is strictly internal.
   · #ff5029 → var(--accent); #1a1206 → var(--ink-on-accent). The old value
     was --walnut-3, which is close to the on-accent ink but not the same token —
     and this mark sits on the accent fill, so it is on-accent by definition.
   · boxShadow 0 14px 34px rgba(255,80,41,.3) → var(--shadow-trigger), which is
     that exact shadow, already a token.
   · the squircle radius stays proportional (size × 0.342 ≈ --radius-trigger's
     26/76 ratio) so a resized trigger keeps its corner; the token is the
     reference, the ratio is the implementation. */

/**
 * The only persistent navigation affordance in the Music · Map · Me shell.
 * A solid accent squircle, bottom-left of the frame, the same height as the
 * player, which docks immediately to its right on the same baseline.
 *
 * The mark is the full wordmark — iH, the bolt standing in for the Y, PE —
 * not the bolt alone. With no header anywhere in the shell this square is the
 * only place the product says its own name.
 *
 * It is drawn inline rather than loaded from `assets/logo/`: the trigger is
 * compiled into the bundle and consumed from arbitrary directories, so a
 * relative asset path would resolve differently per page. Inline also lets the
 * mark take `--ink-on-accent` instead of shipping two colour variants.
 *
 * Prop is `expanded`, not `open`: `open` is a reserved HTML boolean attribute
 * and is dropped before it reaches a component when set from a template.
 */
export function LogoTrigger({ expanded = false, playing = false, onClick, size = 88 }) {
  /* The bolt is cropped to its own ink — the 512 artboard is mostly air, and at
     wordmark scale that air opens a gap on either side that breaks the word into
     three pieces. Cropped, it sets as a letter between the H and the P. */
  const type = (px) => ({
    fontFamily: 'var(--font-display)',
    fontWeight: 400,
    fontSize: px,
    letterSpacing: 'var(--tracking-normal)',
    lineHeight: 1,
  });
  const px = size * 0.235;
  const h = px * 1.24;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      aria-label={expanded ? 'Close iHYPE navigation' : 'Open iHYPE navigation'}
      style={{
        position: 'absolute',
        left: 0,
        bottom: 0,
        zIndex: 3,
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.342),
        background: 'var(--accent)',
        color: 'var(--ink-on-accent)',
        border: 0,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        boxShadow: 'var(--shadow-trigger)',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center' }}>
        <span style={type(px)}>iH</span>
        <svg aria-hidden="true" viewBox="148 92 200 328" width={h * 0.61} height={h} style={{ display: 'block', margin: '0 .06em' }}>
          <path d="M280 96L152 288h96l-16 128 144-192h-96l16-128z" fill="currentColor" />
        </svg>
        <span style={type(px)}>PE</span>
      </span>
      {playing && (
        <span aria-hidden="true" style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 9 }}>
          {[5, 9, 6].map((bh, i) => (
            <i key={i} style={{ display: 'block', width: 2, height: bh, background: 'var(--ink-on-accent)', borderRadius: 1 }} />
          ))}
        </span>
      )}
    </button>
  );
}
