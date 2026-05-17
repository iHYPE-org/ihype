'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export function SearchBar() {
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
        className="search-bar-desktop"
        style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, maxWidth: 280, margin: '0 16px' }}
      >
        <input
          name="q"
          placeholder="Search artists, shows…"
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
        aria-label="Search"
        onClick={handleIconClick}
      >
        🔍
      </button>

      {expanded && (
        <div className="search-bar-overlay" role="dialog" aria-label="Search">
          <form onSubmit={handleSubmit} className="search-bar-overlay-form">
            <input
              ref={inputRef}
              type="search"
              placeholder="Search artists, shows…"
              className="search-bar-overlay-input"
              autoComplete="off"
            />
            <button type="submit" className="search-bar-overlay-submit" aria-label="Go">
              🔍
            </button>
            <button type="button" className="search-bar-overlay-close" onClick={handleClose} aria-label="Close search">
              ✕
            </button>
          </form>
        </div>
      )}
    </>
  );
}
