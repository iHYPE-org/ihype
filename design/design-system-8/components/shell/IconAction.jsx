const _IA = {
  raised: '#18233a', ink: '#eef1f6', ink2: '#96a1b5',
  line: 'rgba(238,241,246,.13)', acc: '#ff5029', err: '#ff4545',
  fm: "'JetBrains Mono',monospace",
};

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
  glyph, label, onClick, size = 40, danger = false, delay = 380, children,
}) {
  const [tip, setTip] = React.useState(false);
  const [hot, setHot] = React.useState(false);
  const timer = React.useRef(0);
  const pressed = React.useRef(false);

  React.useEffect(() => () => clearTimeout(timer.current), []);

  const arm = () => { clearTimeout(timer.current); timer.current = setTimeout(() => setTip(true), delay); };
  const disarm = () => { clearTimeout(timer.current); setTip(false); };

  /* Not `--danger`: that is an alias of the accent in this system, and a delete
     button in the brand colour is the one thing it must not look like. */
  const tone = danger ? _IA.err : _IA.acc;

  return React.createElement('span', {
    style: { position: 'relative', display: 'inline-flex', flex: '0 0 auto' },
  },
    React.createElement('button', {
      type: 'button',
      onClick: (e) => { e.stopPropagation(); disarm(); onClick && onClick(e); },
      'aria-label': label,
      onPointerEnter: (e) => { if (e.pointerType !== 'touch') { setHot(true); arm(); } },
      onPointerLeave: () => { setHot(false); disarm(); },
      onFocus: () => { setHot(true); setTip(true); },
      onBlur: () => { setHot(false); setTip(false); },
      /* Touch: hold to read the label. The press is cancelled by the tap that
         follows, so a quick tap still just runs the action. */
      onPointerDown: (e) => { if (e.pointerType === 'touch') { pressed.current = true; arm(); } },
      onPointerUp: () => { if (pressed.current) { pressed.current = false; disarm(); } },
      onPointerCancel: () => { pressed.current = false; disarm(); },
      onContextMenu: (e) => { if (pressed.current) e.preventDefault(); },
      style: {
        width: size, height: size, padding: 0, borderRadius: 9999,
        display: 'grid', placeItems: 'center', cursor: 'pointer',
        background: hot ? (danger ? 'rgba(255,69,69,.14)' : 'rgba(255,80,41,.14)') : _IA.raised,
        border: '1px solid ' + (hot ? tone : _IA.line),
        color: hot ? tone : _IA.ink2,
        fontSize: Math.round(size * 0.42),
        lineHeight: 1,
        WebkitTapHighlightColor: 'transparent',
        touchAction: 'manipulation',
      },
    }, children || React.createElement('span', { 'aria-hidden': 'true' }, glyph)),

    tip ? React.createElement('span', {
      role: 'tooltip',
      style: {
        position: 'absolute', bottom: 'calc(100% + 8px)', left: '50%',
        transform: 'translateX(-50%)',
        whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 50,
        background: '#0b1220', color: _IA.ink,
        border: '1px solid ' + _IA.line, borderRadius: 8,
        padding: '6px 10px',
        fontFamily: _IA.fm, fontSize: 9.5, letterSpacing: '.12em', textTransform: 'uppercase',
        boxShadow: '0 10px 26px rgba(4,8,18,.6)',
      },
    }, label) : null
  );
}
