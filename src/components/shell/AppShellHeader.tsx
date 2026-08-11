'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/components/I18nProvider';

/**
 * The persistent top bar. Height 82px, padding 0 22px, gap 18px,
 * rgba(var(--bg-base-rgb),0.9) + blur(18px), bottom border 1px var(--line).
 *
 * "This is the only menu affordance — there is no hamburger": the 48×48 logo
 * tile toggles the drawer and mirrors its state in `aria-expanded`.
 */
export function AppShellHeader({
  menuOpen,
  onToggleMenu,
  accountName,
  unreadCount,
  initialQuery,
}: {
  menuOpen: boolean;
  onToggleMenu: () => void;
  accountName: string;
  unreadCount: number;
  initialQuery: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const dirtyRef = useRef(false);

  // Keep the field in step with the URL when the query changes underneath us
  // (back/forward, a link into /search). Skipped while the member is typing,
  // so the debounced push below can never fight their own keystrokes.
  useEffect(() => {
    if (!dirtyRef.current) setQuery(initialQuery);
  }, [initialQuery]);

  // "Typing routes to Search results; clearing returns to Discover."
  // Debounced and `replace`d — a per-keystroke push would bury the previous
  // page under a dozen history entries.
  useEffect(() => {
    if (!dirtyRef.current) return;
    const timer = window.setTimeout(() => {
      const trimmed = query.trim();
      router.replace(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : '/app/music/discover');
    }, 320);
    return () => window.clearTimeout(timer);
  }, [query, router]);

  const initials = accountName.trim().charAt(0).toUpperCase() || 'U';

  return (
    <header className="shell-header">
      <button
        aria-expanded={menuOpen}
        aria-label={t('appShell.menuAriaLabel', 'Menu')}
        className="shell-logo-tile"
        onClick={onToggleMenu}
        title={t('appShell.menuAriaLabel', 'Menu')}
        type="button"
      >
        <Image alt="" height={48} priority src="/brand/ihype-menu-logo.webp" width={48} />
      </button>

      <form
        action="/search"
        className="shell-search"
        method="get"
        onSubmit={(event) => {
          event.preventDefault();
          const trimmed = query.trim();
          if (trimmed) router.push(`/search?q=${encodeURIComponent(trimmed)}`);
        }}
        role="search"
      >
        <input
          aria-label={t('appShell.searchPlaceholder', 'Search artists, tracks, shows, and scenes')}
          name="q"
          onChange={(event) => { dirtyRef.current = true; setQuery(event.target.value); }}
          placeholder={t('appShell.searchPlaceholder', 'Search artists, tracks, shows, and scenes')}
          type="search"
          value={query}
        />
      </form>

      <div className="shell-header-spacer" />

      <Link
        aria-label={
          unreadCount
            ? `${t('appShell.notifications', 'Notifications')} (${unreadCount})`
            : t('appShell.notifications', 'Notifications')
        }
        className="shell-icon-button shell-bell"
        href="/me/dashboard#notifications"
        title={t('appShell.notifications', 'Notifications')}
      >
        <svg
          aria-hidden="true"
          fill="none"
          height="19"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.6"
          viewBox="0 0 24 24"
          width="19"
        >
          <path d="M18 15V10a6 6 0 10-12 0v5l-1.6 2.5h15.2z" />
          <path d="M9.5 20a2.6 2.6 0 005 0" />
        </svg>
        {/* A real unread count drives the dot — it is not always on. */}
        {unreadCount > 0 ? <span aria-hidden="true" className="shell-bell-dot" /> : null}
      </Link>

      <Link
        aria-label={`${t('appShell.nav.account', 'Account')} — ${accountName}`}
        className="shell-avatar"
        href="/settings"
        title={accountName}
      >
        <span aria-hidden="true">{initials}</span>
      </Link>
    </header>
  );
}
