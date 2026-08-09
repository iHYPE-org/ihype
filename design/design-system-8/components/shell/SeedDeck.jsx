const _SD = {
  surf: '#121b2e', raised: '#18233a', ink: '#eef1f6', ink2: '#96a1b5', ink3: '#8792a6',
  acc: '#ff5029', line: 'rgba(238,241,246,.13)', hair: 'rgba(238,241,246,.07)',
  fd: "'Bricolage Grotesque',sans-serif", fb: "'Work Sans',system-ui,sans-serif",
  fm: "'JetBrains Mono',monospace",
};

/**
 * The seed deck — Discover itself, not a section of it.
 *
 * One card at a time: the artist's own graphic with their name, the release and
 * the track over it, and a clip of 15–30 seconds playing underneath. Swipe left
 * to skip, right to add to the Discover playlist, HYPE beneath. The deck is the
 * whole surface because the decision is binary and the queue is infinite —
 * a grid of six would ask you to compare when the product only wants a verdict.
 *
 * The card follows the pointer while you drag, and the verdict is committed the
 * moment you release — synchronously, never through an animation callback. This
 * shell runs in contexts where no animation frame ever fires and the document
 * timeline does not advance, so anything whose OUTCOME waits on a frame simply
 * never happens. The clip ring runs on setInterval for the same reason.
 */

