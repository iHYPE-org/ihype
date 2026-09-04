'use client';

import { useCallback, useRef } from 'react';
import Link from 'next/link';
import { usePlayIntent } from '@/components/mmm/MmmPlayIntent';
import { MMM_NAV, moduleForPath } from '@/lib/mmm-nav';

/**
 * The console dock — still the whole of the app's navigation, and still the
 * same walnut cabinet. What it no longer is, as of the MIDDLE ROAD, is
 * hardware.
 *
 * (2026-09-04, owner: "let's do it — build and implement the middle ground",
 * choosing between an Apple-Music-shaped rebuild and the console as shipped.)
 *
 * ## What this replaced, and why the reasoning for it did not survive
 *
 * Until this file was rewritten the dock was a translation of
 * `design/handoff-console/reference/console-dock/Console Dock.dc.html`: a
 * bakelite/brass knob that TURNED to step MAP · MUSIC · ME, a backlit meter
 * dial whose stations rode a rotating compass card past a tapered needle, and a
 * thumbstick in a recessed gate for playback. Roughly 950 lines of live-value
 * painting — rotation, drum position, tilt, occlusion, a lamp with an
 * incandescent boot strike — none of which is deleted lightly, because every
 * one of those figures was arrived at by measuring.
 *
 * Three things decided it, and the third is the one that matters:
 *
 *  1. **A knob has to be learned.** It was reported not working twice, and
 *     both reports were taps read as micro-drags on glass; the tap threshold
 *     ended at 10px. A labelled tab is never ambiguous about what a tap does.
 *  2. **It cost 105px plus safe area on every screen**, always, and told the
 *     member nothing — not what was playing, not where they were beyond one
 *     word. The tab row is 46px. What the saved space buys back is a mini
 *     player that says what is playing, on the ~half of sessions where
 *     something is.
 *  3. **Three controls left no room for a fourth destination**, which is why
 *     the door credential lived as a section inside ME. A bar has room, and
 *     TICKETS is now a tab.
 *
 * **The cabinet is NOT retired.** Walnut, brass lip, film grain, the safe-area
 * contract and `--mmm-frame-max` centring are all unchanged — the middle road
 * keeps the console as a SURFACE and spends its remaining distinctiveness on
 * the map, which is the one screen no music app has. Do not "finish the job" by
 * painting this bar flat; the walnut is the point.
 *
 * ## What is wired, and every one of these is pre-existing behaviour
 *
 *  - **The universal transport, unchanged and still never inert.** A tap
 *    resolves three things in order: pause what is playing, else start what the
 *    surface registered (`MmmPlayIntent.tsx`), else turn the radio on
 *    (`onPlayFallback`). MAP, ME, a profile and a ticket register nothing, so
 *    without that last branch the control would be dead on four surfaces out of
 *    five — the exact bug the joystick was built to fix, and it is preserved
 *    here rather than re-solved.
 *  - **The transport is always on screen, in one of two places and never
 *    both.** With a track loaded it is the mini player's key; with nothing
 *    loaded it is the radio key in the tab row. One transport, so there is
 *    never a question of which one is authoritative.
 *  - `onExpand` opens the full player — from the mini player's meta, where the
 *    joystick's ▲ throw used to.
 *  - `onNext` / `onPrev` are the mini player's skips.
 *  - `playing` lights the transport.
 *  - Destinations are real `Link`s, so Back walks them. That was the one
 *    navigation rule the console model already got right and it is untouched.
 *  - `wakeAudio` survives verbatim: browsers only start audio inside a user
 *    gesture, so the context is resumed on pointerdown. Deleting it would make
 *    the first play of a session silently fail on iOS.
 *
 * ## What went with the hardware
 *
 * The synthesized detent CLICKS (`click('tick'|'press'|'seat'|'gate')`), the
 * backlight dip they drove, the pointer-driven occlusion, the springs and the
 * coast physics. Haptics survive as one short `vibrate` on the transport,
 * because a play/pause is a real state change and a phone confirming it is
 * useful; a tab is a navigation and gets none. The nameplate's "way back"
 * memory (`ihype_mmm_last_main` in sessionStorage) also went: every destination
 * is now one labelled tap away, so a control that guesses where you came from
 * has nothing left to be better than.
 */

