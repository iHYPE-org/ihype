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
 * The transport: a controller thumbstick machined in brass, seated in a
 * recessed gate on a machined plate. Knurled grip ring, concave dish lit from
 * the far wall so it reads as a bowl rather than a dome.
 *
 * Tap for play/pause. Push left or right for previous and next, up to open the
 * full player, down to collapse it. The stick TRAVELS as well as tilts — a
 * thumbstick that only rotates reads as a picture of one — and springs back on
 * release. Four engraved brass nameplates ring the gate; the one the stick
 * reaches brightens and takes a lamp glow.
 */

const THROW = 40; // px before the gate registers a direction
const GATES = ['up', 'down', 'left', 'right'];

const PLATE_BASE = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 'var(--space-1) var(--space-4)', borderRadius: 'var(--radius-sm)',
  border: '1px solid #3d2c0c',
  background: 'linear-gradient(180deg, #f2dca4 0%, var(--brass) 30%, var(--brass-deep) 100%)',
  fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', fontWeight: 600,
  letterSpacing: 'var(--tracking-wider)', color: '#33240a',
  textShadow: '0 1px 0 rgba(255,248,224,.5)',
  /* Deliberately NO transition: an unadvanced transition pins the unlit state
     forever in an embedded context. The glow is written directly. */
};
const PLATE_OFF = '0 3px 5px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,250,232,.65)';
const PLATE_ON = '0 3px 5px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,250,232,.75), 0 0 20px 3px color-mix(in oklab, var(--lamp) 80%, transparent)';

