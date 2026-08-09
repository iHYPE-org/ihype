// iHYPE HypeButton — the platform's namesake mechanic: a tap-to-hype flame with live count.
// Self-contained: only needs React. Injects its own @keyframes once per page.
if (typeof document !== 'undefined' && !document.getElementById('_hb_kf')) {
  const s = document.createElement('style');
  s.id = '_hb_kf';
  s.textContent = '@keyframes hbPop{0%{transform:scale(1)}35%{transform:scale(1.35)}60%{transform:scale(.92)}100%{transform:scale(1)}}@keyframes hbRing{0%{opacity:.55;transform:scale(.6)}100%{opacity:0;transform:scale(2.1)}}@media(prefers-reduced-motion:reduce){[data-hb-anim]{animation:none!important}}';
  document.head.appendChild(s);
}

const SIZES = { sm: { icon: 13, pad: '5px 10px', font: 11 }, md: { icon: 16, pad: '7px 14px', font: 13 }, lg: { icon: 20, pad: '10px 18px', font: 15 } };

function Flame({ size, active }) {
  return React.createElement('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: active ? 'currentColor' : 'none', stroke: 'currentColor', strokeWidth: active ? 0 : 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' },
    React.createElement('path', { d: 'M12 2c1 3-2 4-2 7a4 4 0 0 0 8 0c0-1-.5-2-1-2.5.5 2-1 3-2 3 1-3-1-4-1-6-1 1-3 2-3 5a3 3 0 0 0 3 3c-3 0-6-2-6-6 0-2 1-3.5 4-3.5z' })
  );
}

/**
 * HypeButton — pill-shaped flame toggle with animated count.
 * Pass `active` + `count` + `onToggle`; the component owns only the tap animation, not the count logic.
 */
export function HypeButton({ active, count, onToggle, size = 'md', disabled, disabledReason, roleColor, trend }) {
  const [popping, setPopping] = React.useState(false);
  const S = SIZES[size] || SIZES.md;
  const color = roleColor || '#ff5029';
  const handleClick = (e) => {
    if (disabled) return;
    setPopping(true);
    setTimeout(() => setPopping(false), 420);
    onToggle && onToggle(e);
  };
  return React.createElement('button', {
    onClick: handleClick,
    disabled,
    title: disabled ? disabledReason : undefined,
    style: {
      position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: S.pad, borderRadius: 999, cursor: disabled ? 'default' : 'pointer',
      fontFamily: "'JetBrains Mono', monospace", fontSize: S.font, lineHeight: 1,
      border: `1px solid ${active ? color + '4d' : 'rgba(255,255,255,.14)'}`,
      background: active ? color + '1f' : 'transparent',
      color: disabled ? '#8792a6' : active ? color : 'rgba(238,241,246,.7)',
      opacity: disabled ? 0.55 : 1,
      transition: 'background 150ms ease, border-color 150ms ease, color 150ms ease',
    },
  },
    popping && React.createElement('span', {
      'data-hb-anim': true,
      style: { position: 'absolute', inset: -4, borderRadius: 999, border: `2px solid ${color}`, animation: 'hbRing 420ms ease-out both', pointerEvents: 'none' },
    }),
    React.createElement('span', { 'data-hb-anim': true, style: { display: 'inline-flex', animation: popping ? 'hbPop 420ms cubic-bezier(.34,1.56,.64,1) both' : 'none' } },
      React.createElement(Flame, { size: S.icon, active })
    ),
    React.createElement('span', null, count),
    trend && React.createElement('span', { style: { fontSize: S.font - 3, opacity: 0.75, marginLeft: 1 } }, trend)
  );
}

