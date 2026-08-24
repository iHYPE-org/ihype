'use client';
import React from 'react';

/* Re-anchored to design tokens, 2026-08-22. Prop signature UNCHANGED so
   _adherence.oxlintrc.json stays valid — this is strictly internal.
   This one was already partly tokenised and deliberately built for the
   walnut chrome — that intent is preserved. What changed:
   
   · hardcoded fallbacks stripped from var(--brass-deep, #8a6a2c) etc. A fallback
     that duplicates the token is a second source of truth that silently wins
     when the stylesheet fails to load, hiding the failure.
   · roleColor default '#ff5029' → var(--accent)
   · borderRadius 999 → var(--radius-pill)
   · font sizes 11/13/15 → the token scale; sm was below the mono floor, and
     'trend' rendered at font-3, which took every size under it
   · the sm and md paddings gave a control under 44px; all three now clear it
   · 150ms transitions → var(--duration-default) / var(--ease)
   
   The pop/ring keyframes stay injected locally: they are component-owned motion
   with no token equivalent, and the reduced-motion guard is already correct. */

if (typeof document !== 'undefined' && !document.getElementById('_hb_kf')) {
  const s = document.createElement('style');
  s.id = '_hb_kf';
  s.textContent = '@keyframes hbPop{0%{transform:scale(1)}35%{transform:scale(1.35)}60%{transform:scale(.92)}100%{transform:scale(1)}}@keyframes hbRing{0%{opacity:.55;transform:scale(.6)}100%{opacity:0;transform:scale(2.1)}}@media(prefers-reduced-motion:reduce){[data-hb-anim]{animation:none!important}}';
  document.head.appendChild(s);
}

const SIZES = {
  sm: { icon: 13, pad: '0 var(--space-3)', font: 'var(--text-xs)',   minH: 44 },
  md: { icon: 16, pad: '0 var(--space-4)', font: 'var(--text-base)', minH: 44 },
  lg: { icon: 20, pad: '0 var(--space-5)', font: 'var(--text-md)',   minH: 48 },
};

function Flame({ size, active }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill={active ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={active ? 0 : 1.8}
      strokeLinecap="round" strokeLinejoin="round"
    >
      <path d="M12 2c1 3-2 4-2 7a4 4 0 0 0 8 0c0-1-.5-2-1-2.5.5 2-1 3-2 3 1-3-1-4-1-6-1 1-3 2-3 5a3 3 0 0 0 3 3c-3 0-6-2-6-6 0-2 1-3.5 4-3.5z" />
    </svg>
  );
}

export function HypeButton({ active, count, onToggle, size = 'md', disabled, disabledReason, roleColor, trend, style }) {
  const [popping, setPopping] = React.useState(false);
  const S = SIZES[size] || SIZES.md;
  const color = roleColor || 'var(--accent)';

  const handleClick = (e) => {
    if (disabled) return;
    setPopping(true);
    setTimeout(() => setPopping(false), 420);
    onToggle && onToggle(e);
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      /* The count and the trend are the only text, so without this the control
         announces as "1,204 ▲ 340/hr" and never says what tapping it does. */
      aria-label={(active ? 'Hyped' : 'Hype') + (count != null ? ' — ' + count : '')}
      aria-pressed={active ? 'true' : 'false'}
      title={disabled ? disabledReason : undefined}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-1)',
        minHeight: S.minH,
        padding: S.pad,
        borderRadius: 'var(--radius-pill)',
        cursor: disabled ? 'default' : 'pointer',
        fontFamily: 'var(--font-mono)',
        fontSize: S.font,
        lineHeight: 1,
        /* This control lives on the walnut dock, so its ink is the on-walnut
           set — never --ink-1/2/3, which would be invisible there. */
        border: `1px solid ${active ? `color-mix(in oklab, ${color} 48%, transparent)` : 'var(--brass-deep)'}`,
        background: active ? `color-mix(in oklab, ${color} 12%, transparent)` : 'transparent',
        color: disabled ? 'var(--ink-on-walnut-3)' : active ? color : 'var(--ink-on-walnut)',
        opacity: disabled ? 0.55 : 1,
        transition: 'background var(--duration-default) var(--ease), border-color var(--duration-default) var(--ease), color var(--duration-default) var(--ease)',
        ...style,
      }}
    >
      {popping && (
        <span data-hb-anim style={{
          position: 'absolute',
          inset: -4,
          borderRadius: 'var(--radius-pill)',
          border: `2px solid ${color}`,
          animation: 'hbRing 420ms var(--ease-out) both',
          pointerEvents: 'none',
        }} />
      )}
      <span data-hb-anim style={{ display: 'inline-flex', animation: popping ? 'hbPop 420ms var(--ease-spring) both' : 'none' }}>
        <Flame size={S.icon} active={active} />
      </span>
      <span>{count}</span>
      {trend && <span style={{ fontSize: 'var(--text-xs)', opacity: 0.75, marginLeft: 1 }}>{trend}</span>}
    </button>
  );
}
