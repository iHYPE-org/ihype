const _PP = {
  /* Translucent, not opaque. The player sits over the map and over module
     content, and at .96 it was a solid bar cutting the frame in half. At .74
     with a blur behind it the content underneath stays legible as context
     while the pill's own text still clears contrast — the blur is what buys
     that, not the alpha. */
  surf: 'rgba(18,27,46,.74)', surfSolid: 'rgba(18,27,46,.96)', blur: 'blur(22px) saturate(1.3)',
  raised: '#18233a', ink: '#eef1f6', ink2: '#96a1b5', ink3: '#8792a6',
  acc: '#ff5029', line: 'rgba(238,241,246,.13)', hair: 'rgba(238,241,246,.07)',
  fd: "'Bricolage Grotesque',sans-serif", fb: "'Work Sans',system-ui,sans-serif",
  fm: "'JetBrains Mono',monospace",
};

/**
 * The persistent player. It docks immediately to the right of the logo trigger
 * and shares its baseline, so the two read as one piece of furniture pinned to
 * the bottom-left — `left` is passed in by the shell as trigger width + gap.
 *
 * Opening the nav dims everything including this. It fades and drops (`dimmed`)
 * rather than unmounting so the transition plays out both ways, and is made
 * non-interactive while dimmed so it cannot be reached behind the scrim.
 * The prop is `dimmed`, not `hidden` — `hidden` is a reserved HTML boolean
 * attribute and never reaches a component set from a template.
 *
 * This is presentation over shared playback state; it owns no audio element.
 * Everything it shows is passed in, and every control is a callback — which is
 * what lets the same component sit over `MediaPlayerProvider` in the product and
 * over prototype state here.
 *
 * `canHype` is resolved upstream (no linked profile, not discoverable, or your
 * own), so the heart is never a control whose every press is refused.
 */

/** The track line scrolls only when it overflows — a marquee on a short title
 *  is motion for its own sake. Duration scales with length so long and short
 *  titles travel at the same speed. */
function Marquee({ text, style, gap = 28, still = false }) {
  const wrap = React.useRef(null);
  const inner = React.useRef(null);
  const [over, setOver] = React.useState(false);
  React.useEffect(() => {
    const w = wrap.current, i = inner.current;
    if (!w || !i) return;
    /* Measure the FIRST copy, not the strip: the duplicate only exists once
       `over` is already true, so halving scrollWidth on the first pass halves a
       single copy and concludes nothing ever overflows. */
    const first = i.firstElementChild;
    const one = first ? first.scrollWidth : i.scrollWidth;
    setOver(one > w.clientWidth + 1);
  }, [text]);
  const dur = Math.max(6, (text || '').length * 0.34);
  return React.createElement('div', {
    ref: wrap,
    style: Object.assign({ overflow: 'hidden', whiteSpace: 'nowrap', maskImage: over ? 'linear-gradient(90deg,transparent,#000 12px,#000 88%,transparent)' : undefined }, style),
  }, React.createElement('div', {
    ref: inner,
    'data-ih-marquee': over ? '' : undefined,
    style: {
      display: 'inline-flex', gap,
      animation: over && !still ? 'ih-marquee ' + dur + 's linear infinite' : undefined,
      willChange: over && !still ? 'transform' : undefined,
    },
  },
    React.createElement('span', null, text),
    over ? React.createElement('span', { 'aria-hidden': 'true' }, text) : null
  ));
}

