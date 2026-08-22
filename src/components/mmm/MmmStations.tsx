'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

/**
 * How a page hands its own section set to the dock's dial.
 *
 * ## Why this exists rather than a strip in the page
 *
 * The handoff is explicit, and it is the rule most likely to be broken by
 * accident: "**One dial per screen, and it is the dock's.** On a profile the
 * dock dial tunes that artist's own tab set … An in-page tab strip alongside it
 * puts two identical-looking dials on screen meaning different things."
 *
 * A profile really does have its own sections (Albums · Shows · Merch …), and
 * before this they were a second `TunerDial` inside the pane, directly above
 * the dock's. Two dials, same face, different meanings, ten pixels apart. So a
 * page registers its stations here and renders no selector at all; the dock
 * reads the registration and tunes it, and the knob keeps reporting the module,
 * which is the "MAP + Albums" readout the handoff describes.
 *
 * ## Why the page keeps ownership of the state
 *
 * The registration carries the page's own `active` and `onChange`, so the
 * source of truth stays where the panels are — for a profile that is `?tab=` in
 * the URL, which is shareable and survives Back. The dock is a remote control
 * for it, not a second copy of it.
 */
export type MmmStation = { id: string; label: string };

export type MmmStationSet = {
  stations: readonly MmmStation[];
  active: string;
  onChange: (id: string) => void;
  /** Named for the reader: "Sections in Half Waif" rather than "Sections". */
  label: string;
};

type Registry = {
  registered: MmmStationSet | null;
  register: (set: MmmStationSet | null) => void;
};

const MmmStationsContext = createContext<Registry>({ registered: null, register: () => {} });

export function MmmStationsProvider({ children }: { children: ReactNode }) {
  const [registered, setRegistered] = useState<MmmStationSet | null>(null);
  const value = useMemo<Registry>(() => ({ registered, register: setRegistered }), [registered]);
  return <MmmStationsContext.Provider value={value}>{children}</MmmStationsContext.Provider>;
}

/** The dock's side: whatever a page has registered, or null for the module's own set. */
export function useRegisteredStations(): MmmStationSet | null {
  return useContext(MmmStationsContext).registered;
}

/**
 * The page's side. Register a section set for as long as this page is mounted.
 *
 * The cleanup clears the registration rather than leaving it: the dock survives
 * navigation (it lives in the `/app` layout), so a set left behind would have
 * the dial still offering a departed profile's tabs — which is exactly the
 * "confident, wrong destination" the vendored dial warns about, one route later.
 */
export function useRegisterStations(set: MmmStationSet | null): void {
  const { register } = useContext(MmmStationsContext);
  const stations = set?.stations;
  const active = set?.active;
  const onChange = set?.onChange;
  const label = set?.label;

  useEffect(() => {
    if (!stations || !active || !onChange || !label) {
      register(null);
      return undefined;
    }
    register({ stations, active, onChange, label });
    return () => register(null);
  }, [active, label, onChange, register, stations]);
}
