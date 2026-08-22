'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

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

const MmmPlayIntentContext = createContext<Registry>({ intent: null, register: () => {} });

export function MmmPlayIntentProvider({ children }: { children: ReactNode }) {
  /* Held in a wrapper object because `useState` treats a bare function as an
     updater — `setState(fn)` would CALL it instead of storing it, which here
     means starting playback at registration time. */
  const [held, setHeld] = useState<{ run: () => void } | null>(null);
  const value = useMemo<Registry>(() => ({
    intent: held ? held.run : null,
    register: (intent) => setHeld(intent ? { run: intent } : null),
  }), [held]);
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
