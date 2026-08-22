'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMediaPlayer } from '@/components/GlobalMediaPlayer';
import { toQueue, type PlayableRow } from '@/lib/mmm-play';

/**
 * What the dock's joystick should PLAY when nothing is loaded yet.
 *
 * ## The bug this exists to fix
 *
 * The joystick is wired to the global media player — `togglePlayback`,
 * `playNext`, `playPrevious`, straight from `useMediaPlayer()`. But the shell
 * passes `canTogglePlay={Boolean(currentTrack)}`, and the vendored component
 * honours that by making a tap a no-op. So on a freshly opened app the entire
 * transport was inert: the only way to start anything was a play button drawn
 * inside a card, and after that the joystick worked. Reported from a phone as
 * "media joystick not connected to player" — which is what it looks like, and
 * the wiring was never the problem.
 *
 * A transport that does nothing until you use a different control is not a
 * transport. So a surface that knows what it would play registers that here,
 * and the joystick's tap starts it.
 *
 * ## Why a registry rather than teaching the dock about music
 *
 * Same reason `MmmStations` exists, and deliberately a separate file from it:
 * the dock is chrome and must not know that Discover has a card deck, that
 * Radio has a station, or that a profile has a top track. Each surface knows
 * its own answer and hands it over; the dock stays a remote control.
 *
 * The registration is a FUNCTION, not a track. What "play" means on Discover is
 * "play the card currently on screen", which changes as the deck advances — a
 * captured track would go stale one swipe later, and would be the same class of
 * bug as a dial left tuned to a departed profile's tabs.
 */
type Registry = {
  intent: (() => void) | null;
  register: (intent: (() => void) | null) => void;
};

type Held = { run: () => void } | null;

/**
 * The state transition, pure and exported so it can be tested without a DOM.
 *
 * Returning the SAME reference for an unchanged registration is the whole point:
 * a new `{ run }` wrapper on every call re-renders every consumer of this
 * context, and combined with an unstable `register` that was an unbounded loop.
 */
export function nextHeld(previous: Held, intent: (() => void) | null): Held {
  if (!intent) return previous === null ? previous : null;
  if (previous && previous.run === intent) return previous;
  return { run: intent };
}

const MmmPlayIntentContext = createContext<Registry>({ intent: null, register: () => {} });

export function MmmPlayIntentProvider({ children }: { children: ReactNode }) {
  /* Held in a wrapper object because `useState` treats a bare function as an
     updater — `setState(fn)` would CALL it instead of storing it, which here
     means starting playback at registration time. */
  const [held, setHeld] = useState<{ run: () => void } | null>(null);

  /**
   * Two properties, and the first draft of this file had NEITHER. It shipped an
   * unbounded render loop that took the Workerd server down in CI and failed 18
   * tests as collateral, which is the only reason it was caught at all.
   *
   * 1. **`register` must be stable.** It was rebuilt inside a `useMemo` keyed on
   *    `held`, and the consumer's effect depends on it — so every registration
   *    changed `held`, which changed `register`, which re-ran the effect.
   *    `MmmStations` gets this for free by handing out `setRegistered` itself;
   *    an empty-dep `useCallback` is the same guarantee written down.
   * 2. **Setting the same intent must be a no-op.** Even with a stable
   *    `register`, allocating a fresh `{ run }` on every call makes `held` a new
   *    reference each time and re-renders every consumer of this context. The
   *    functional update compares the function it already holds and keeps the
   *    existing wrapper, so a re-run cannot churn.
   */
  const register = useCallback((intent: (() => void) | null) => setHeld((previous) => nextHeld(previous, intent)), []);

  const value = useMemo<Registry>(
    () => ({ intent: held ? held.run : null, register }),
    [held, register],
  );
  return <MmmPlayIntentContext.Provider value={value}>{children}</MmmPlayIntentContext.Provider>;
}

/** The dock's side: what to start, or null when this surface offers nothing. */
export function usePlayIntent(): (() => void) | null {
  return useContext(MmmPlayIntentContext).intent;
}

/**
 * The surface's side. Offer something for the transport to start.
 *
 * The cleanup clears it for the same reason `useRegisterStations`' does: the
 * dock outlives the pane (it is mounted in the `/app` layout), so an intent
 * left behind would have the joystick starting a track from a surface the
 * member has already navigated away from.
 */
export function useRegisterPlayIntent(intent: (() => void) | null): void {
  const { register } = useContext(MmmPlayIntentContext);
  useEffect(() => {
    register(intent);
    return () => register(null);
  }, [intent, register]);
}

/**
 * Register a LIST of rows as what the transport starts here.
 *
 * Every surface wants this and none of them should write it themselves, because
 * the naive version is a render loop and it is not obvious why:
 *
 *   const queue = toQueue(rows);                        // a NEW array each render
 *   useRegisterPlayIntent(useCallback(..., [queue]));   // so a new function each render
 *
 * `useRegisterPlayIntent`'s effect depends on the function, so a new identity
 * re-registers; re-registering changes the provider's state; that re-renders
 * every consumer of this context, including this one; which builds another new
 * array. Simulated before writing this: six renders produced six state changes
 * with a fresh array and one with the memo below.
 *
 * That is the same fault that took the Workerd server down when this file was
 * first added, arriving by a different route — which is why the fix lives in a
 * hook rather than in a comment telling five call sites to be careful.
 *
 * The memo key is the rows' identity and audio, not the array reference: a
 * server component re-renders a fresh array literal for unchanged data, and a
 * client tab rebuilds one from state that has not moved. The key is what tells
 * those apart from a playlist that actually changed.
 */
export function useRegisterQueue(rows: readonly PlayableRow[]): void {
  const { playTrack } = useMediaPlayer();
  const key = rows.map((row) => `${row.hexId ?? row.id ?? ''}|${row.mediaUrl ?? row.url ?? ''}`).join(',');
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` IS the digest of `rows`; depending on the array itself is the loop this exists to prevent.
  const queue = useMemo(() => toQueue(rows), [key]);
  const play = useCallback(() => {
    if (queue.length > 0) playTrack(queue[0], queue);
  }, [playTrack, queue]);
  useRegisterPlayIntent(queue.length > 0 ? play : null);
}
