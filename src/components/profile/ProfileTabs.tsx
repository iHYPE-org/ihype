'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useRegisterStations } from '@/components/mmm/MmmStations';

/**
 * The fixed subnav for a public artist or venue profile.
 *
 * ## Why the tab set is fixed
 *
 * Every profile gets the SAME tabs in the same order, whether or not the
 * profile has filled them in. That is the point: a member learns one shape
 * once, and "Merch" is in the same place on every artist. The alternative —
 * hiding empty tabs — means the strip changes under you from profile to
 * profile, and a member who found merch on one artist cannot tell whether the
 * next artist has none or whether they are looking in the wrong place. An
 * empty tab says "nothing here yet"; a missing tab says nothing at all.
 *
 * ## Why it is a URL, not component state
 *
 * `?tab=` is shareable, survives a back button, and lets a link point at a
 * specific section. Same reason `/info` and `/payouts` take their tab from
 * searchParams. `scroll: false` keeps the strip still while the panel swaps —
 * a tab that jumps you to the top of the page is a tab that feels broken.
 *
 * ## Why it renders nothing
 *
 * It was a strip, then it was its own `TunerDial` inside the pane, and now it is
 * neither: it hands the tab set to the dock's dial and draws no control at all.
 * The handoff's rule is that there is **one dial per screen and it is the
 * dock's** — "an in-page tab strip alongside it puts two identical-looking dials
 * on screen meaning different things", which is precisely what shipped while
 * this component drew its own dial ten pixels above the dock's.
 *
 * The state stays here, in `?tab=`. The dock is a remote control for it, not a
 * second copy of it — see `MmmStations.tsx`.
 */
export type ProfileTab = { id: string; label: string };

export function ProfileTabs({
  tabs,
  active,
  label,
}: {
  tabs: readonly ProfileTab[];
  active: string;
  label: string;
}) {
  const router = useRouter();
  const params = useSearchParams();

  function select(id: string) {
    const next = new URLSearchParams(params?.toString() ?? '');
    // The first tab is the default, so it stays out of the URL rather than
    // pinning `?tab=albums` on every share of an artist's front page.
    if (id === tabs[0]?.id) next.delete('tab');
    else next.set('tab', id);
    const query = next.toString();
    router.replace(query ? `?${query}` : '?', { scroll: false });
  }

  /* The dock tunes this set for as long as the profile is mounted, and the
     registration clears on the way out so the dial never offers a departed
     profile's tabs. */
  useRegisterStations({ active, label, onChange: select, stations: tabs });

  return null;
}
