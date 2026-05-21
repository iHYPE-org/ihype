'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export function HeaderSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [pending, setPending] = useState(false);

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q || pending) return;
    setPending(true);
    router.push(`/artists?q=${encodeURIComponent(q)}`);
    setQuery('');
    setTimeout(() => setPending(false), 1500);
  }

  return (
    <form className="nav-search" onSubmit={handleSearch} role="search" aria-busy={pending}>
      <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>
      </svg>
      <input
        className="nav-search-input"
        placeholder={pending ? 'Searching…' : 'Search artists, shows, venues…'}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search iHYPE"
        disabled={pending}
      />
      <span className="nav-search-kbd">⌘</span>
      <span className="nav-search-kbd">K</span>
    </form>
  );
}
