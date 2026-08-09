const _FP = {
  base: '#0b1220', surf: '#121b2e', raised: '#18233a',
  ink: '#eef1f6', ink2: '#96a1b5', ink3: '#8792a6',
  acc: '#ff5029', line: 'rgba(238,241,246,.13)', hair: 'rgba(238,241,246,.07)',
  fd: "'Bricolage Grotesque',sans-serif", fb: "'Work Sans',system-ui,sans-serif",
  fm: "'JetBrains Mono',monospace",
};

/**
 * The full-screen player. Phone only.
 *
 * The phone bar carries three things: artwork, the two names, transport. Every
 * other control the desktop pill has — scrub, volume, HYPE, favourite, queue,
 * history — lives here instead of being crushed into a 250px row. Tapping the
 * artwork opens this; the iHYPE square in the bottom-left corner closes it.
 *
 * That square is deliberately the same object in the same place as the shell's
 * nav trigger: on this screen it means "back", and putting it anywhere else
 * would make the way out somewhere new to look. It is a different control with
 * the same body, which is why it carries its own label.
 *
 * Everything is drawn at its final value. No CSS keyframes and no transitions
 * that depend on the document timeline advancing.
 */

function ring(size, stroke, pct, colorOn, colorOff) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return React.createElement('svg', {
    width: size, height: size, viewBox: '0 0 ' + size + ' ' + size, 'aria-hidden': 'true',
    style: { position: 'absolute', inset: 0 },
  },
    React.createElement('circle', { cx: size / 2, cy: size / 2, r, fill: 'none', stroke: colorOff, strokeWidth: stroke }),
    React.createElement('circle', {
      cx: size / 2, cy: size / 2, r, fill: 'none', stroke: colorOn, strokeWidth: stroke, strokeLinecap: 'round',
      strokeDasharray: c, strokeDashoffset: c * (1 - Math.max(0, Math.min(100, pct)) / 100),
      transform: 'rotate(-90 ' + size / 2 + ' ' + size / 2 + ')',
    })
  );
}

/* Matches PlayerPill's default: the bar and this screen show the same track, so
   they must agree on how long it is. A track may carry its own `seconds`. */
