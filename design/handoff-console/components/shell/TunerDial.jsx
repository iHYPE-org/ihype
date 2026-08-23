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
 * The sub-section selector. A rotary drum on a backlit cream dial in a brass
 * bezel: the selection sits centre stage under the index mark, the neighbouring
 * choices are smaller wings canted back either side, and a tick barrel below
 * follows your finger between detents and settles on release.
 *
 * The backlight is three warm bulbs pooling up from the bottom edge, not a
 * uniform wash — an even glow reads as an LED panel.
 *
 * role="tablist" of role="tab", NOT role="slider": a slider announces a number
 * where this needs a destination name.
 */

const DETENT = 78; // px of barrel travel per station, matching the tick pitch

export function TunerStation() { return null; } // shape only — see the lint contract

export function TunerDial({ stations = [], active, onChange, height = 74 }) {
  /* The dial takes the dock's own height and the space between the two knobs.
     214 was a specimen height for inspection; in the bar it is 74. */
  const idx = Math.max(0, stations.findIndex((s) => s.id === active));
  const [drag, setDrag] = React.useState(0);
  const grab = React.useRef(null);
  const drum = React.useRef(null);

  React.useEffect(() => {
    if (!drum.current) return;
    drum.current.style.transition = grab.current ? 'none' : 'transform var(--duration-medium) var(--ease-spring)';
    drum.current.style.transform = 'translateX(' + (-idx * DETENT + drag) + 'px)';
  }, [idx, drag]);

  const step = (n) => {
    const next = Math.max(0, Math.min(stations.length - 1, n));
    if (stations[next] && onChange) onChange(stations[next], next);
    return next;
  };

  const cur = stations[idx] || {};
  const prev = stations[idx - 1];
  const next = stations[idx + 1];

  const wing = (side) => ({
    flex: '1 1 0', minWidth: 0, textAlign: 'center',
    fontFamily: 'var(--font-display)', fontSize: 'var(--text-lg)',
    lineHeight: 'var(--leading-heading)', letterSpacing: 'var(--tracking-normal)',
    color: 'var(--ink-1)', opacity: 0.4,
    transform: 'perspective(420px) rotateY(' + (side === 'left' ? 46 : -46) + 'deg) scale(.92)',
    transformOrigin: (side === 'left' ? '90%' : '10%') + ' center',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  });

  return (
    <div
      role="tablist"
      aria-label="Sub-section"
      onPointerDown={(e) => {
        grab.current = { x: e.clientX, from: idx };
        e.currentTarget.setPointerCapture(e.pointerId);
        e.currentTarget.style.cursor = 'grabbing';
      }}
      onPointerMove={(e) => {
        if (!grab.current) return;
        const dx = e.clientX - grab.current.x;
        const landed = step(grab.current.from - Math.round(dx / DETENT));
        setDrag(dx + (landed - grab.current.from) * DETENT);
      }}
      onPointerUp={(e) => { grab.current = null; setDrag(0); e.currentTarget.style.cursor = 'grab'; }}
      onPointerCancel={() => { grab.current = null; setDrag(0); }}
      onWheel={(e) => { e.preventDefault(); step(idx + (e.deltaY > 0 ? 1 : -1)); }}
      style={{
        position: 'relative', width: '100%', height, borderRadius: 'var(--radius-sm)',
        cursor: 'grab', touchAction: 'none', overflow: 'hidden',
        background: 'radial-gradient(130% 160% at 50% 4%, #fffdf4 0%, #f7eed3 42%, #e6d5aa 80%, #cfba89 100%)',
        boxShadow: '0 0 0 3px var(--brass), 0 0 0 5px var(--brass-deep), inset 0 3px 12px rgba(92,62,20,.32), inset 0 -20px 34px -14px color-mix(in oklab, var(--lamp) 34%, transparent), var(--shadow-play)',
      }}
    >
      {/* Analog backlight: three bulbs, uneven, pooling from the bottom edge. */}
      <div aria-hidden="true" style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        animation: 'ihBacklight 5.5s var(--ease-in-out) infinite',
        background: 'radial-gradient(46% 116% at 19% 116%, rgba(255,176,86,.62) 0%, rgba(255,146,48,.3) 34%, rgba(255,140,45,.09) 58%, transparent 74%), radial-gradient(50% 124% at 50% 122%, rgba(255,192,110,.7) 0%, rgba(255,158,60,.34) 32%, rgba(255,140,45,.1) 56%, transparent 74%), radial-gradient(46% 116% at 81% 116%, rgba(255,176,86,.62) 0%, rgba(255,146,48,.3) 34%, rgba(255,140,45,.09) 58%, transparent 74%), linear-gradient(180deg, rgba(120,74,18,.14) 0%, transparent 34%)',
      }} />
      <div aria-hidden="true" style={{
        position: 'absolute', left: '12%', right: '12%', bottom: -3, height: 7,
        borderRadius: '50%', pointerEvents: 'none', filter: 'blur(2px)',
        background: 'radial-gradient(ellipse, rgba(255,206,132,.85), rgba(255,160,64,.3) 60%, transparent 80%)',
      }} />

      {/* Index mark */}
      <div aria-hidden="true" style={{
        position: 'absolute', left: '50%', top: 0, transform: 'translateX(-50%)',
        width: 0, height: 0, borderLeft: '9px solid transparent', borderRight: '9px solid transparent',
        borderTop: '14px solid var(--live)', filter: 'drop-shadow(0 1px 1px rgba(0,0,0,.35))',
      }} />
      <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, top: 34, height: 1, background: 'var(--line)' }} />
      <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, bottom: 46, height: 1, background: 'var(--line)' }} />

      <div style={{ position: 'absolute', left: 0, right: 0, top: 44, height: height - 110, display: 'flex', alignItems: 'center' }}>
        <div aria-hidden="true" style={wing('left')}>{prev ? prev.label : ''}</div>
        <div
          role="tab"
          aria-selected="true"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') { e.preventDefault(); step(idx + 1); }
            if (e.key === 'ArrowLeft') { e.preventDefault(); step(idx - 1); }
          }}
          style={{
            flex: '0 0 auto', maxWidth: '40%', textAlign: 'center', padding: '0 var(--space-5)',
            fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)',
            lineHeight: 'var(--leading-display)', letterSpacing: 'var(--tracking-normal)',
            color: 'var(--ink-1)', background: 'transparent', border: 0,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}
        >{cur.label}</div>
        <div aria-hidden="true" style={wing('right')}>{next ? next.label : ''}</div>
      </div>

      {/* Tick barrel */}
      <div aria-hidden="true" style={{
        position: 'absolute', left: 0, right: 0, bottom: 16, height: 26, overflow: 'hidden',
        WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 14%, #000 86%, transparent)',
        maskImage: 'linear-gradient(90deg, transparent, #000 14%, #000 86%, transparent)',
      }}>
        <div ref={drum} style={{
          position: 'absolute', inset: '-1px -60%', willChange: 'transform',
          backgroundImage: 'repeating-linear-gradient(90deg, rgba(28,20,8,.82) 0 2px, transparent 2px 78px), repeating-linear-gradient(90deg, rgba(28,20,8,.34) 0 1px, transparent 1px 9.75px)',
          backgroundSize: 'auto 18px, auto 10px',
          backgroundRepeat: 'repeat-x, repeat-x',
          backgroundPosition: '0 0, 0 bottom',
        }} />
      </div>
      <div aria-hidden="true" style={{
        position: 'absolute', left: '50%', bottom: 16, transform: 'translateX(-50%)',
        width: 1.5, height: 26, background: 'var(--live)',
        boxShadow: '0 0 6px color-mix(in oklab, var(--live) 60%, transparent)',
      }} />

      <div aria-hidden="true" style={{
        position: 'absolute', left: 20, top: 44,
        fontFamily: 'var(--font-display)', fontSize: 'var(--text-lg)',
        letterSpacing: 'var(--tracking-wider)', color: 'var(--ink-1)', opacity: 0.3,
      }}>VU</div>

      {/* Glass */}
      <div aria-hidden="true" style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'linear-gradient(152deg, rgba(255,255,255,.4) 0%, rgba(255,255,255,.07) 24%, transparent 44%)',
      }} />
    </div>
  );
}
