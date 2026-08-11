'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useI18n } from '@/components/I18nProvider';
import { resolveActiveItemId, type ShellNavItem } from '@/lib/app-nav';

const DISCOVER_HREF = '/app/music/discover';

/**
 * "Each non-Discover route opens with a back pill ('‹ For you')."
 *
 * It is rendered by the shell, not by each of the 63 subpages: no page knows
 * what it is a sub-route of, and the handoff's pill is not browser-back — in
 * every screenshot it reads "‹ For you" regardless of the route, so it is a
 * fixed way home to Discover. Modelling it as history.back() would make the
 * same control mean something different on every visit.
 *
 * Hidden on Discover itself, where it would point at the current page.
 */
export function ShellBackPill({ items }: { items: ShellNavItem[] }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (resolveActiveItemId(items, pathname, searchParams.get('tab')) === 'discover') return null;

  return (
    <Link className="shell-back" href={DISCOVER_HREF}>
      <svg
        aria-hidden="true"
        fill="none"
        height="15"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
        viewBox="0 0 24 24"
        width="15"
      >
        <path d="M14 6l-6 6 6 6" />
      </svg>
      {t('appShell.backToDiscover', 'For you')}
    </Link>
  );
}
