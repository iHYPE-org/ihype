'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { TunerDial } from '@/components/TunerDial';

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
 * ## Why it is a dial and not a strip
 *
 * It WAS a strip: six 15px labels on a 44px row, of which two did not fit
 * 393px and were clipped off the edge. That is the structural problem with a
 * tab strip — it divides one row by the number of tabs, so every tab added
 * makes every label smaller or pushes one out of sight, and the usual fix is
 * to shrink the type. Every strip in this codebase had already lost that
 * argument and sat at 10-13px.
 *
 * `TunerDial` spends the same row on ONE destination at 26px, and adding a
 * seventh section costs nothing because only one is ever shown. See that file
 * for the interaction and accessibility model.
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

  return <TunerDial active={active} label={label} onSelect={select} stops={tabs} />;
}
