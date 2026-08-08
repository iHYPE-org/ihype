const _MP = {
  ink: '#eef1f6', ink2: '#96a1b5', ink3: '#8792a6', acc: '#ff5029',
  fd: "'Bricolage Grotesque',sans-serif", fb: "'Work Sans',system-ui,sans-serif",
  fm: "'JetBrains Mono',monospace",
};

/**
 * The single scroll container. `html`/`body` are locked by the shell, and this
 * is the one element that scrolls — which is what lets the map stay mounted
 * underneath and keeps the bottom-left chrome fixed relative to the frame
 * rather than to the document.
 *
 * The bottom padding is not decorative: it reserves the band the player pill
 * and logo trigger occupy, so the last row of content is never parked under
 * them.
 */
export function ModulePane({ eyebrow, title, dek, children, maxWidth = 1120, padBottom = 132 }) {
  return React.createElement('div', {
    style: {
      position: 'absolute', inset: 0, overflowY: 'auto', overflowX: 'hidden',
      WebkitOverflowScrolling: 'touch',
      padding: '36px 40px ' + padBottom + 'px',
      fontFamily: _MP.fb, color: _MP.ink,
    },
  }, React.createElement('div', { style: { maxWidth, margin: '0 auto' } },
    eyebrow ? React.createElement('div', {
      style: {
        fontFamily: _MP.fm, fontSize: 10, letterSpacing: '.22em',
        textTransform: 'uppercase', color: _MP.acc, marginBottom: 12,
      },
    }, eyebrow) : null,
    title ? React.createElement('h1', {
      style: {
        fontFamily: _MP.fd, fontWeight: 800, fontSize: 46, lineHeight: 1.03,
        letterSpacing: '-.035em', margin: '0 0 8px', maxWidth: 780,
      },
    }, title) : null,
    dek ? React.createElement('p', {
      style: { fontSize: 15, lineHeight: 1.65, color: _MP.ink2, maxWidth: 640, margin: '0 0 24px' },
    }, dek) : null,
    children
  ));
}
