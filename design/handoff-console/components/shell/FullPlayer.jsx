'use client';
import React from 'react';

/* Re-anchored to design tokens, 2026-08-22. Prop signature UNCHANGED so
   _adherence.oxlintrc.json stays valid — this is strictly internal.
   Kept as React.createElement for the same reason as PlayerPill and SeedDeck.

   Worst file in the library on the audit: 51 violations. What changed:

   BUG FIXED: the play button rendered '#fff8ef' on an --accent gradient —
   effectively white on #ff5029, the forbidden pairing. It is the single most
   important control on the screen. Fourth instance after MapSheet, PlayerPill
   and SeedDeck.

   BUG FIXED: the artist and album underlines used 'rgba(150,161,181,.4)' — a
   cool grey-BLUE from the retired navy direction, sitting on warm walnut. Now
   var(--rule-on-walnut).

   Also fixed:
   · the album plate hand-rolled the brass ring and inset shadow. It now wears
     the design system's own .walnut-plate class from tokens/console.css, which
     is what that class exists for — the gradient stays as the art fill.
   · surfaces #34200f / #4a2b16 / #1a1206 / #5a3a1e / #2c1a0c → walnut tokens
   · '#c9a54e' and '#8a6a2c' literals → var(--brass) / var(--brass-deep)
   · ink #f6ecd9 / #d8c6a6 / #bda882 → the on-walnut set
   · SEVEN font sizes below the floor (9.5 ×4, 10.5 ×3, 11, 11.5, 12, 12.5) →
     var(--text-xs) for mono metadata, var(--text-base) for copy
   · 14/15/16/24/26/96 → the token scale
   · borderRadius 9999 → var(--radius-pill); plate 2 → var(--radius-panel)
   · hyped label '#1c1408' and the close square's ink → var(--ink-on-accent)
   · accent alphas → color-mix on var(--accent)

   The final-value rendering (no keyframes, no timeline-dependent transitions)
   and the in-flow close button are UNTOUCHED — both are ADHERENCE 23 fixes. */