/* ── Glyphs ────────────────────────────────────────────────────────────────
   Inline SVG, not Unicode. The shell has almost no iconography and this is the
   first place it needed some; the temptation is a character like ◈ or ▤, and
   this codebase has already been bitten by exactly that — U+25C0/U+25B6 carry
   an emoji variant, iOS served the colour glyph, and the console drew three
   blue rounded squares in a row on a real iPhone (see the `src/components/ds/`
   row in CLAUDE.md). A path cannot be re-presented by a platform.

   Drawn as engraving: 1.5px strokes on `currentColor`, no fills, so the active
   tab's lit ink and the resting tab's dimmed ink both come from one property.
   `vector-effect` is deliberately absent — these never scale. */
type Glyph = (props: { className?: string }) => React.ReactElement;

const GLYPHS: Record<string, Glyph> = {
  /* MUSIC — a record. A waveform reads as "audio"; a disc reads as "music you
     can put on", which is what this tab is. */
  music: () => (
    <svg aria-hidden="true" fill="none" height="21" viewBox="0 0 24 24" width="21">
      <circle cx="12" cy="12" r="8.4" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="2.1" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  /* MAP — a pin, not a folded map: the surface is about where things are, and
     a pin is the mark the chart is covered in. */
  map: () => (
    <svg aria-hidden="true" fill="none" height="21" viewBox="0 0 24 24" width="21">
      <path
        d="M12 21.2s6.6-6.16 6.6-11a6.6 6.6 0 1 0-13.2 0c0 4.84 6.6 11 6.6 11Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <circle cx="12" cy="10.1" r="2.3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  /* TICKETS — a stub with its perforation. The two notches are what makes it a
     ticket rather than a card, so they are drawn at the edges where a real one
     tears. */
  tickets: () => (
    <svg aria-hidden="true" fill="none" height="21" viewBox="0 0 24 24" width="21">
      <path
        d="M3 7.6h18v3a2 2 0 0 0 0 4v2.8H3v-2.8a2 2 0 0 0 0-4v-3Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <path d="M14.4 8.6v1.9m0 2v1.9m0 2v1.9" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
    </svg>
  ),
  /* ME — a person. */
  me: () => (
    <svg aria-hidden="true" fill="none" height="21" viewBox="0 0 24 24" width="21">
      <circle cx="12" cy="8.2" r="3.6" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4.9 20.2a7.4 7.4 0 0 1 14.2 0" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
    </svg>
  ),
};

function PlayGlyph({ playing }: { playing: boolean }) {
  return (
    <svg aria-hidden="true" fill="none" height="19" viewBox="0 0 20 20" width="19">
      {playing ? (
        <path d="M7 4.2v11.6M13 4.2v11.6" stroke="currentColor" strokeLinecap="round" strokeWidth="2.1" />
      ) : (
        <path d="M6.4 3.9 16 10l-9.6 6.1V3.9Z" fill="currentColor" />
      )}
    </svg>
  );
}

function SkipGlyph({ dir }: { dir: 'prev' | 'next' }) {
  return (
    <svg aria-hidden="true" fill="none" height="17" viewBox="0 0 20 20" width="17">
      <g transform={dir === 'prev' ? 'translate(20,0) scale(-1,1)' : undefined}>
        <path d="M4.6 4.4 13 10l-8.4 5.6V4.4Z" fill="currentColor" />
        <path d="M15.4 4.6v10.8" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" />
      </g>
    </svg>
  );
}

export type MmmDockTrack = {
  title: string;
  artist: string;
  initial: string;
  artworkUrl: string | null;
};

export function MmmDock({
  canTogglePlay,
  onExpand,
  onNext,
  onPlayFallback,
  onPrev,
  onTogglePlay,
  pathname,
  playing,
  track,
}: {
  canTogglePlay: boolean;
  onExpand: () => void;
  onNext: () => void;
  /** Turn the radio on: the last resort when the surface offers nothing. */
  onPlayFallback: () => void;
  onPrev: () => void;
  onTogglePlay: () => void;
  pathname: string;
  playing: boolean;
  /** What the mini player shows. Null means nothing is loaded. */
  track: MmmDockTrack | null;
}) {
  const activeModule = moduleForPath(pathname);

  /* A tap always does something, in this order: pause the current track, start
     what this surface offers, or turn the radio on. Unchanged from the
     joystick — see MmmPlayIntent.tsx for why the registration is a FUNCTION
     rather than a track. */
  const playIntent = usePlayIntent();
  const togglePlay = canTogglePlay ? onTogglePlay : (playIntent ?? onPlayFallback);

  /* Browsers only allow audio to start inside a user gesture. Every transport
     press begins with a pointerdown, so the context wakes there — deleting this
     makes the first play of a session fail silently on iOS. */
  const audio = useRef<AudioContext | null>(null);
  const wakeAudio = useCallback(() => {
    try {
      if (!audio.current && typeof AudioContext !== 'undefined') audio.current = new AudioContext();
      if (audio.current?.state === 'suspended') void audio.current.resume();
    } catch { /* no audio */ }
  }, []);

  const press = useCallback(() => {
    wakeAudio();
    try { if (navigator.vibrate) navigator.vibrate(6); } catch { /* no haptics */ }
  }, [wakeAudio]);

  return (
    <div className="mmm-dock" data-mini={track ? 'true' : 'false'}>
      <div aria-hidden="true" className="mmm-dock-grain" />

      {/* ── The mini player, only when something is loaded ──────────────────
          Conditional, and that is the whole of the height saving: a bar that
          always carried a player would be 111px on every screen, which is the
          old dock with different furniture. Idle, the chrome is 46px of tabs
          and the transport is the radio key below. */}
      {track && (
        <div className="mmm-mini">
          <button
            aria-label={`Now playing: ${track.title} by ${track.artist}. Open the player.`}
            className="mmm-mini-open"
            onClick={onExpand}
            type="button"
          >
            <span className="mmm-mini-art">
              {track.artworkUrl
                ? <img alt="" src={track.artworkUrl} />
                : <span aria-hidden="true">{track.initial}</span>}
            </span>
            <span className="mmm-mini-meta">
              <span className="mmm-mini-title">{track.title}</span>
              <span className="mmm-mini-artist">{track.artist}</span>
            </span>
          </button>
          <div className="mmm-mini-transport">
            <button
              aria-label="Previous"
              className="mmm-key"
              onClick={() => { press(); onPrev(); }}
              type="button"
            >
              <SkipGlyph dir="prev" />
            </button>
            <button
              aria-label={playing ? 'Pause' : 'Play'}
              aria-pressed={playing}
              className="mmm-key"
              data-lit={playing}
              onClick={() => { press(); togglePlay(); }}
              type="button"
            >
              <PlayGlyph playing={playing} />
            </button>
            <button
              aria-label="Next"
              className="mmm-key"
              onClick={() => { press(); onNext(); }}
              type="button"
            >
              <SkipGlyph dir="next" />
            </button>
          </div>
        </div>
      )}

      {/* ── The tab row ─────────────────────────────────────────────────── */}
      <nav aria-label="Main" className="mmm-tabs">
        {MMM_NAV.map((module) => {
          const Glyph = GLYPHS[module.id];
          const on = module.id === activeModule;
          return (
            <Link
              aria-current={on ? 'page' : undefined}
              className="mmm-tab"
              data-on={on}
              href={module.href}
              key={module.id}
            >
              <span className="mmm-tab-glyph"><Glyph /></span>
              <span className="mmm-tab-label">{module.tabLabel}</span>
            </Link>
          );
        })}

        {/* The transport when nothing is loaded. It is in the tab ROW rather
            than a strip of its own so it costs no height, and it is rendered
            only when the mini player is not — one transport, always reachable,
            never two. Labelled "Radio" because that is what it does from cold:
            `onPlayFallback` turns the always-on station on. */}
        {!track && (
          <button
            aria-label="Play the radio"
            className="mmm-tab mmm-tab-radio"
            onClick={() => { press(); togglePlay(); }}
            type="button"
          >
            <span className="mmm-tab-glyph"><PlayGlyph playing={playing} /></span>
            <span className="mmm-tab-label">Radio</span>
          </button>
        )}
      </nav>
    </div>
  );
}
