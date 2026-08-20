'use client';

import { useRouter } from 'next/navigation';
import { TunerDial } from '@/components/TunerDial';
import { MMM_MUSIC_TABS, MMM_ME_PANELS, moduleForPath, itemForPath, type MmmModuleId } from '@/lib/mmm-nav';

/**
 * The tuner, in the chrome.
 *
 * ## Why it is here and not in the pane
 *
 * The MUSIC module's destinations were a `.mmm-tabs` strip at the top of the
 * pane — the same top-of-page selector every other surface has already given
 * up. In the console direction the tuner is not a page control at all: it is
 * part of the cabinet, between the two knobs, and it stays put while the pane
 * under it changes. That is the difference between an app that has a dial on a
 * screen and an app that IS a receiver.
 *
 * ## What it tunes
 *
 * The current module's own destinations, so one control means "where in here"
 * at every width:
 *
 *   MUSIC  Discover · Radio · Charts · Recommended · Playlists
 *   ME     Info · Settings
 *   MAP    nothing — the map has no sub-destinations, so the dial is not
 *          rendered rather than rendered empty. A dial with one station is a
 *          label pretending to be a control.
 *
 * The arc nav still switches BETWEEN modules; this switches within one. Two
 * jobs, two controls, which is what the prototype draws.
 */
export function MmmChromeDial({ pathname }: { pathname: string }) {
  const router = useRouter();
  const module: MmmModuleId = moduleForPath(pathname);

  const stops = module === 'music'
    ? MMM_MUSIC_TABS.map((item) => ({ id: item.id, label: item.label, href: item.href }))
    : module === 'me'
      ? MMM_ME_PANELS.map((panel) => ({ id: panel.id, label: panel.label, href: panel.href }))
      : [];

  if (stops.length < 2) return null;

  /* `itemForPath` is null on a module's own root — /app/music with no tab —
     which is the first destination, not "no destination". Falling back keeps
     the needle on a station rather than parking it between two. */
  const active = itemForPath(pathname) ?? stops[0].id;

  return (
    <div className="mmm-chrome-dial">
      <TunerDial
        active={active}
        label={`${module === 'music' ? 'Music' : 'Me'} destinations`}
        onSelect={(id) => {
          const next = stops.find((stop) => stop.id === id);
          /* `push`, not `replace`: these are destinations a member navigates
             between and expects Back to walk. The dial's own scale position is
             re-homed from the URL on arrival, so a Back press moves the needle
             too rather than leaving it lying about where you are. */
          if (next) router.push(next.href);
        }}
        stops={stops}
      />
    </div>
  );
}