const _FP = {
  base: 'var(--walnut-2)',
  surf: 'var(--walnut)',
  raised: 'var(--walnut)',
  ink: 'var(--ink-on-walnut)',
  ink2: 'var(--ink-on-walnut-2)',
  ink3: 'var(--ink-on-walnut-3)',
  acc: 'var(--accent)',
  onAcc: 'var(--ink-on-accent)',
  line: 'var(--rule-on-walnut)',
  hair: 'var(--rule-on-walnut-2)',
  fd: 'var(--font-display)',
  fb: 'var(--font-body)',
  fm: 'var(--font-mono)',
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
      flex: 1, height, borderRadius: 'var(--radius-pill)', background: _FP.line,
      cursor: onSeek ? 'pointer' : 'default', overflow: 'hidden', touchAction: 'none',
    },
  }, React.createElement('div', {
    style: {
      height: '100%', width: Math.max(0, Math.min(100, value)) + '%',
      borderRadius: 'var(--radius-pill)', background: accent ? _FP.acc : _FP.ink2,
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
      width: size, height: size, flex: '0 0 auto', padding: 0, borderRadius: 'var(--radius-pill)',
      background: 'linear-gradient(180deg, var(--walnut), var(--walnut-3))',
      border: '2px solid ' + (tone || 'var(--brass-deep)'),
      boxShadow: 'inset 0 1px 0 rgba(255,214,160,.2), inset 0 -2px 4px rgba(0,0,0,.5)',
      color: _FP.ink, display: 'grid', placeItems: 'center',
      fontSize: 'var(--text-lg)', cursor: 'pointer',
    },
  }, React.createElement('span', { 'aria-hidden': 'true' }, glyph));

  /* Artist and release are separate destinations, so separate targets. */
  const nameLink = (text, onClick) => React.createElement('button', {
    type: 'button', onClick,
    style: {
      background: 'transparent', border: 0, padding: 0, cursor: 'pointer', font: 'inherit',
      color: _FP.ink2, textDecoration: 'underline',
      textDecorationColor: 'var(--rule-on-walnut)', textUnderlineOffset: 3,
    },
  }, text);

  return React.createElement('div', {
    role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Now playing',
    style: {
      position: 'fixed', inset: 0, zIndex: 900,
      background: 'linear-gradient(180deg, var(--walnut) 0%, var(--walnut-2) 45%, var(--walnut-3) 100%)',
      display: 'flex', flexDirection: 'column',
      paddingTop: safeTop, paddingBottom: safeBottom,
      fontFamily: _FP.fb, color: _FP.ink, overflow: 'hidden',
    },
  },
    React.createElement('div', {
      style: { flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: 'var(--space-5) var(--space-5) var(--space-1)' },
    },
      React.createElement('div', {
        style: { fontFamily: _FP.fm, fontSize: 'var(--text-xs)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: _FP.ink3, textAlign: 'center' },
      }, playing ? 'Now playing' : 'Paused'),

      /* The artwork at the size the phone can actually give it. Square, capped
         against viewport HEIGHT as well as width — at a short height the square
         used to push the transport and the HYPE row past the bottom of a fixed,
         non-scrolling overlay.

         The brass ring and inset shadow come from .walnut-plate, the design
         system's own class, rather than being restated here. */
      React.createElement('div', {
        className: 'walnut-plate',
        style: {
          width: 'min(72vw, 300px, 38vh)', aspectRatio: '1', margin: 'var(--space-5) auto 0',
          background: 'linear-gradient(160deg, #ff8a52, #c9401c 60%, #7a2412)',
          display: 'grid', placeItems: 'center',
          fontFamily: _FP.fd, fontWeight: 400, fontSize: 'var(--text-3xl)', letterSpacing: 'var(--tracking-normal)',
          color: 'var(--ink-on-media)',
        },
      }, track.initial),

      React.createElement('div', { style: { textAlign: 'center', marginTop: 'var(--space-5)' } },
        React.createElement('div', {
          style: { fontFamily: _FP.fd, fontWeight: 400, fontSize: 'var(--text-xl)', letterSpacing: 'var(--tracking-normal)', lineHeight: 'var(--leading-heading)' },
        }, track.title),
        React.createElement('div', {
          style: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 'var(--space-1)', marginTop: 'var(--space-1)', fontSize: 'var(--text-base)', color: _FP.ink2 },
        },
          nameLink(track.artist, () => onOpenArtist && onOpenArtist(track)),
          track.album ? React.createElement('span', { 'aria-hidden': 'true', style: { color: _FP.ink3 } }, '\u00b7') : null,
          track.album ? nameLink(track.album, () => onOpenAlbum && onOpenAlbum(track)) : null
        )
      ),

      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginTop: 'var(--space-5)' } },
        React.createElement('span', { style: { fontFamily: _FP.fm, fontSize: 'var(--text-xs)', color: _FP.ink3, minWidth: 34 } }, clock(progress, track.seconds)),
        bar({ value: progress, onSeek, label: 'Seek' }),
        React.createElement('span', { style: { fontFamily: _FP.fm, fontSize: 'var(--text-xs)', color: _FP.ink3, minWidth: 34, textAlign: 'right' } }, clock(100, track.seconds))
      ),

      React.createElement('div', {
        style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-5)', marginTop: 'var(--space-5)' },
      },
        round('\u2039', 'Previous track', onPrev, 52),
        React.createElement('button', {
          type: 'button', onClick: onTogglePlay,
          'aria-label': playing ? 'Pause' : 'Play',
          style: {
            position: 'relative', width: 78, height: 78, flex: '0 0 auto', padding: 0,
            borderRadius: 'var(--radius-pill)',
            background: 'radial-gradient(circle at 35% 30%, #ff8a5c, var(--accent) 55%, #c9401c 100%)',
            border: '2px solid var(--brass)', color: _FP.onAcc,
            display: 'grid', placeItems: 'center', cursor: 'pointer',
            fontSize: 'var(--text-lg)', paddingLeft: playing ? 0 : 5,
            boxShadow: 'var(--shadow-play)',
          },
        },
          ring(78, 3, progress,
            'color-mix(in oklab, var(--ink-on-accent) 90%, transparent)',
            'color-mix(in oklab, var(--ink-on-accent) 22%, transparent)'),
          React.createElement('span', { 'aria-hidden': 'true' }, playing ? '\u275a\u275a' : '\u25b6')
        ),
        round('\u203a', 'Next track', onNext, 52)
      ),

      React.createElement('div', {
        style: { display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginTop: 'var(--space-5)' },
      },
        React.createElement('button', {
          type: 'button', onClick: hypeLocked ? undefined : onToggleHype, disabled: hypeLocked,
          'aria-label': hypeLocked
            ? 'Already hyped ' + track.artist + '. ' + (hypeLabel || '') + ' until you can hype again'
            : 'Hype ' + track.artist,
          'aria-pressed': hyped,
          style: {
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)',
            height: 52, borderRadius: 'var(--radius-pill)', cursor: hypeLocked ? 'default' : 'pointer',
            background: hypeLocked
              ? 'color-mix(in oklab, var(--accent) 8%, transparent)'
              : (hyped ? _FP.acc : 'color-mix(in oklab, var(--accent) 14%, transparent)'),
            border: '1px solid ' + (hypeLocked
              ? 'color-mix(in oklab, var(--accent) 28%, transparent)'
              : (hyped ? _FP.acc : 'color-mix(in oklab, var(--accent) 45%, transparent)')),
            color: hypeLocked ? _FP.ink3 : (hyped ? _FP.onAcc : _FP.acc),
          },
        },
          React.createElement('span', {
            style: { fontFamily: _FP.fd, fontWeight: 400, fontSize: 'var(--text-base)', letterSpacing: 'var(--tracking-wide)' },
          }, 'HYPE'),
          hypeLocked && hypeLabel ? React.createElement('span', {
            style: { fontFamily: _FP.fm, fontWeight: 500, fontSize: 'var(--text-xs)', opacity: .85 },
          }, hypeLabel) : null
        ),
        round(faved ? '\u2665' : '\u2661', faved ? 'Remove from your library' : 'Save to your library', onToggleFav, 52, faved ? _FP.acc : undefined)
      ),

      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginTop: 'var(--space-5)' } },
        React.createElement('span', { 'aria-hidden': 'true', style: { fontFamily: _FP.fm, fontSize: 'var(--text-xs)', color: _FP.ink3 } }, '\u266b'),
        bar({ value: volume, onSeek: onVolume, label: 'Volume', accent: false, height: 4 }),
        React.createElement('span', { style: { fontFamily: _FP.fm, fontSize: 'var(--text-xs)', color: _FP.ink3, minWidth: 30, textAlign: 'right' } }, Math.round(volume) + '%')
      ),

      queue.length ? React.createElement('div', { style: { marginTop: 'var(--space-6)' } },
        React.createElement('div', {
          style: { fontFamily: _FP.fm, fontSize: 'var(--text-xs)', letterSpacing: 'var(--tracking-wider)', textTransform: 'uppercase', color: _FP.ink3, marginBottom: 'var(--space-2)' },
        }, 'Up next'),
        queue.map((t, i) => React.createElement('button', {
          key: 'q' + i, type: 'button', onClick: () => onPickTrack && onPickTrack(t, 'queue', i),
          style: {
            display: 'flex', width: '100%', alignItems: 'center', gap: 'var(--space-3)',
            minHeight: 44, padding: 'var(--space-3) 0',
            background: 'transparent', border: 0, borderTop: i ? '1px solid ' + _FP.hair : 0,
            textAlign: 'left', cursor: 'pointer',
          },
        },
          React.createElement('span', { style: { fontFamily: _FP.fm, fontSize: 'var(--text-xs)', color: _FP.ink3, width: 20, flex: '0 0 auto' } }, String(i + 1).padStart(2, '0')),
          React.createElement('span', { style: { flex: 1, minWidth: 0, fontSize: 'var(--text-base)', color: _FP.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, t.title),
          React.createElement('span', { style: { fontSize: 'var(--text-base)', color: _FP.ink2, flex: '0 0 auto' } }, t.artist)
        ))
      ) : null,

      history.length ? React.createElement('div', { style: { marginTop: 'var(--space-5)', borderTop: '1px solid ' + _FP.line, paddingTop: 'var(--space-4)' } },
        React.createElement('div', {
          style: { fontFamily: _FP.fm, fontSize: 'var(--text-xs)', letterSpacing: 'var(--tracking-wider)', textTransform: 'uppercase', color: _FP.ink3, marginBottom: 'var(--space-2)' },
        }, 'Played'),
        history.map((t, i) => React.createElement('button', {
          key: 'h' + i, type: 'button', onClick: () => onPickTrack && onPickTrack(t, 'history', i),
          style: {
            display: 'flex', width: '100%', alignItems: 'center', gap: 'var(--space-3)',
            minHeight: 44, padding: 'var(--space-3) 0',
            background: 'transparent', border: 0, textAlign: 'left', cursor: 'pointer', opacity: .55,
          },
        },
          React.createElement('span', { style: { fontFamily: _FP.fm, fontSize: 'var(--text-xs)', color: _FP.ink3, width: 20, flex: '0 0 auto' } }, '\u00b7'),
          React.createElement('span', { style: { flex: 1, minWidth: 0, fontSize: 'var(--text-base)', color: _FP.ink2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, t.title),
          React.createElement('span', { style: { fontSize: 'var(--text-base)', color: _FP.ink3, flex: '0 0 auto' } }, t.artist)
        ))
      ) : null,

      React.createElement('div', { style: { height: 8 } })
    ),

    /* The way out, in the corner the way out always lives in. Same square, same
       place as the shell's trigger — on this screen it means back.

       In the column's normal flow, NOT absolutely positioned over it: floating
       above a scrolling column meant whatever happened to sit in the bottom-left
       corner at rest — the HYPE button — was painted over by it. Occupying real
       space can't be slid under. */
    React.createElement('div', {
      style: {
        flex: 'none', display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
        padding: 'var(--space-3) var(--space-5) var(--space-5)',
      },
    },
      React.createElement('button', {
        type: 'button', onClick: onClose, 'aria-label': 'Back to iHYPE',
        style: {
          width: 62, height: 62, flex: '0 0 auto', padding: 0,
          borderRadius: 21, background: _FP.acc, border: 0, color: _FP.onAcc,
          display: 'grid', placeItems: 'center', cursor: 'pointer',
          boxShadow: 'var(--shadow-trigger)',
        },
      }, React.createElement('span', {
        style: { display: 'flex', alignItems: 'center', fontFamily: _FP.fd, fontWeight: 400, fontSize: 'var(--text-base)', letterSpacing: 'var(--tracking-normal)', lineHeight: 1 },
      },
        'iH',
        React.createElement('svg', {
          'aria-hidden': 'true', viewBox: '148 92 200 328', width: 11, height: 18,
          style: { display: 'block', margin: '0 .06em' },
        }, React.createElement('path', { d: 'M280 96L152 288h96l-16 128 144-192h-96l16-128z', fill: 'currentColor' })),
        'PE'
      )),
      React.createElement('span', {
        style: { fontFamily: _FP.fm, fontSize: 'var(--text-xs)', letterSpacing: 'var(--tracking-wider)', textTransform: 'uppercase', color: _FP.ink3 },
      }, 'Back')
    )
  );
}
