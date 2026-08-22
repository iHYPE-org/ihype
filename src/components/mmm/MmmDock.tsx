'use client';

import { useRouter } from 'next/navigation';
import { JoystickTransport } from '@/components/ds/JoystickTransport';
import { RotaryNav } from '@/components/ds/RotaryNav';
import { MmmTuner } from '@/components/mmm/MmmTuner';
import { useRegisteredStations } from '@/components/mmm/MmmStations';
import { MMM_NAV, moduleForPath, stationsForPath } from '@/lib/mmm-nav';

/**
 * The console dock — the whole of the app's navigation.
 *
 * From `design/handoff-console-2026-08-21/README.md` ("The navigation model"),
 * whose first sentence is the thing to keep in mind while reading this file:
 * *"This is the part most likely to be rebuilt wrong, because it replaces a
 * pattern every developer has muscle memory for. **There is no tab bar.**"*
 *
 *   left    `RotaryNav`          MAP · MUSIC · ME. Tap steps, drag snaps,
 *                                arrows step. The cap reads out the module.
 *   centre  `TunerDial`          the sections of whatever you are looking at.
 *   right   `JoystickTransport`  tap play/pause · ◀ prev · ▶ next · ▲ open the
 *                                full player · ▼ dismiss it.
 *
 * All three come straight from `src/components/ds/`, which is generated from the
 * design system. There is nothing to bind but the app's own routes and
 * playback: the detents, the drag, the snap-back and the 3D tilt are the
 * components'. That is the point of the handoff — "if you find yourself writing
 * a component that already exists, stop and mount the existing one instead".
 *
 * ## Two figures that are load-bearing on each other
 *
 * `KNOB` is passed to BOTH knobs, because the handoff is explicit that they are
 * one piece of hardware in two places: *"both knobs are 74px, matched … if one
 * is smaller the dock looks broken"*. The dock's height is derived from it in
 * `mmm.css` (`--mmm-knob`), not restated — the geometry table lives once, which
 * is the rule SHELL_LOCK actually cares about.
 *
 * ## What replaced what
 *
 * The logo trigger, the radial arc, the nav hint, the scrim, the player pill and
 * the phone mini-player are all retired (2026-08-22, owner decision). Nothing
 * they were wired to was dropped: transport moved to the joystick, and the
 * queue, seek, volume, heart and HYPE moved to `MmmFullPlayer`, which the
 * joystick's ▲ opens at every width instead of on the phone alone.
 */
const KNOB = 74;

export function MmmDock({
  canTogglePlay,
  layer,
  onCollapse,
  onExpand,
  onNext,
  onPrev,
  onTogglePlay,
  pathname,
  playing,
}: {
  canTogglePlay: boolean;
  /** The map's own `?layer=`, which is what the dial tunes on MAP. */
  layer: string | null;
  onCollapse: () => void;
  onExpand: () => void;
  onNext: () => void;
  onPrev: () => void;
  onTogglePlay: () => void;
  pathname: string;
  playing: boolean;
}) {
  const router = useRouter();
  const activeModule = moduleForPath(pathname);

  /* A page's own section set wins over the module's — a profile's tabs are what
     the dial should tune while you are on a profile. See MmmStations.tsx: the
     page registers, the dock tunes, and neither draws a second control. */
  const registered = useRegisteredStations();
  const fallback = stationsForPath(pathname, { layer });
  const stations = registered?.stations ?? fallback.stations;
  const active = registered?.active ?? fallback.active;
  const label = registered?.label
    ?? `Sections in ${MMM_NAV.find((module) => module.id === activeModule)!.label}`;

  const select = (id: string) => {
    if (registered) {
      registered.onChange(id);
      return;
    }
    /* `push`, not `replace`: these are destinations, and Back should walk them.
       The needle is re-homed from the URL on arrival, so Back moves the dial
       too rather than leaving it lying about where you are. */
    const href = fallback.stations.find((station) => station.id === id)?.href;
    if (href) router.push(href);
  };

  return (
    <div className="mmm-dock">
      <RotaryNav
        activeModule={activeModule}
        modules={MMM_NAV.map((module) => ({ id: module.id, label: module.label }))}
        onNavigate={(module) => router.push(MMM_NAV.find((entry) => entry.id === module.id)!.href)}
        size={KNOB}
      />

      <MmmTuner active={active} label={label} onSelect={select} stations={stations} />

      <JoystickTransport
        canTogglePlay={canTogglePlay}
        onCollapse={onCollapse}
        onExpand={onExpand}
        onNext={onNext}
        onPrev={onPrev}
        onTogglePlay={onTogglePlay}
        playing={playing}
        size={KNOB}
      />
    </div>
  );
}