export function SeedDeck({
  items = [], index = 0, hyped = false, savedCount = 0, clipSeconds = 22,
  hypeLocked = false, hypeLabel, maxHeight, reduceMotion = false,
  onSkip, onSave, onHype, onOpenArtist, onTogglePlay, playing = true,
}) {
  const [dx, setDx] = React.useState(0);
  const [dy, setDy] = React.useState(0);
  const [clip, setClip] = React.useState(0);
  const drag = React.useRef(null);
  const timer = React.useRef(0);
  const rootRef = React.useRef(null);
  const [room, setRoom] = React.useState(null);

  /* The deck measures the space it actually has rather than being told. The
     shell's estimate was a guess at the header's height ("viewport − 330 −
     142"), and the header has since grown a pinned two-line headline and a
     three-line dek, so the guess ran 73px short and the controls landed on top
     of the player. Reading its own top against the chrome the shell publishes
     cannot drift, whatever the copy above it does. */
  React.useLayoutEffect(() => {
    const measure = () => {
      if (!rootRef.current) return;
      const top = rootRef.current.getBoundingClientRect().top;
      const cs = getComputedStyle(document.documentElement);
      const px = (v) => parseFloat(cs.getPropertyValue(v)) || 0;
      const reserved = px('--chrome-b') + px('--chrome-s') + 20;
      setRoom(Math.max(0, window.innerHeight - top - reserved));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  });

  /* The clip meter. `setInterval`, not rAF: this runtime never fires animation
     frames, so a rAF loop leaves the ring frozen at its initial value on every
     card. performance.now() deltas still give real elapsed time. */
  React.useEffect(() => {
    setClip(0);
    let last = performance.now();
    let v = 0;
    const id = setInterval(() => {
      const now = performance.now();
      const d = (now - last) / 1000; last = now;
      if (playing) { v = (v + d / clipSeconds) % 1; setClip(v); }
    }, 100);
    return () => clearInterval(id);
  }, [index, playing, clipSeconds]);

  React.useEffect(() => () => clearInterval(timer.current), []);

  /* Commit synchronously. The outcome must never ride on a frame arriving:
     this runtime fires no animation frames, so routing the verdict through a
     tween's completion callback meant skip and save silently did nothing, and
     the `flying` guard — set up front, cleared only in that dead callback —
     froze the deck permanently after the first tap. The card leaves and the next
     one arrives in the same tick, which is also what a fast swiper wants. */
  const fling = (dir) => {
    setDx(0); setDy(0);
    clearInterval(timer.current);
    if (dir > 0) onSave && onSave(items[index]);
    else onSkip && onSkip(items[index]);
  };

  const settle = () => {
    clearInterval(timer.current);
    setDx(0); setDy(0);
  };

  const down = (e) => {
    drag.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e) => {
    if (!drag.current) return;
    setDx(e.clientX - drag.current.x);
    setDy((e.clientY - drag.current.y) * 0.35);
  };
  const up = () => {
    if (!drag.current) return;
    drag.current = null;
    if (Math.abs(dx) > 108) fling(dx > 0 ? 1 : -1);
    else settle();
  };

  const item = items[index];
  if (!item) {
    return React.createElement('div', {
      style: { textAlign: 'center', padding: '80px 20px', color: _SD.ink2, fontFamily: _SD.fb },
    },
      React.createElement('div', { style: { fontFamily: _SD.fd, fontWeight: 800, fontSize: 24, color: _SD.ink, letterSpacing: '-.03em' } }, 'Deck empty'),
      React.createElement('div', { style: { fontSize: 13.5, marginTop: 6 } }, 'New seeds arrive as artists upload and as you move.')
    );
  }

  /* The deck is measured against the space it is given, not drawn at a fixed
     size and hoped to fit. CHROME is the deck's own furniture below the card,
     counted from the real boxes: 4 top padding, 34 of behind-card peeking below
     the top card, one 18 gap, and the 56 control row. No lower floor — a floor
     larger than the room is how the deck came to render 440px inside a 380px
     slot, overlapping the player bar and the home indicator. If the room is
     tight the card gets smaller, which is the correct failure. */
  const CARD_W = 328;
  const CHROME = 4 + 34 + 18 + 56;
  /* The card's own content — clip ring, pause, artist, song, release, why —
     measures ~172px. Below that the card is not small, it is empty: everything
     inside is clipped and Discover renders as a gradient sliver. So the floor is
     the content height, not a taste figure, and when the room is under it the
     PANE scrolls (it is already a scroll container) rather than the card lying
     about how much it can show.

     `room != null`, not truthiness: a measured 0 is a real answer and must not
     fall through to the shell's estimate — that fallback overriding the
     measurement is the same bug in a different coat. */
  const avail = room != null ? room : (maxHeight || 0);
  const CARD_H = avail ? Math.max(200, Math.min(436, avail - CHROME)) : 436;
  const rot = Math.max(-14, Math.min(14, dx / 14));
  const intent = Math.min(1, Math.abs(dx) / 108);

  /* Two cards behind, nudged and dimmed, so the deck reads as a deck. They lift
     toward their final resting place as the top card leaves. */
  const behind = (offset) => {
    const it = items[index + offset];
    if (!it) return null;
    const k = offset - intent * 0.55;
    return React.createElement('div', {
      key: 'b' + (index + offset),
      'aria-hidden': 'true',
      style: {
        position: 'absolute', left: 0, right: 0, top: 0,
        height: CARD_H, borderRadius: 26, overflow: 'hidden',
        background: _SD.surf, border: '1px solid ' + _SD.line,
        transform: 'translateY(' + k * 16 + 'px) scale(' + (1 - k * 0.045) + ')',
        opacity: 1 - k * 0.28,
        boxShadow: '0 18px 44px rgba(4,8,18,.45)',
      },
    }, React.createElement('div', {
      style: { position: 'absolute', inset: 0, background: 'linear-gradient(150deg,' + it.c1 + ',' + it.c2 + ')', opacity: .5 },
    }));
  };

  const label = (text, side, color) => React.createElement('div', {
    'aria-hidden': 'true',
    style: {
      position: 'absolute', top: 22, [side]: 22,
      fontFamily: _SD.fm, fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase',
      color: '#fff', background: color, borderRadius: 9999, padding: '8px 14px',
      opacity: (side === 'left' ? dx > 0 : dx < 0) ? intent : 0,
      transform: 'rotate(' + (side === 'left' ? -8 : 8) + 'deg)',
    },
  }, text);

  const circ = 2 * Math.PI * 15;

  return React.createElement('div', {
    ref: rootRef,
    style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, fontFamily: _SD.fb, paddingTop: 4 },
  },
    React.createElement('div', { style: { position: 'relative', width: CARD_W, height: CARD_H + 34 } },
      behind(2), behind(1),
      React.createElement('div', {
        onPointerDown: down, onPointerMove: move, onPointerUp: up, onPointerCancel: up,
        style: {
          position: 'absolute', left: 0, top: 0, width: CARD_W, height: CARD_H,
          borderRadius: 26, overflow: 'hidden', background: _SD.surf,
          border: '1px solid ' + _SD.line, boxShadow: '0 26px 60px rgba(4,8,18,.6)',
          transform: 'translate(' + dx + 'px,' + dy + 'px) rotate(' + rot + 'deg)',
          cursor: 'grab', touchAction: 'none', userSelect: 'none',
        },
      },
        /* The artist's own graphic goes here. Until one is uploaded the card
           falls back to the artist's palette — never a stock image. */
        React.createElement('div', {
          'aria-hidden': 'true',
          style: {
            position: 'absolute', inset: 0,
            background: 'linear-gradient(150deg,' + item.c1 + ' 0%,' + item.c2 + ' 100%)',
          },
        },
          React.createElement('div', {
            style: {
              position: 'absolute', right: -46, bottom: -70,
              fontFamily: _SD.fd, fontWeight: 800, fontSize: 300, lineHeight: .8,
              color: 'rgba(255,255,255,.13)', letterSpacing: '-.06em',
            },
          }, item.initial)
        ),
        React.createElement('div', {
          'aria-hidden': 'true',
          style: { position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(6,10,20,.42) 0%,rgba(6,10,20,0) 34%,rgba(6,10,20,.86) 100%)' },
        }),

        /* Clip meter, top-left: a ring that fills over the length of the clip,
           with the length stated so 22 seconds is never mistaken for the track. */
        React.createElement('div', {
          style: { position: 'absolute', top: 18, left: 18, display: 'flex', alignItems: 'center', gap: 9 },
        },
          React.createElement('svg', { width: 34, height: 34, viewBox: '0 0 34 34', 'aria-hidden': 'true' },
            React.createElement('circle', { cx: 17, cy: 17, r: 15, fill: 'rgba(6,10,20,.45)', stroke: 'rgba(255,255,255,.28)', strokeWidth: 2 }),
            React.createElement('circle', {
              cx: 17, cy: 17, r: 15, fill: 'none', stroke: '#fff', strokeWidth: 2, strokeLinecap: 'round',
              strokeDasharray: circ, strokeDashoffset: circ * (1 - clip), transform: 'rotate(-90 17 17)',
            })
          ),
          React.createElement('span', {
            style: { fontFamily: _SD.fm, fontSize: 9.5, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,.82)' },
          }, Math.round(clipSeconds) + 's clip')
        ),

        /* Pause the clip without leaving the card. It sits opposite the meter,
           the only control in the artwork's top band, and stops the pointer
           reaching the drag handler underneath it. */
        React.createElement('button', {
          type: 'button',
          onPointerDown: (e) => e.stopPropagation(),
          onClick: (e) => { e.stopPropagation(); onTogglePlay && onTogglePlay(); },
          'aria-label': playing ? 'Pause the clip' : 'Play the clip',
          style: {
            position: 'absolute', top: 18, right: 18,
            width: 38, height: 38, borderRadius: 9999, cursor: 'pointer', padding: 0,
            background: 'rgba(6,10,20,.5)', border: '1px solid rgba(255,255,255,.28)',
            color: '#fff', display: 'grid', placeItems: 'center',
            fontSize: playing ? 11 : 12, lineHeight: 1,
            paddingLeft: playing ? 0 : 3,
          },
        }, React.createElement('span', { 'aria-hidden': 'true' }, playing ? '❚❚' : '▶')),

        label('Save', 'left', _SD.acc),
        label('Skip', 'right', 'rgba(10,16,30,.86)'),

        React.createElement('div', { style: { position: 'absolute', left: 22, right: 22, bottom: 22 } },
          React.createElement('button', {
            type: 'button',
            onClick: (e) => { e.stopPropagation(); onOpenArtist && onOpenArtist(item); },
            style: {
              display: 'block', background: 'transparent', border: 0, padding: 0, textAlign: 'left', cursor: 'pointer',
              fontFamily: _SD.fd, fontWeight: 800, fontSize: 30, letterSpacing: '-.03em', color: '#fff', lineHeight: 1.05,
            },
          }, item.artist),
          React.createElement('div', {
            style: { fontFamily: _SD.fd, fontWeight: 600, fontSize: 17, letterSpacing: '-.015em', color: 'rgba(255,255,255,.94)', marginTop: 7 },
          }, item.song),
          React.createElement('div', {
            style: { fontSize: 13, color: 'rgba(255,255,255,.72)', marginTop: 2 },
          }, item.album),
          React.createElement('div', {
            style: { fontFamily: _SD.fm, fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,.6)', marginTop: 11 },
          }, item.why)
        )
      )
    ),

    React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 16 } },
      React.createElement('button', {
        type: 'button', onClick: () => fling(-1), 'aria-label': 'Skip ' + item.artist,
        style: {
          width: 56, height: 56, borderRadius: 9999, cursor: 'pointer',
          background: 'transparent', border: '1px solid var(--line-2,rgba(238,241,246,.13))',
          color: 'var(--ink-2,#96a1b5)', fontSize: 21, display: 'grid', placeItems: 'center',
        },
      }, React.createElement('span', { 'aria-hidden': 'true' }, '\u2715')),

      React.createElement('button', {
        type: 'button', onClick: hypeLocked ? undefined : () => onHype && onHype(item),
        disabled: hypeLocked, 'aria-pressed': hyped,
        'aria-label': hypeLocked
          ? 'Already hyped ' + item.artist + '. ' + (hypeLabel || '') + ' until you can hype again'
          : 'Hype ' + item.artist,
        style: {
          display: 'flex', alignItems: 'center', gap: 9, height: 56, padding: '0 30px',
          borderRadius: 9999, cursor: hypeLocked ? 'default' : 'pointer',
          background: hypeLocked ? 'rgba(255,80,41,.08)' : (hyped ? _SD.acc : 'rgba(255,80,41,.14)'),
          border: '1px solid ' + (hypeLocked ? 'rgba(255,80,41,.28)' : (hyped ? _SD.acc : 'rgba(255,80,41,.45)')),
          color: hypeLocked ? 'rgba(255,80,41,.6)' : (hyped ? '#0b1220' : _SD.acc),
          fontFamily: _SD.fd, fontWeight: 800, letterSpacing: '.02em',
        },
      },
        React.createElement('span', {
          style: { fontFamily: _SD.fd, fontWeight: 800, fontSize: 17, letterSpacing: '.06em' },
        }, 'HYPE'),
        hypeLocked && hypeLabel ? React.createElement('span', {
          style: { fontFamily: _SD.fm, fontWeight: 500, fontSize: 11, letterSpacing: '.04em', opacity: .85 },
        }, hypeLabel) : null
      ),

      React.createElement('button', {
        type: 'button', onClick: () => fling(1), 'aria-label': 'Add ' + item.song + ' to your Discover playlist',
        style: {
          width: 56, height: 56, borderRadius: 9999, cursor: 'pointer',
          background: 'transparent', border: '1px solid var(--line-2,rgba(238,241,246,.13))',
          color: 'var(--ink-2,#96a1b5)', fontSize: 27, display: 'grid', placeItems: 'center',
        },
      }, React.createElement('span', { 'aria-hidden': 'true' }, '\u2661'))
    )
  );
}
