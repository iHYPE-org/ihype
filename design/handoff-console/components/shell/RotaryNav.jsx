'use client';
import React from 'react';

/* Rebuilt 2026-08-22 as real instrument hardware, replacing the flat original.
   Prop signature UNCHANGED so _adherence.oxlintrc.json stays valid.

   Materials come from the console tokens. The dark bakelite of the knob skirt,
   the machined steel plate and the chrome of the shaft are hardware finishes
   with no token equivalent — the one deliberate exception in this file, same as
   TicketQR's scanner plate. Every other value is a token.

   All three drive their moving parts through inline style writes rather than CSS
   transitions on the lit/active state. A transition sitting at currentTime 0
   pins its FROM value forever in an embedded context (ADHERENCE 23), which is
   exactly how the nameplate glow silently failed the first time. */

/**
 * The main nav: a detented rotary switch, Map · Music · Me.
 *
 * Fluted bakelite skirt, brass top cap with fine radial machining, cream
 * pointer, and a tick ring that emerges from under the knob's edge. Drag,
 * wheel, arrow-key, or tap to step one detent.
 *
 * `RotaryNavModule` is the declared child shape (id, label) — the parent takes
 * the module list so the ARC/station table stays in one place.
 */

const DETENT_PX = 64; // travel per detent; wide enough that a tap never reads as a turn

export function RotaryNavModule() { return null; } // shape only — see the lint contract

