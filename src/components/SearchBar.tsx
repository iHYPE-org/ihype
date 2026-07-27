'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useI18n } from '@/components/I18nProvider';

export function SearchBar() {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { data: session, status } = useSession();

  function handleIconClick() {
    setExpanded(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = inputRef.current?.value.trim();
    if (q) {
      router.push(`/search?q=${encodeURIComponent(q)}`);
      setExpanded(false);
    }
  }

  function handleClose() {
    setExpanded(false);
  }

  // Search is an app feature, not marketing chrome — matches SiteNavTabs
  // hiding Listen/Events/Pages for logged-out desktop visitors.
  if (status === 'loading' || !session?.user) return null;

  return (
    <>
      {/* Desktop: always visible inline form */}
      <form
        action="/search"
        method="get"
        className="search-bar-desktop"
      >
        <input
          name="q"
          placeholder={t('searchBar.placeholder', 'Search artists, shows…')}
          type="search"
          style={{
            background: 'var(--bg-3)',
            border: '1px solid var(--line-2)',
            borderRadius: 6,
            color: 'var(--ink)',
            fontSize: 13,
            padding: '5px 10px',
            width: '100%'
          }}
        />
      </form>

      {/* Mobile: icon button that expands to overlay */}
      <button
        className="search-bar-mobile-trigger"
        aria-label={t('searchBar.searchAriaLabel', 'Search')}
        onClick={handleIconClick}
      >
        🔍
      </button>

      {expanded && (
        <div className="search-bar-overlay" role="dialog" aria-label={t('searchBar.searchAriaLabel', 'Search')}>
          <form onSubmit={handleSubmit} className="search-bar-overlay-form">
            <input
              ref={inputRef}
              type="search"
              placeholder={t('searchBar.placeholder', 'Search artists, shows…')}
              className="search-bar-overlay-input"
              autoComplete="off"
            />
            <button type="submit" className="search-bar-overlay-submit" aria-label={t('searchBar.goAriaLabel', 'Go')}>
              🔍
            </button>
            <button type="button" className="search-bar-overlay-close" onClick={handleClose} aria-label={t('searchBar.closeAriaLabel', 'Close search')}>
              ✕
            </button>
          </form>
        </div>
      )}
    </>
  );
}