function clock(pct, seconds) {
  const total = seconds || 220;
  const s = Math.round((Math.max(0, Math.min(100, pct)) / 100) * total);
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

function bar({ value, onSeek, label, accent = true, height = 6 }) {
  const seek = (e) => {
    if (!onSeek) return;
    const b = e.currentTarget.getBoundingClientRect();
    onSeek(Math.max(0, Math.min(100, ((e.clientX - b.left) / b.width) * 100)));
  };
  return React.createElement('div', {
    role: 'slider', tabIndex: 0,
    'aria-label': label, 'aria-valuenow': Math.round(value), 'aria-valuemin': 0, 'aria-valuemax': 100,
    onPointerDown: (e) => { e.currentTarget.setPointerCapture(e.pointerId); seek(e); },
    onPointerMove: (e) => { if (e.buttons === 1) seek(e); },
    onKeyDown: (e) => {
      if (!onSeek) return;
      if (e.key === 'ArrowRight') onSeek(Math.min(100, value + 5));
      if (e.key === 'ArrowLeft') onSeek(Math.max(0, value - 5));
    },
    style: {
      flex: 1, height, borderRadius: 9999, background: 'rgba(238,241,246,.1)',
      cursor: onSeek ? 'pointer' : 'default', overflow: 'hidden', touchAction: 'none',
    },
  }, React.createElement('div', {
    style: {
      height: '100%', width: Math.max(0, Math.min(100, value)) + '%',
      borderRadius: 9999, background: accent ? _FP.acc : _FP.ink2,
    },
  }));
}

export function FullPlayer({
  open = false, track, playing = false, progress = 0, volume = 70,
  hyped = false, hypeLocked = false, hypeLabel, faved = false,
  queue = [], history = [], safeTop = 0, safeBottom = 0,
  onClose, onTogglePlay, onPrev, onNext, onSeek, onVolume,
  onToggleHype, onToggleFav, onPickTrack, onOpenArtist, onOpenAlbum,
}) {
  if (!open || !track) return null;

  const round = (glyph, label, onClick, size, tone) => React.createElement('button', {
    type: 'button', onClick, 'aria-label': label,
    style: {
      width: size, height: size, flex: '0 0 auto', padding: 0, borderRadius: 9999,
      background: 'rgba(238,241,246,.06)', border: '1px solid ' + _FP.line,
      color: tone || _FP.ink, display: 'grid', placeItems: 'center',
      fontSize: Math.round(size * 0.42), cursor: 'pointer',
    },
  }, React.createElement('span', { 'aria-hidden': 'true' }, glyph));

  return React.createElement('div', {
    role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Now playing',
    style: {
      position: 'fixed', inset: 0, zIndex: 900, background: _FP.base,
      display: 'flex', flexDirection: 'column',
      paddingTop: safeTop, paddingBottom: safeBottom,
      fontFamily: _FP.fb, color: _FP.ink, overflow: 'hidden',
    },
  },
    React.createElement('div', {
      style: { flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '18px 20px 8px' },
    },
      React.createElement('div', {
        style: { fontFamily: _FP.fm, fontSize: 9.5, letterSpacing: '.2em', textTransform: 'uppercase', color: _FP.ink3, textAlign: 'center' },
      }, playing ? 'Now playing' : 'Paused'),

      /* The artwork at the size the phone can actually give it. Square, capped
         so the controls below never get pushed off a short screen. */
      React.createElement('div', {
        style: {
          width: 'min(72vw, 300px)', aspectRatio: '1', margin: '18px auto 0',
          borderRadius: 26, background: _FP.raised, border: '1px solid ' + _FP.line,
          display: 'grid', placeItems: 'center',
          fontFamily: _FP.fd, fontWeight: 800, fontSize: 96, letterSpacing: '-.04em',
          color: _FP.ink, boxShadow: '0 24px 60px rgba(4,8,18,.55)',
        },
      }, track.initial),

      React.createElement('div', { style: { textAlign: 'center', marginTop: 22 } },
        React.createElement('div', {
          style: { fontFamily: _FP.fd, fontWeight: 800, fontSize: 26, letterSpacing: '-.03em', lineHeight: 1.15 },
        }, track.title),
        React.createElement('div', {
          style: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 7, marginTop: 7, fontSize: 14, color: _FP.ink2 },
        },
          React.createElement('button', {
            type: 'button', onClick: () => onOpenArtist && onOpenArtist(track),
            style: {
              background: 'transparent', border: 0, padding: 0, cursor: 'pointer', font: 'inherit',
              color: _FP.ink2, textDecoration: 'underline', textDecorationColor: 'rgba(150,161,181,.4)', textUnderlineOffset: 3,
            },
          }, track.artist),
          track.album ? React.createElement('span', { 'aria-hidden': 'true', style: { color: _FP.ink3 } }, '·') : null,
          track.album ? React.createElement('button', {
            type: 'button', onClick: () => onOpenAlbum && onOpenAlbum(track),
            style: {
              background: 'transparent', border: 0, padding: 0, cursor: 'pointer', font: 'inherit',
              color: _FP.ink2, textDecoration: 'underline', textDecorationColor: 'rgba(150,161,181,.4)', textUnderlineOffset: 3,
            },
          }, track.album) : null
        )
      ),

      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 11, marginTop: 22 } },
        React.createElement('span', { style: { fontFamily: _FP.fm, fontSize: 10.5, color: _FP.ink3, minWidth: 34 } }, clock(progress, track.seconds)),
        bar({ value: progress, onSeek, label: 'Seek' }),
        React.createElement('span', { style: { fontFamily: _FP.fm, fontSize: 10.5, color: _FP.ink3, minWidth: 34, textAlign: 'right' } }, clock(100, track.seconds))
      ),

      React.createElement('div', {
        style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 22, marginTop: 20 },
      },
        round('\u2039', 'Previous track', onPrev, 52),
        React.createElement('button', {
          type: 'button', onClick: onTogglePlay,
          'aria-label': playing ? 'Pause' : 'Play',
          style: {
            position: 'relative', width: 78, height: 78, flex: '0 0 auto', padding: 0,
            borderRadius: 9999, background: _FP.acc, border: 0, color: '#fff',
            display: 'grid', placeItems: 'center', cursor: 'pointer',
            fontSize: 24, paddingLeft: playing ? 0 : 5,
            boxShadow: '0 0 32px rgba(255,80,41,.4)',
          },
        },
          ring(78, 3, progress, 'rgba(255,255,255,.9)', 'rgba(255,255,255,.22)'),
          React.createElement('span', { 'aria-hidden': 'true' }, playing ? '\u275a\u275a' : '\u25b6')
        ),
        round('\u203a', 'Next track', onNext, 52)
      ),

      React.createElement('div', {
        style: { display: 'flex', alignItems: 'center', gap: 12, marginTop: 22 },
      },
        React.createElement('button', {
          type: 'button', onClick: hypeLocked ? undefined : onToggleHype, disabled: hypeLocked,
          'aria-label': hypeLocked
            ? 'Already hyped ' + track.artist + '. ' + (hypeLabel || '') + ' until you can hype again'
            : 'Hype ' + track.artist,
          'aria-pressed': hyped,
          style: {
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            height: 52, borderRadius: 9999, cursor: hypeLocked ? 'default' : 'pointer',
            background: hypeLocked ? 'rgba(255,80,41,.08)' : (hyped ? _FP.acc : 'rgba(255,80,41,.14)'),
            border: '1px solid ' + (hypeLocked ? 'rgba(255,80,41,.28)' : (hyped ? _FP.acc : 'rgba(255,80,41,.45)')),
            color: hypeLocked ? 'rgba(255,80,41,.6)' : (hyped ? '#0b1220' : _FP.acc),
          },
        },
          React.createElement('span', {
            style: { fontFamily: _FP.fd, fontWeight: 800, fontSize: 16, letterSpacing: '.06em' },
          }, 'HYPE'),
          hypeLocked && hypeLabel ? React.createElement('span', {
            style: { fontFamily: _FP.fm, fontWeight: 500, fontSize: 11.5, opacity: .85 },
          }, hypeLabel) : null
        ),
        round(faved ? '\u2665' : '\u2661', faved ? 'Remove from your library' : 'Save to your library', onToggleFav, 52, faved ? _FP.acc : _FP.ink)
      ),

      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 11, marginTop: 18 } },
        React.createElement('span', { 'aria-hidden': 'true', style: { fontFamily: _FP.fm, fontSize: 12, color: _FP.ink3 } }, '\u266b'),
        bar({ value: volume, onSeek: onVolume, label: 'Volume', accent: false, height: 4 }),
        React.createElement('span', { style: { fontFamily: _FP.fm, fontSize: 10.5, color: _FP.ink3, minWidth: 30, textAlign: 'right' } }, Math.round(volume) + '%')
      ),

      queue.length ? React.createElement('div', { style: { marginTop: 26 } },
        React.createElement('div', {
          style: { fontFamily: _FP.fm, fontSize: 9.5, letterSpacing: '.18em', textTransform: 'uppercase', color: _FP.ink3, marginBottom: 8 },
        }, 'Up next'),
        queue.map((t, i) => React.createElement('button', {
          key: 'q' + i, type: 'button', onClick: () => onPickTrack && onPickTrack(t, 'queue', i),
          style: {
            display: 'flex', width: '100%', alignItems: 'center', gap: 12, padding: '11px 0',
            background: 'transparent', border: 0, borderTop: i ? '1px solid ' + _FP.hair : 0,
            textAlign: 'left', cursor: 'pointer',
          },
        },
          React.createElement('span', { style: { fontFamily: _FP.fm, fontSize: 11, color: _FP.ink3, width: 20, flex: '0 0 auto' } }, String(i + 1).padStart(2, '0')),
          React.createElement('span', { style: { flex: 1, minWidth: 0, fontSize: 14, color: _FP.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, t.title),
          React.createElement('span', { style: { fontSize: 12.5, color: _FP.ink2, flex: '0 0 auto' } }, t.artist)
        ))
      ) : null,

      history.length ? React.createElement('div', { style: { marginTop: 22, borderTop: '1px solid ' + _FP.line, paddingTop: 14 } },
        React.createElement('div', {
          style: { fontFamily: _FP.fm, fontSize: 9.5, letterSpacing: '.18em', textTransform: 'uppercase', color: _FP.ink3, marginBottom: 8 },
        }, 'Played'),
        history.map((t, i) => React.createElement('button', {
          key: 'h' + i, type: 'button', onClick: () => onPickTrack && onPickTrack(t, 'history', i),
          style: {
            display: 'flex', width: '100%', alignItems: 'center', gap: 12, padding: '10px 0',
            background: 'transparent', border: 0, textAlign: 'left', cursor: 'pointer', opacity: .55,
          },
        },
          React.createElement('span', { style: { fontFamily: _FP.fm, fontSize: 11, color: _FP.ink3, width: 20, flex: '0 0 auto' } }, '\u00b7'),
          React.createElement('span', { style: { flex: 1, minWidth: 0, fontSize: 14, color: _FP.ink2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, t.title),
          React.createElement('span', { style: { fontSize: 12.5, color: _FP.ink3, flex: '0 0 auto' } }, t.artist)
        ))
      ) : null,

      React.createElement('div', { style: { height: 96 } })
    ),

    /* The way out, in the corner the way out always lives in. Same square, same
       place as the shell's trigger — on this screen it means back. */
    React.createElement('div', {
      style: {
        position: 'absolute', left: 18, bottom: 18 + safeBottom,
        display: 'flex', alignItems: 'center', gap: 13,
      },
    },
      React.createElement('button', {
        type: 'button', onClick: onClose, 'aria-label': 'Back to iHYPE',
        style: {
          width: 62, height: 62, flex: '0 0 auto', padding: 0,
          borderRadius: 21, background: _FP.acc, border: 0, color: '#fff',
          display: 'grid', placeItems: 'center', cursor: 'pointer',
          boxShadow: '0 0 30px rgba(255,80,41,.38)',
        },
      }, React.createElement('span', {
        style: { display: 'flex', alignItems: 'center', fontFamily: _FP.fd, fontWeight: 800, fontSize: 15, letterSpacing: '.01em', lineHeight: 1 },
      },
        'iH',
        React.createElement('svg', {
          'aria-hidden': 'true', viewBox: '148 92 200 328', width: 11, height: 18,
          style: { display: 'block', margin: '0 .06em' },
        }, React.createElement('path', { d: 'M280 96L152 288h96l-16 128 144-192h-96l16-128z', fill: 'currentColor' })),
        'PE'
      )),
      React.createElement('span', {
        style: { fontFamily: _FP.fm, fontSize: 9.5, letterSpacing: '.18em', textTransform: 'uppercase', color: _FP.ink3 },
      }, 'Back')
    )
  );
}