function ScrubPlay({ playing, onTogglePlay, onPrev, onNext }) {
  const from = React.useRef(null);
  const [dx, setDx] = React.useState(0);
  const THRESH = 34;
  const end = () => {
    if (from.current === null) return;
    const d = dx;
    from.current = null; setDx(0);
    if (d > THRESH) onNext && onNext();
    else if (d < -THRESH) onPrev && onPrev();
    else onTogglePlay && onTogglePlay();
  };
  const armed = Math.abs(dx) > THRESH;
  return React.createElement('button', {
    type: 'button',
    'aria-label': playing ? 'Pause. Drag right for the next track, left for the previous.'
                          : 'Play. Drag right for the next track, left for the previous.',
    onPointerDown: (e) => { from.current = e.clientX; e.currentTarget.setPointerCapture(e.pointerId); },
    onPointerMove: (e) => { if (from.current !== null) setDx(Math.max(-64, Math.min(64, e.clientX - from.current))); },
    onPointerUp: end,
    onPointerCancel: () => { from.current = null; setDx(0); },
    style: {
      width: 38, height: 38, flex: '0 0 auto', padding: 0, borderRadius: 9999,
      display: 'grid', placeItems: 'center', cursor: 'pointer', touchAction: 'none',
      background: _PP.acc, color: '#fff', border: '1px solid ' + _PP.acc,
      transform: 'translateX(' + dx * 0.5 + 'px)',
      boxShadow: armed ? '0 0 0 4px rgba(255,80,41,.28)' : 'none',
      fontSize: 13, lineHeight: 1, WebkitTapHighlightColor: 'transparent',
    },
  }, React.createElement('span', { 'aria-hidden': 'true' },
    armed ? (dx > 0 ? '\u203a\u203a' : '\u2039\u2039') : (playing ? '\u275a\u275a' : '\u25b6')));
}

function iconBtn({ label, glyph, onClick, size = 30, active, key, big, pressed, tint }) {
  return React.createElement('button', {
    key, type: 'button', onClick, 'aria-label': label,
    'aria-pressed': pressed,
    style: {
      width: size, height: size, borderRadius: 9999, flex: '0 0 auto',
      background: big ? _PP.acc : (active ? 'rgba(255,80,41,.16)' : 'rgba(238,241,246,.06)'),
      border: '1px solid ' + (big ? _PP.acc : (active ? 'rgba(255,80,41,.5)' : _PP.line)),
      color: big ? '#0b1220' : (active ? (tint || _PP.acc) : _PP.ink),
      cursor: 'pointer', fontSize: big ? 12 : 15, lineHeight: 1,
      display: 'grid', placeItems: 'center', padding: 0,
    },
  }, React.createElement('span', { 'aria-hidden': 'true' }, glyph));
}

/** A drag-free scrub/volume track: click to seek. Fill width is the datum. */
function Track({ value, onSeek, label, width, accent = true }) {
  return React.createElement('div', {
    role: 'slider', 'aria-label': label, 'aria-valuenow': Math.round(value),
    tabIndex: 0,
    onClick: (e) => {
      if (!onSeek) return;
      const r = e.currentTarget.getBoundingClientRect();
      onSeek(Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)));
    },
    style: {
      width, height: 4, borderRadius: 9999, background: _PP.hair,
      cursor: onSeek ? 'pointer' : 'default', flex: width ? '0 0 auto' : 1, overflow: 'hidden',
    },
  }, React.createElement('div', {
    style: { height: '100%', width: value + '%', borderRadius: 9999, background: accent ? _PP.acc : _PP.ink2 },
  }));
}

/* One figure for both surfaces. The bar and the full player show the same
   track, so a track that runs 3:40 in one and 3:42 in the other is a bug the
   moment anyone looks at both. A track may carry its own `seconds`; this is the
   fallback when it does not. */
const DEFAULT_SECONDS = 220;

