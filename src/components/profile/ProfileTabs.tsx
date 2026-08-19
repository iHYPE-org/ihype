'use client';

import { useRouter, useSearchParams } from 'next/navigation';

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
 * ## Sizing
 *
 * Every label is 15px on a 44px-tall control. This strip is the one piece of
 * chrome on a profile that a member reads at arm's length, and it is exactly
 * the sort of surface that historically got the tracked 10px "eyebrow"
 * treatment — which is what the 12.5px floor in PR #727 exists to stop.
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

  return (
    <nav aria-label={label} className="profile-tabs">
      <ul>
        {tabs.map((tab) => (
          <li key={tab.id}>
            <button
              aria-current={tab.id === active ? 'page' : undefined}
              className="profile-tab"
              data-active={tab.id === active}
              onClick={() => select(tab.id)}
              type="button"
            >
              {tab.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