export function JoystickTransport({
  playing = false, canTogglePlay = true,
  onTogglePlay, onPrev, onNext, onExpand, onCollapse,
  /* Matched to RotaryNav at the dock figure — see the note there. */
  size = 74,
}) {
  const stick = React.useRef(null);
  const shadow = React.useRef(null);
  const plates = React.useRef({});
  const drag = React.useRef(null);
  const [tilt, setTilt] = React.useState({ x: 0, y: 0 });

  const gate = Math.abs(tilt.x) > Math.abs(tilt.y)
    ? (tilt.x > 0.45 ? 'right' : tilt.x < -0.45 ? 'left' : null)
    : (tilt.y > 0.45 ? 'up' : tilt.y < -0.45 ? 'down' : null);

  React.useEffect(() => {
    const { x, y } = tilt;
    if (stick.current) {
      stick.current.style.transform =
        'translate(' + x * 28 + 'px,' + -y * 28 + 'px) rotateX(' + -y * 20 + 'deg) rotateZ(' + x * 15 + 'deg)';
    }
    if (shadow.current) {
      shadow.current.style.transform =
        'translate(' + x * 24 + 'px,' + -y * 10 + 'px) scale(' + (1 - Math.max(Math.abs(x), Math.abs(y)) * 0.06) + ')';
    }
    for (const g of GATES) {
      const n = plates.current[g];
      if (!n) continue;
      const on = g === gate;
      n.style.filter = on ? 'brightness(1.3)' : 'none';
      n.style.boxShadow = on ? PLATE_ON : PLATE_OFF;
    }
  }, [tilt, gate]);

  const fire = (g) => {
    if (g === 'left') onPrev && onPrev();
    if (g === 'right') onNext && onNext();
    if (g === 'up') onExpand && onExpand();
    if (g === 'down') onCollapse && onCollapse();
  };

  const plate = (g, label, pos) => (
    <div
      ref={(n) => { plates.current[g] = n; }}
      aria-hidden="true"
      style={{ position: 'absolute', ...pos, ...PLATE_BASE, boxShadow: PLATE_OFF }}
    >{label}</div>
  );

  const gateInset = Math.round(size * 0.194);
  const puck = Math.round(size * 0.433);

  return (
    <div style={{ position: 'relative', width: size, height: size, flex: '0 0 auto', perspective: size * 2 }}>
      {/* Machined plate. Steel has no token — see the header note. */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 'var(--radius-sm)',
        background: 'linear-gradient(168deg, #55483a 0%, #362c21 22%, #221a12 60%, #16100a 100%)',
        boxShadow: 'inset 0 1px 0 rgba(255,240,200,.2), inset 0 -2px 6px rgba(0,0,0,.7), var(--shadow-raised)',
      }} />
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 'var(--radius-sm)',
        background: 'repeating-linear-gradient(94deg, rgba(255,255,255,.035) 0 1px, transparent 1px 3px)',
      }} />

      {[['left', 'top'], ['right', 'top'], ['left', 'bottom'], ['right', 'bottom']].map(([h, v]) => (
        <div key={h + v} aria-hidden="true" style={{
          position: 'absolute', [h]: 12, [v]: 12, width: 9, height: 9, borderRadius: '50%',
          background: 'radial-gradient(circle at 34% 30%, #efe3c6, var(--ink-3))',
          boxShadow: 'inset 0 -1px 1px rgba(0,0,0,.6)',
        }} />
      ))}

      {/* Recessed gate */}
      <div style={{
        position: 'absolute', inset: gateInset + 4, borderRadius: '50%',
        background: 'radial-gradient(circle at 50% 30%, #050301 0%, #0e0a05 60%, #1e160c 100%)',
        boxShadow: 'inset 0 12px 24px rgba(0,0,0,.95), inset 0 -4px 10px color-mix(in oklab, var(--lamp) 9%, transparent)',
      }} />
      <div style={{
        position: 'absolute', inset: gateInset, borderRadius: '50%', pointerEvents: 'none',
        boxShadow: '0 0 0 3px var(--brass-deep), 0 0 0 5px color-mix(in oklab, var(--brass) 20%, transparent), inset 0 2px 5px rgba(0,0,0,.7)',
      }} />

      {plate('up', 'OPEN', { left: '50%', top: 16, transform: 'translateX(-50%)' })}
      {plate('down', 'CLOSE', { left: '50%', bottom: 16, transform: 'translateX(-50%)' })}
      {plate('left', 'PREV', { left: 10, top: '50%', transform: 'translateY(-50%)' })}
      {plate('right', 'NEXT', { right: 10, top: '50%', transform: 'translateY(-50%)' })}

      <div ref={shadow} aria-hidden="true" style={{
        position: 'absolute', left: '50%', top: '50%',
        width: puck, height: puck, margin: (-puck / 2) + 'px 0 0 ' + (-puck / 2) + 'px',
        borderRadius: '50%', pointerEvents: 'none',
        background: 'radial-gradient(circle, rgba(0,0,0,.7) 40%, transparent 72%)',
        transition: 'transform var(--duration-default) var(--ease-spring)',
      }} />

      <div
        ref={stick}
        role="button"
        tabIndex={0}
        aria-label="Transport thumbstick"
        aria-pressed={playing}
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, y: e.clientY, fired: false, moved: 0 };
          e.currentTarget.setPointerCapture(e.pointerId);
          e.currentTarget.style.cursor = 'grabbing';
          e.currentTarget.style.transition = 'none';
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y;
          drag.current.moved = Math.max(drag.current.moved, Math.hypot(dx, dy));
          const ax = Math.abs(dx), ay = Math.abs(dy);
          /* A gated stick only lets one axis win at a time. */
          setTilt({
            x: ax >= ay ? Math.max(-1, Math.min(1, dx / 64)) : 0,
            y: ay > ax ? Math.max(-1, Math.min(1, -dy / 64)) : 0,
          });
          if (!drag.current.fired && Math.max(ax, ay) > THROW) {
            drag.current.fired = true;
            fire(ax >= ay ? (dx > 0 ? 'right' : 'left') : (dy < 0 ? 'up' : 'down'));
          }
        }}
        onPointerUp={(e) => {
          if (!drag.current) return;
          const { fired, moved } = drag.current;
          drag.current = null;
          e.currentTarget.style.cursor = 'grab';
          e.currentTarget.style.transition = 'transform var(--duration-default) var(--ease-spring)';
          setTilt({ x: 0, y: 0 });
          if (!fired && moved < 6 && canTogglePlay) onTogglePlay && onTogglePlay();
        }}
        onPointerCancel={() => { drag.current = null; setTilt({ x: 0, y: 0 }); }}
        onKeyDown={(e) => {
          const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
          if (map[e.key]) { e.preventDefault(); fire(map[e.key]); }
          if ((e.key === 'Enter' || e.key === ' ') && canTogglePlay) { e.preventDefault(); onTogglePlay && onTogglePlay(); }
        }}
        style={{
          position: 'absolute', left: '50%', top: '50%',
          width: puck, height: puck, margin: (-puck / 2) + 'px 0 0 ' + (-puck / 2) + 'px',
          borderRadius: '50%', transformStyle: 'preserve-3d', willChange: 'transform',
          cursor: 'grab', touchAction: 'none',
          transition: 'transform var(--duration-default) var(--ease-spring)',
        }}
      >
        {/* Grip ring */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: 'radial-gradient(circle at 34% 24%, #f6e6b6 0%, var(--brass) 30%, var(--brass-deep) 72%, #4a3712 100%)',
          boxShadow: 'var(--shadow-play), 0 4px 0 #3a2a0e, inset 0 2px 2px rgba(255,248,224,.5)',
        }} />
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: 'repeating-conic-gradient(from 0deg, rgba(0,0,0,.3) 0deg 1.2deg, transparent 1.2deg 4.2deg)',
          WebkitMaskImage: 'radial-gradient(circle, transparent 74%, #000 77%, #000 98%, transparent 100%)',
          maskImage: 'radial-gradient(circle, transparent 74%, #000 77%, #000 98%, transparent 100%)',
        }} />
        {/* Concave dish — shadow at the near wall, light at the far wall. */}
        <div style={{
          position: 'absolute', inset: Math.round(puck * 0.122), borderRadius: '50%',
          background: 'radial-gradient(circle at 50% 4%, rgba(0,0,0,.78) 0%, rgba(0,0,0,.3) 36%, transparent 66%), radial-gradient(circle at 50% 96%, #f4dfa8 0%, #d6b26c 26%, var(--brass-deep) 64%, #38290c 100%)',
          boxShadow: 'inset 0 14px 26px rgba(0,0,0,.72), inset 0 -12px 18px rgba(255,242,206,.26), 0 1px 0 rgba(255,248,224,.45)',
        }} />
        <div style={{
          position: 'absolute', inset: Math.round(puck * 0.122), borderRadius: '50%',
          pointerEvents: 'none', boxShadow: 'inset 0 0 0 1px rgba(58,41,12,.55)',
        }} />
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%', pointerEvents: 'none',
          background: 'linear-gradient(150deg, rgba(255,255,255,.34) 0%, transparent 32%, transparent 70%, rgba(255,255,255,.1) 100%)',
        }} />
        {/* Lit while playing */}
        <div aria-hidden="true" style={{
          position: 'absolute', inset: Math.round(puck * 0.122), borderRadius: '50%',
          pointerEvents: 'none', opacity: playing ? 1 : 0,
          boxShadow: 'inset 0 0 24px color-mix(in oklab, var(--accent) 55%, transparent), 0 0 26px -4px color-mix(in oklab, var(--accent) 50%, transparent)',
        }} />
      </div>
    </div>
  );
}
