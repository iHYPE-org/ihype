'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/components/I18nProvider';

export function SearchBar({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

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

  return (
    <>
      {/* Desktop: always visible inline form */}
      <form
        action="/search"
        method="get"
        className={`search-bar-desktop${compact ? ' is-compact' : ''}`}
      >
        <input
          name="q"
          placeholder={t('searchBar.placeholder', 'Search artists, shows…')}
          type="search"
        />
      </form>

      {/* Mobile: icon button that expands to overlay */}
      <button
        className={`search-bar-mobile-trigger${compact ? ' is-visible' : ''}`}
        aria-label={t('searchBar.searchAriaLabel', 'Search')}
        onClick={handleIconClick}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18">
          <circle cx="10.75" cy="10.75" r="6.75" fill="none" stroke="currentColor" strokeWidth="1.75" />
          <path d="m16 16 4 4" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.75" />
        </svg>
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
              <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18">
                <circle cx="10.75" cy="10.75" r="6.75" fill="none" stroke="currentColor" strokeWidth="1.75" />
                <path d="m16 16 4 4" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.75" />
              </svg>
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
