const _LT = { acc: '#ff5029', onAcc: '#0b1220', fd: "'Bricolage Grotesque',sans-serif" };

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
    fontFamily: _LT.fd, fontWeight: 800, fontSize: px,
    letterSpacing: '.01em', lineHeight: 1,
  });
  const bars = [5, 9, 6].map((h, i) =>
    React.createElement('i', {
      key: i,
      style: { display: 'block', width: 2, height: h, background: _LT.onAcc, borderRadius: 1 },
    })
  );
  return React.createElement('button', {
    type: 'button',
    onClick,
    'aria-expanded': expanded,
    'aria-label': expanded ? 'Close iHYPE navigation' : 'Open iHYPE navigation',
    style: {
      position: 'absolute', left: 0, bottom: 0, zIndex: 3,
      width: size, height: size, borderRadius: Math.round(size * 0.342),
      background: _LT.acc, color: _LT.onAcc, border: 0, cursor: 'pointer',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
      boxShadow: '0 14px 34px rgba(255,80,41,.3)',
    },
  },
    (() => {
      const px = size * 0.235;
      const h = px * 1.24;
      return React.createElement('span', {
        style: { display: 'flex', alignItems: 'center' },
      },
        React.createElement('span', { style: type(px) }, 'iH'),
        React.createElement('svg', {
          'aria-hidden': 'true', viewBox: '148 92 200 328',
          width: h * 0.61, height: h, style: { display: 'block', margin: '0 .06em' },
        }, React.createElement('path', {
          d: 'M280 96L152 288h96l-16 128 144-192h-96l16-128z', fill: 'currentColor',
        })),
        React.createElement('span', { style: type(px) }, 'PE')
      );
    })(),
    playing ? React.createElement('span', {
      'aria-hidden': 'true',
      style: { display: 'flex', gap: 2, alignItems: 'flex-end', height: 9 },
    }, bars) : null
  );
}
