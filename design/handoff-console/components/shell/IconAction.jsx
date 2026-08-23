'use client';
import React from 'react';

/* Re-anchored to design tokens, 2026-08-22. Prop signature UNCHANGED so
   _adherence.oxlintrc.json stays valid — this is strictly internal.
   · #ff4545 was an invented red with no token behind it → var(--color-error).
     The original comment is right that --danger must not be used (it aliases the
     accent, and a delete button in the brand colour is the one thing it must not
     be) — but the answer is the error token, not a fresh hex.
   · surface #4a2b16 → var(--walnut); ink → the on-walnut set; line → var(--rule-on-walnut)
   · tooltip background #1a1206 → var(--walnut-3)
   · tooltip fontSize 9.5 → var(--text-xs) (11px mono floor)
   · tooltip shadow rgba(4,8,18,.6) was NAVY → var(--shadow-raised)
   · tooltip radius 8 → var(--radius-panel); hover fills → color-mix on the token
   · size 40 → 44 (touch-target floor) */

/**
 * An icon button that says what it does.
 *
 * A bare glyph is a guess until you tap it. This waits out a hover (or a long
 * press, which is the touch equivalent — there is no hover on a phone) and then
 * names the action, so the guess is never necessary and the label never gets in
 * the way of someone who already knows.
 *
 * The delay matters: no delay and the tooltip flashes at every pointer that
 * crosses the row on its way somewhere else. The long press deliberately does
 * NOT fire the action — a press that reveals a label and then also does the
 * thing it labels is a trap.
 *
 * Danger actions take the red treatment on hover rather than at rest, so a row
 * of controls does not read as a warning when nothing is wrong.
 */
export function IconAction({
  glyph, label, onClick, size = 44, danger = false, delay = 380, children,
}) {
  const [tip, setTip] = React.useState(false);
  const [hot, setHot] = React.useState(false);
  const timer = React.useRef(0);
  const pressed = React.useRef(false);

  React.useEffect(() => () => clearTimeout(timer.current), []);

  const arm = () => { clearTimeout(timer.current); timer.current = setTimeout(() => setTip(true), delay); };
  const disarm = () => { clearTimeout(timer.current); setTip(false); };

  const tone = danger ? 'var(--color-error)' : 'var(--accent)';

  return (
    <span style={{ position: 'relative', display: 'inline-flex', flex: '0 0 auto' }}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); disarm(); onClick && onClick(e); }}
        aria-label={label}
        onPointerEnter={(e) => { if (e.pointerType !== 'touch') { setHot(true); arm(); } }}
        onPointerLeave={() => { setHot(false); disarm(); }}
        onFocus={() => { setHot(true); setTip(true); }}
        onBlur={() => { setHot(false); setTip(false); }}
        /* Touch: hold to read the label. The press is cancelled by the tap that
           follows, so a quick tap still just runs the action. */
        onPointerDown={(e) => { if (e.pointerType === 'touch') { pressed.current = true; arm(); } }}
        onPointerUp={() => { if (pressed.current) { pressed.current = false; disarm(); } }}
        onPointerCancel={() => { pressed.current = false; disarm(); }}
        onContextMenu={(e) => { if (pressed.current) e.preventDefault(); }}
        style={{
          width: size,
          height: size,
          padding: 0,
          borderRadius: 'var(--radius-pill)',
          display: 'grid',
          placeItems: 'center',
          cursor: 'pointer',
          background: hot ? `color-mix(in oklab, ${tone} 14%, transparent)` : 'var(--walnut)',
          border: `1px solid ${hot ? tone : 'var(--rule-on-walnut)'}`,
          color: hot ? tone : 'var(--ink-on-walnut-2)',
          fontSize: Math.round(size * 0.42),
          lineHeight: 1,
          WebkitTapHighlightColor: 'transparent',
          touchAction: 'manipulation',
        }}
      >
        {children || <span aria-hidden="true">{glyph}</span>}
      </button>

      {tip && (
        <span role="tooltip" style={{
          position: 'absolute',
          bottom: 'calc(100% + var(--space-2))',
          left: '50%',
          transform: 'translateX(-50%)',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          zIndex: 50,
          background: 'var(--walnut-3)',
          color: 'var(--ink-on-walnut)',
          border: '1px solid var(--rule-on-walnut)',
          borderRadius: 'var(--radius-panel)',
          padding: 'var(--space-1) var(--space-3)',
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-xs)',
          letterSpacing: 'var(--tracking-wider)',
          textTransform: 'uppercase',
          boxShadow: 'var(--shadow-raised)',
        }}>{label}</span>
      )}
    </span>
  );
}