export function RotaryNav({ modules = [], active, onChange, size = 74, angles }) {
  /* 74px is the DOCK figure — production's --mmm-knob, and matched to
     JoystickTransport by design: "both knobs are 74px, matched. They are the
     same brass body by design; if one is smaller the dock looks broken."
     (design/handoff-console-2026-08-21/README.md). Pass a larger size only for
     a specimen or a detail view, never in the dock. */
  const idx = Math.max(0, modules.findIndex((m) => m.id === active));
  const span = angles || (modules.length > 1 ? 104 : 0);
  const angleFor = (i) => (modules.length > 1 ? -span / 2 + (span / (modules.length - 1)) * i : 0);

  const rotor = React.useRef(null);
  const drag = React.useRef(null);

  /* Written directly, not through a transition — the rotation is a live value
     and a pinned transition would freeze the pointer at its FROM angle. */
  React.useEffect(() => {
    if (rotor.current) rotor.current.style.transform = 'rotate(' + angleFor(idx) + 'deg)';
  }, [idx, modules.length, span]);

  const step = (n) => {
    const next = Math.max(0, Math.min(modules.length - 1, n));
    if (modules[next] && onChange) onChange(modules[next], next);
  };

  const outer = Math.round(size * 1.51); // room for the tick ring and the silkscreen
  const cap = Math.round(size * 0.21);   // skirt width; the brass cap is the remainder

  return (
    <div style={{ position: 'relative', width: outer, height: outer, flex: '0 0 auto' }}>
      {/* Minor ticks, masked to an annulus so they read as short marks rising
          from under the knob rather than rays from its centre. */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        background: 'repeating-conic-gradient(from -90deg, color-mix(in oklab, var(--ink-on-walnut) 60%, transparent) 0deg 0.9deg, transparent 0.9deg 6deg)',
        WebkitMaskImage: 'radial-gradient(circle, transparent 67%, #000 69%, #000 86%, transparent 88%)',
        maskImage: 'radial-gradient(circle, transparent 67%, #000 69%, #000 86%, transparent 88%)',
      }} />
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        background: 'repeating-conic-gradient(from -142deg, color-mix(in oklab, var(--ink-on-walnut) 90%, transparent) 0deg 1.5deg, transparent 1.5deg 26deg)',
        WebkitMaskImage: 'radial-gradient(circle, transparent 66%, #000 68%, #000 93%, transparent 95%)',
        maskImage: 'radial-gradient(circle, transparent 66%, #000 68%, #000 93%, transparent 95%)',
      }} />

      {/* Silkscreened station names. Hand-placed for three: a computed ring
          would need a style hole per label and cannot paint before values land. */}
      {modules[1] && (
        <div style={{
          position: 'absolute', left: '50%', top: 2, transform: 'translateX(-50%)',
          fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)',
          letterSpacing: 'var(--tracking-wider)', color: 'var(--ink-on-walnut-2)',
        }}>{modules[1].label}</div>
      )}
      {modules[0] && (
        <div style={{
          position: 'absolute', left: 2, bottom: Math.round(outer * 0.22),
          fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)',
          letterSpacing: 'var(--tracking-wider)', color: 'var(--ink-on-walnut-2)',
        }}>{modules[0].label}</div>
      )}
      {modules[2] && (
        <div style={{
          position: 'absolute', right: 2, bottom: Math.round(outer * 0.22),
          fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)',
          letterSpacing: 'var(--tracking-wider)', color: 'var(--ink-on-walnut-2)',
        }}>{modules[2].label}</div>
      )}

      <button
        type="button"
        role="radiogroup"
        aria-label="Module selector"
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, from: idx, moved: 0 };
          e.currentTarget.setPointerCapture(e.pointerId);
          e.currentTarget.style.cursor = 'grabbing';
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const dx = e.clientX - drag.current.x;
          drag.current.moved = Math.max(drag.current.moved, Math.abs(dx));
          step(drag.current.from + Math.round(dx / DETENT_PX));
        }}
        onPointerUp={(e) => {
          if (!drag.current) return;
          const tap = drag.current.moved < 4;
          drag.current = null;
          e.currentTarget.style.cursor = 'grab';
          if (tap) step((idx + 1) % modules.length);
        }}
        onPointerCancel={() => { drag.current = null; }}
        onWheel={(e) => { e.preventDefault(); step(idx + (e.deltaY > 0 ? 1 : -1)); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); step(idx + 1); }
          if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); step(idx - 1); }
        }}
        style={{
          position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
          width: size, height: size, padding: 0, border: 'none', borderRadius: '50%',
          cursor: 'grab', touchAction: 'none',
          /* Bakelite. No token is black plastic — see the header note. */
          background: '#120c05',
          boxShadow: '0 18px 30px -12px rgba(0,0,0,.85), 0 3px 0 rgba(0,0,0,.6), inset 0 0 0 1px var(--rule-on-walnut)',
        }}
      >
        <div ref={rotor} style={{ position: 'absolute', inset: 0, borderRadius: '50%', willChange: 'transform' }}>
          {/* Flutes */}
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            background: 'repeating-conic-gradient(from 0deg, #0d0904 0deg 2.2deg, #3f3325 2.2deg 3.5deg, #17110a 3.5deg 5.6deg)',
          }} />
          {/* Specular on the skirt */}
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            background: 'radial-gradient(circle at 34% 24%, rgba(255,244,224,.32), rgba(255,244,224,.05) 34%, transparent 56%), radial-gradient(circle at 68% 86%, color-mix(in oklab, var(--lamp) 18%, transparent), transparent 44%), radial-gradient(circle at 50% 50%, transparent 58%, rgba(0,0,0,.55) 97%)',
          }} />
          {/* Brass cap */}
          <div style={{
            position: 'absolute', inset: cap, borderRadius: '50%',
            background: 'radial-gradient(circle at 36% 28%, #f4e2ab 0%, var(--brass) 34%, var(--brass-deep) 78%, #4d3a15 100%)',
            boxShadow: 'inset 0 2px 3px rgba(255,246,220,.6), inset 0 -3px 7px rgba(0,0,0,.5), 0 2px 6px rgba(0,0,0,.55)',
          }} />
          <div style={{
            position: 'absolute', inset: cap, borderRadius: '50%',
            background: 'repeating-conic-gradient(from 0deg, rgba(0,0,0,.15) 0deg 1deg, transparent 1deg 9deg)',
          }} />
          <div style={{
            position: 'absolute', inset: cap, borderRadius: '50%',
            background: 'linear-gradient(128deg, rgba(255,255,255,.4) 0%, transparent 36%, transparent 64%, rgba(255,255,255,.13) 100%)',
          }} />
          {/* Pointer */}
          <div style={{
            position: 'absolute', left: '50%', top: 7, transform: 'translateX(-50%)',
            width: 5, height: Math.round(size * 0.29), borderRadius: '0 0 3px 3px',
            background: 'linear-gradient(180deg, #fff8e6, #e8d5aa)',
            boxShadow: '0 0 9px rgba(255,240,200,.6), 0 1px 2px rgba(0,0,0,.7)',
          }} />
          {/* Centre screw */}
          <div style={{
            position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
            width: 12, height: 12, borderRadius: '50%',
            background: 'radial-gradient(circle at 38% 32%, #7a684a, #201709)',
            boxShadow: 'inset 0 1px 2px rgba(0,0,0,.85), 0 1px 0 rgba(255,240,200,.24)',
          }} />
        </div>
      </button>

      {/* Pilot lamp */}
      <div aria-hidden="true" style={{
        position: 'absolute', left: '50%', bottom: 10, transform: 'translateX(-50%)',
        width: 9, height: 9, borderRadius: '50%', background: 'var(--lamp)',
        boxShadow: '0 0 14px 3px color-mix(in oklab, var(--lamp) 70%, transparent)',
      }} />
    </div>
  );
}