function elapsed(pct, seconds) {
  const total = seconds || DEFAULT_SECONDS;
  const s = Math.round((Math.max(0, Math.min(100, pct)) / 100) * total);
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

export function PlayerPill({
  track, dimmed = false, playing = false, hyped = false, faved = false, compact = false,
  hypeCount, canHype = false, canTogglePlay = false, hypeLocked = false, hypeLabel,
  progress = 0, volume = 70, queue = [], history = [], queueOpen = false,
  left = 114, bottom = 26, width = 'min(760px, calc(100vw - 150px))',
  artistOpen = false, albumOpen = false, wake = 0, idleMs = 10000, anchorHeight = 88, narrow = false, reduceMotion = false,
  onExpand, onSearch,
  onToggleHype, onToggleFav, onTogglePlay, onPrev, onNext, onSeek, onVolume, onToggleQueue, onPickTrack,
  onOpenArtist, onOpenAlbum,
}) {
  /* Two models, one component.

     Desktop: the player retires ten seconds after you stop touching it, to a
     single artwork disc that keeps playing.

     Phone: it never retires. A bar that vanishes mid-glance costs more than the
     56px it saves, and the phone bar is already down to the three things worth
     showing — artwork, the two names, transport. Everything else moved into the
     full player behind the artwork rather than being crushed into the bar. */
  const [awake, setAwake] = React.useState(true);
  const [raised, setRaised] = React.useState(false);
  const rootRef = React.useRef(null);
  const first = React.useRef(true);

  const rouse = React.useCallback(() => { setAwake(true); }, []);

  React.useEffect(() => {
    if (first.current) { first.current = false; return; }
    setAwake(true); setRaised(true);
  }, [wake]);

  /* One timer, restarted whenever the pill is woken or touched. Not a CSS
     animation and not the document timeline — see ADHERENCE 23. */
  React.useEffect(() => {
    /* Anything anchored to the pill pins it open: retiring underneath an
       artist panel or a queue would leave a 340px dialog pointing at a 56px
       disc. */
    if (narrow) return undefined;
    if (!awake || dimmed || queueOpen || artistOpen || albumOpen) return undefined;
    const t = setTimeout(() => { setAwake(false); setRaised(false); }, idleMs);
    return () => clearTimeout(t);
  }, [narrow, awake, dimmed, queueOpen, artistOpen, albumOpen, idleMs, wake, track && track.title, playing, progress, volume, hyped, faved]);

  /* The raise is a state of attention, so it ends when attention moves. */
  React.useEffect(() => {
    if (!raised) return undefined;
    const away = (e) => { if (!rootRef.current || !rootRef.current.contains(e.target)) setRaised(false); };
    document.addEventListener('pointerdown', away, true);
    return () => document.removeEventListener('pointerdown', away, true);
  }, [raised]);

  if (!track) return null;
  const mini = !narrow && !awake && !dimmed;

  /* The pill and the trigger are one piece of furniture, so they are the same
     height and sit on the same baseline — `anchorHeight` is that shared figure,
     and the shell sizes the trigger from it too. The retired disc is smaller by
     design, so it centres on the trigger's mid-line instead. */
  const midline = bottom + anchorHeight / 2;
  const rise = (extra) => 'translateY(calc(50% + ' + extra + 'px))';

  const shellOuter = {
    position: 'absolute', left, bottom,
    /* The shared height is the OUTER height — the pill's border has to sit on
       the square's border, not 2px outside it. */
    boxSizing: 'border-box',
    height: compact ? undefined : anchorHeight,
    borderRadius: narrow ? 20 : undefined,
    width: compact ? 'auto' : width,
    maxWidth: compact ? undefined : 'calc(100vw - (' + left + 'px + var(--chrome-r, 26px)))',
    display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: compact ? 10 : '0 12px',
    background: _PP.surf,
    backdropFilter: _PP.blur, WebkitBackdropFilter: _PP.blur,
    /* The player wears a thin accent ring, always. A partial bar across the top
       edge read as a progress meter competing with the scrub row below it and
       drew the eye to a fragment of the frame; a continuous hairline states the
       same thing the accent always states — this is the live one — and lets the
       scrub row own progress by itself. The raised state brightens the ring
       rather than adding a second treatment. */
    border: '1px solid ' + (raised ? _PP.acc : 'rgba(255,80,41,.42)'),
    borderRadius: 9999,
    boxShadow: raised ? '0 26px 64px rgba(4,8,18,.72), 0 0 0 4px rgba(255,80,41,.14)' : '0 16px 40px rgba(4,8,18,.5), 0 0 18px rgba(255,80,41,.12)',
    fontFamily: _PP.fb,
    /* Instant. No animation on the undim — see ADHERENCE 23. */
    opacity: dimmed ? 0 : 1,
    transform: dimmed ? 'translateY(14px)' : 'none',
    pointerEvents: dimmed ? 'none' : 'auto',
  };

  /* The artwork retires the player. It is the largest, most obvious target on
     the pill and it is the one control that does not touch playback, so it is
     the right place to put "get out of my way" — and the retired disc is the
     same artwork in the same spot, which makes the trip back obvious. Going
     somewhere is the job of the names beside it, not of the picture. */
  const ART = Math.max(40, anchorHeight - 24);
  const art = React.createElement('button', {
    type: 'button',
    onClick: () => setAwake(false),
    'aria-label': 'Shrink the player',
    'aria-expanded': true,
    style: {
      width: ART, height: ART, borderRadius: Math.round(ART * 0.342), flex: '0 0 auto', padding: 0,
      overflow: 'hidden',
      background: _PP.raised, color: _PP.ink, border: '1px solid ' + _PP.line,
      display: 'grid', placeItems: 'center', cursor: 'pointer',
      fontFamily: _PP.fd, fontWeight: 800, fontSize: 24,
    },
  }, track.initial);

  /* Artist and release are separate destinations, so they are separate targets.
     One run of grey text that silently opens one of two different pages is the
     thing this replaces. */
  const nameLink = (text, onClick, on) => React.createElement('button', {
    type: 'button', onClick,
    style: {
      background: 'transparent', border: 0, padding: 0, cursor: 'pointer',
      font: 'inherit', color: on ? _PP.acc : _PP.ink2,
      textDecoration: 'underline', textDecorationColor: 'rgba(150,161,181,.4)',
      textUnderlineOffset: 3, whiteSpace: 'nowrap',
      overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%',
    },
  }, text);

  /* The retired state: the artwork alone at the size it always was, in the same
     squircle frame it wears in the full player, with the track's progress traced
     around that frame so you can still see it running. Tapping it brings the
     player back. */
  if (mini) {
    const S = anchorHeight, RAD = Math.round(S * 0.342), INSET = 2;
    return React.createElement('button', {
      ref: rootRef, type: 'button', onClick: rouse,
      'aria-label': 'Show the player — ' + track.title + ' by ' + track.artist,
      style: {
        position: 'absolute', left, bottom, transform: 'none',
        width: S, height: S, padding: 0,
        borderRadius: RAD, cursor: 'pointer',
        background: _PP.surf, backdropFilter: _PP.blur, WebkitBackdropFilter: _PP.blur,
        border: '1px solid ' + _PP.line, color: _PP.ink,
        boxShadow: '0 12px 30px rgba(4,8,18,.5)',
        display: 'grid', placeItems: 'center', fontFamily: _PP.fd, fontWeight: 800, fontSize: 18,
      },
    },
      /* `pathLength` normalises the rounded rectangle's perimeter to 100, so
         progress maps straight onto it without computing arc lengths — and it
         stays correct if the corner radius changes. */
      React.createElement('svg', {
        width: S, height: S, viewBox: '0 0 ' + S + ' ' + S, 'aria-hidden': 'true',
        style: { position: 'absolute', inset: 0, overflow: 'visible' },
      },
        React.createElement('rect', {
          x: INSET, y: INSET, width: S - INSET * 2, height: S - INSET * 2,
          rx: RAD - INSET, fill: 'none', stroke: _PP.hair, strokeWidth: 2,
        }),
        React.createElement('rect', {
          x: INSET, y: INSET, width: S - INSET * 2, height: S - INSET * 2,
          rx: RAD - INSET, fill: 'none', stroke: _PP.acc, strokeWidth: 2, strokeLinecap: 'round',
          pathLength: 100,
          strokeDasharray: 100,
          strokeDashoffset: 100 - Math.max(0, Math.min(100, progress)),
        })
      ),
      React.createElement('span', { style: { position: 'relative' } }, track.initial)
    );
  }

  return React.createElement(React.Fragment, null,
    /* The queue panel is a sibling, not a child: the pill is a pill, and
       nesting a 320px panel inside a 9999px radius clips it. */
    queueOpen && !dimmed && !compact ? React.createElement('div', {
      role: 'dialog', 'aria-label': 'Queue and history',
      style: {
        /* Clears the pill, which is two rows tall now. */
        position: 'absolute', left, bottom: bottom + anchorHeight + 14, width,
        maxHeight: 320, overflowY: 'auto',
        background: _PP.surf, backdropFilter: _PP.blur, WebkitBackdropFilter: _PP.blur,
        border: '1px solid ' + _PP.line, borderRadius: 18,
        boxShadow: '0 20px 50px rgba(4,8,18,.6)', padding: '14px 16px',
        fontFamily: _PP.fb,
      },
    },
      React.createElement('div', {
        style: { fontFamily: _PP.fm, fontSize: 9, letterSpacing: '.18em', textTransform: 'uppercase', color: _PP.ink3, marginBottom: 10 },
      }, 'Now playing'),
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 12 } },
        React.createElement('span', { style: { width: 3, height: 26, borderRadius: 9999, background: _PP.acc, flex: '0 0 auto' } }),
        React.createElement('div', { style: { minWidth: 0 } },
          React.createElement('div', { style: { fontFamily: _PP.fd, fontWeight: 600, fontSize: 14, color: _PP.ink } }, track.title),
          React.createElement('div', { style: { fontSize: 12, color: _PP.ink2 } }, track.artist + (track.album ? ' · ' + track.album : ''))
        )
      ),
      queue.length ? React.createElement('div', {
        style: { fontFamily: _PP.fm, fontSize: 9, letterSpacing: '.18em', textTransform: 'uppercase', color: _PP.ink3, margin: '4px 0 8px' },
      }, 'Up next') : null,
      queue.map((t, i) => React.createElement('button', {
        key: 'q' + i, type: 'button',
        onClick: () => onPickTrack && onPickTrack(t, 'queue', i),
        style: {
          display: 'flex', width: '100%', alignItems: 'center', gap: 10, padding: '8px 0',
          background: 'transparent', border: 0, textAlign: 'left', cursor: 'pointer',
        },
      },
        React.createElement('span', { style: { fontFamily: _PP.fm, fontSize: 11, color: _PP.ink3, width: 18, flex: '0 0 auto' } }, String(i + 1).padStart(2, '0')),
        React.createElement('span', { style: { flex: 1, minWidth: 0, fontSize: 13, color: _PP.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, t.title),
        React.createElement('span', { style: { fontSize: 12, color: _PP.ink2, flex: '0 0 auto' } }, t.artist)
      )),
      /* History sits below the line and is greyed: already played, still
         reachable. The rule is the divider the design asks for. */
      history.length ? React.createElement('div', {
        style: { borderTop: '1px solid ' + _PP.line, marginTop: 10, paddingTop: 10 },
      },
        React.createElement('div', {
          style: { fontFamily: _PP.fm, fontSize: 9, letterSpacing: '.18em', textTransform: 'uppercase', color: _PP.ink3, marginBottom: 6 },
        }, 'Played'),
        history.map((t, i) => React.createElement('button', {
          key: 'h' + i, type: 'button',
          onClick: () => onPickTrack && onPickTrack(t, 'history', i),
          style: {
            display: 'flex', width: '100%', alignItems: 'center', gap: 10, padding: '7px 0',
            background: 'transparent', border: 0, textAlign: 'left', cursor: 'pointer', opacity: .55,
          },
        },
          React.createElement('span', { style: { fontFamily: _PP.fm, fontSize: 11, color: _PP.ink3, width: 18, flex: '0 0 auto' } }, '·'),
          React.createElement('span', { style: { flex: 1, minWidth: 0, fontSize: 13, color: _PP.ink2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, t.title),
          React.createElement('span', { style: { fontSize: 12, color: _PP.ink3, flex: '0 0 auto' } }, t.artist)
        ))
      ) : null
    ) : null,

    React.createElement('div', { ref: rootRef, 'aria-hidden': dimmed, onPointerDown: rouse, style: shellOuter },
     /* Progress as a line on the pill's own top edge — full bleed, curved to the
        pill's radius, so the accent states how far through the track you are at
        a glance from across the room. The scrub row below is for aiming; this is
        for knowing. Inset by the border so it sits ON the edge, not over it. */
     /* Search rides at the bar's left edge rather than as a square of its own
        between the logo and the bar: floating there it read as part of the nav
        trigger, and it cost the row 52px that the title needed. Divided off by a
        hairline so it is plainly not a transport control. */
     narrow && onSearch ? React.createElement('button', {
       key: 'search', type: 'button', onClick: onSearch,
       'aria-label': 'Search artists, venues and shows',
       style: {
         width: 34, height: 34, flex: '0 0 auto', padding: 0, marginRight: -4,
         borderRadius: 12, background: 'transparent', border: 0,
         borderRight: '1px solid ' + _PP.hair,
         color: _PP.ink2, display: 'grid', placeItems: 'center', cursor: 'pointer',
       },
     }, React.createElement('svg', {
       viewBox: '0 0 24 24', width: 18, height: 18, 'aria-hidden': 'true', style: { display: 'block' },
     }, React.createElement('g', {
       fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round',
     },
       React.createElement('circle', { cx: 10.6, cy: 10.6, r: 6.4 }),
       React.createElement('path', { d: 'm15.4 15.4 4.3 4.3' })
     ))) : null,
     narrow ? React.createElement('button', {
       key: 'art', type: 'button',
       onClick: () => onExpand && onExpand(),
       'aria-label': 'Open the full player',
       style: {
         width: 40, height: 40, flex: '0 0 auto', padding: 0,
         borderRadius: 14, overflow: 'hidden',
         background: _PP.raised, color: _PP.ink, border: '1px solid ' + _PP.line,
         display: 'grid', placeItems: 'center', cursor: 'pointer',
         fontFamily: _PP.fd, fontWeight: 800, fontSize: 16,
       },
     }, track.initial) : art,
     compact ? null : React.createElement('div', {
       style: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 },
     },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 12, width: '100%' } },
      React.createElement('div', { style: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 } },
        React.createElement(Marquee, {
          still: reduceMotion,
          text: track.title,
          style: { fontFamily: _PP.fd, fontWeight: 600, fontSize: 14, letterSpacing: '-.01em', color: _PP.ink },
        }),
        React.createElement('div', {
          style: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: _PP.ink2, minWidth: 0, overflow: 'hidden' },
        },
          nameLink(track.artist, () => onOpenArtist && onOpenArtist(track), artistOpen),
          track.album ? React.createElement('span', { 'aria-hidden': 'true', style: { color: _PP.ink3 } }, '·') : null,
          track.album ? nameLink(track.album, () => onOpenAlbum && onOpenAlbum(track), albumOpen) : null
        )
      ),
      compact || narrow ? null : iconBtn({ key: 'prev', label: 'Previous track', glyph: '\u2039', onClick: onPrev }),
      canTogglePlay && narrow
        ? React.createElement(ScrubPlay, { key: 'play', playing, onTogglePlay, onPrev, onNext })
        : canTogglePlay ? iconBtn({ key: 'play', label: playing ? 'Pause' : 'Play', glyph: playing ? '\u275a\u275a' : '\u25b6', onClick: onTogglePlay, size: 34, big: true }) : null,
      compact || narrow ? null : iconBtn({ key: 'next', label: 'Next track', glyph: '\u203a', onClick: onNext }),
      /* Two different acts, so two controls. HYPE spends from your balance and
         pushes the artist up the local chart; favouriting only saves the track to
         your library. Collapsing them into one heart lost the mechanic the
         product is named after. */
      /* Locked is a THIRD state, not a disabled version of hyped: the hype has
         landed and the window has not reopened yet, so the control states the
         time left rather than offering an action it will refuse. */
      canHype && !compact && !narrow ? React.createElement('button', {
        key: 'hype', type: 'button', onClick: hypeLocked ? undefined : onToggleHype,
        disabled: hypeLocked,
        'aria-label': hypeLocked
          ? 'Already hyped ' + track.artist + '. ' + (hypeLabel || '') + ' until you can hype again'
          : 'Hype ' + track.artist,
        'aria-pressed': hyped,
        style: {
          display: 'flex', alignItems: 'center', gap: 5, flex: '0 0 auto',
          height: 30, padding: '0 14px',
          borderRadius: 9999, cursor: hypeLocked ? 'default' : 'pointer',
          background: hypeLocked ? 'rgba(255,80,41,.08)' : (hyped ? _PP.acc : 'rgba(255,80,41,.14)'),
          border: '1px solid ' + (hypeLocked ? 'rgba(255,80,41,.28)' : (hyped ? _PP.acc : 'rgba(255,80,41,.45)')),
          color: hypeLocked ? 'rgba(255,80,41,.6)' : (hyped ? '#0b1220' : _PP.acc),
        },
      },
        /* Always HYPE. The wait sits beside the word rather than replacing it —
           the button never stops being the thing it is called. */
        React.createElement('span', {
          style: { fontFamily: _PP.fd, fontWeight: 800, fontSize: 12.5, letterSpacing: '.06em', lineHeight: 1 },
        }, 'HYPE'),
        hypeLocked && hypeLabel ? React.createElement('span', {
          style: { fontFamily: _PP.fm, fontWeight: 500, fontSize: 10, letterSpacing: '.04em', opacity: .85 },
        }, hypeLabel) : null
      ) : null,
      compact || narrow ? null : iconBtn({ key: 'fav2', label: faved ? 'Remove from your library' : 'Save to your library', glyph: faved ? '\u2665' : '\u2661', onClick: onToggleFav, active: faved, pressed: faved }),
      compact || narrow ? null : iconBtn({ key: 'queue', label: queueOpen ? 'Close queue' : 'Open queue', glyph: '\u2263', onClick: onToggleQueue, active: queueOpen })
     ),
     /* Its own row: sharing the track line's row left the seek track 2px wide.
        No left padding — it is a sibling of the title inside the same column, so
        it aligns with it by construction. */
     narrow ? null : React.createElement('div', {
       style: { display: 'flex', alignItems: 'center', gap: 10, width: '100%' },
     },
       React.createElement('span', {
         style: { fontFamily: _PP.fm, fontSize: 9.5, color: _PP.ink3, flex: '0 0 auto', minWidth: 30 },
       }, elapsed(progress, track.seconds)),
       React.createElement(Track, { value: progress, onSeek, label: 'Seek' }),
       narrow ? null : React.createElement('span', {
         key: 'note', 'aria-hidden': 'true',
         style: { fontFamily: _PP.fm, fontSize: 10, color: _PP.ink3, flex: '0 0 auto', paddingLeft: 6 },
       }, '\u266b'),
       narrow ? null : React.createElement(Track, { key: 'vol', value: volume, onSeek: onVolume, label: 'Volume', width: 108, accent: false })
     )
     )
    )
  );
}
