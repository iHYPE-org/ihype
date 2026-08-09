const _MS = {
  surf: '#121b2e', surf2: '#18233a', ink: '#eef1f6', ink2: '#96a1b5', ink3: '#8792a6',
  acc: '#ff5029', line: 'rgba(238,241,246,.13)',
  fd: "'Bricolage Grotesque',sans-serif", fb: "'Work Sans',system-ui,sans-serif",
  fm: "'JetBrains Mono',monospace",
};

/**
 * The pin detail sheet. It belongs to the map: leaving the map must close it,
 * or it floats over a module pane as orphaned chrome.
 *
 * It rises from the bottom edge and stops short of the chrome band, so the logo
 * trigger and the player stay reachable while a sheet is open — the sheet is a
 * peer of the map, not a modal over the whole frame.
 */
export function MapSheet({ target, onClose }) {
  if (!target) return null;
  const rows = target.rows || [];
  return React.createElement('div', {
    role: 'dialog',
    'aria-label': target.title,
    style: {
      /* The sheet ENDS above the player rather than running under it. It used to
         sit at bottom:0 with a tall bottom padding, but padding inside a
         scrolling box only adds empty space at the end of the scroll — it
         cannot stop the player painting over the band it occupies, so the last
         thing in the sheet (the link out to the page) sat under the pill and
         could not be clicked. Clearing the whole chrome row is the only version
         of this that is true at every scroll position: 26 inset + 88 pill + 14.
         It is a floating card now, not a bottom sheet, so it is radiused on all
         four corners. */
      position: 'fixed', left: '50%', bottom: 128, transform: 'translateX(-50%)',
      width: 'min(620px,calc(100% - 48px))',
      maxHeight: 'calc(100vh - 176px)', overflowY: 'auto', overscrollBehavior: 'contain',
      background: _MS.surf, border: '1px solid ' + _MS.line,
      borderRadius: 22, padding: '22px 24px 24px',
      boxShadow: '0 24px 60px rgba(4,8,18,.6)', fontFamily: _MS.fb, color: _MS.ink,
      animation: 'none',
    },
  },
    React.createElement('div', { style: { display: 'flex', alignItems: 'flex-start', gap: 14 } },
      React.createElement('div', {
        'aria-hidden': 'true',
        style: {
          width: 46, height: 46, borderRadius: 9999, flex: '0 0 auto',
          background: _MS.surf2, border: '1px solid ' + _MS.line,
          display: 'grid', placeItems: 'center',
          fontFamily: _MS.fd, fontWeight: 800, fontSize: 18, color: _MS.acc,
        },
      }, (target.title || '?').charAt(0)),
      React.createElement('div', { style: { flex: 1, minWidth: 0 } },
        target.kind ? React.createElement('div', {
          style: {
            fontFamily: _MS.fm, fontSize: 10, letterSpacing: '.16em',
            textTransform: 'uppercase', color: _MS.ink3, marginBottom: 5,
          },
        }, target.kind) : null,
        /* The name IS the link. It is the biggest thing on the sheet and the
           thing you came to read, so making it inert and putting the navigation
           in a button further down asks you to find the destination twice. The
           button below stays for the same reason a page keeps a footer link:
           it is the affordance you scan for when the heading did not read as
           one. Falls back to plain text when there is no route. */
        target.action && target.action.href ? React.createElement('a', {
          href: target.action.href, target: '_top',
          style: {
            display: 'inline-block', color: _MS.ink, textDecoration: 'underline',
            textDecorationColor: 'rgba(238,241,246,.28)', textUnderlineOffset: 4,
            fontFamily: _MS.fd, fontWeight: 800, fontSize: 24, letterSpacing: '-.03em',
          },
        }, target.title) : React.createElement('div', {
          style: { fontFamily: _MS.fd, fontWeight: 800, fontSize: 24, letterSpacing: '-.03em' },
        }, target.title),
        target.meta ? React.createElement('div', {
          style: { fontSize: 13, color: _MS.ink2, marginTop: 3 },
        }, target.meta) : null
      ),
      React.createElement('button', {
        type: 'button', onClick: onClose, 'aria-label': 'Close',
        style: {
          width: 32, height: 32, borderRadius: 9999, flex: '0 0 auto',
          background: 'rgba(238,241,246,.06)', border: '1px solid ' + _MS.line,
          color: _MS.ink, cursor: 'pointer', fontSize: 12,
        },
      }, React.createElement('span', { 'aria-hidden': 'true' }, '\u2715'))
    ),
    target.body ? React.createElement('p', {
      style: { fontSize: 14, lineHeight: 1.65, color: _MS.ink2, margin: '16px 0 0' },
    }, target.body) : null,
    /* A day's lineup, when the pin was opened on a date: time + who + what it
       costs, in the order they play. This is the "what is happening here today"
       screen, so it outranks the stat rows below it. */
    (target.lines || []).length ? React.createElement('div', {
      style: { marginTop: 16, borderTop: '1px solid ' + _MS.line },
    }, target.lines.map((l, i) => React.createElement('div', {
      key: i,
      style: {
        display: 'flex', alignItems: 'baseline', gap: 12, padding: '11px 0',
        borderBottom: '1px solid rgba(238,241,246,.07)',
      },
    },
      React.createElement('span', {
        style: { fontFamily: _MS.fm, fontSize: 11, color: _MS.ink3, flex: '0 0 62px' },
      }, l.time),
      React.createElement('span', { style: { flex: 1, minWidth: 0 } },
        React.createElement('span', {
          style: { fontFamily: _MS.fd, fontWeight: 600, fontSize: 15, letterSpacing: '-.015em', color: _MS.ink, display: 'block' },
        }, l.title),
        l.meta ? React.createElement('span', { style: { fontSize: 12.5, color: _MS.ink2 } }, l.meta) : null
      ),
      l.value ? React.createElement('span', {
        style: { fontFamily: _MS.fm, fontSize: 12, color: _MS.ink2, flex: '0 0 auto' },
      }, l.value) : null
    ))) : null,

    target.action ? React.createElement('a', {
      href: target.action.href || '#',
      target: '_top',
      style: {
        display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 16,
        background: _MS.acc, color: '#fff', textDecoration: 'none',
        borderRadius: 9999, padding: '11px 20px',
        fontFamily: _MS.fd, fontWeight: 600, fontSize: 14, letterSpacing: '-.01em',
      },
    }, target.action.label, React.createElement('span', { 'aria-hidden': 'true' }, '\u2192')) : null,

    rows.length ? React.createElement('div', {
      style: { marginTop: 18, borderTop: '1px solid ' + _MS.line },
    }, rows.map((r, i) => React.createElement('div', {
      key: i,
      style: {
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0',
        borderBottom: '1px solid rgba(238,241,246,.07)', fontSize: 13.5,
      },
    },
      React.createElement('span', { style: { color: _MS.ink2, flex: 1 } }, r.label),
      React.createElement('span', {
        style: { fontFamily: _MS.fm, fontSize: 12, color: r.accent ? _MS.acc : _MS.ink },
      }, r.value)
    ))) : null
  );
}
