'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useState, type FormEvent } from 'react';

export function SiteTopbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const [query, setQuery] = useState('');

  // Derive a breadcrumb label from the current path
  const segment = pathname.split('/').filter(Boolean)[0];
  const label = segment
    ? segment.charAt(0).toUpperCase() + segment.slice(1)
    : 'Home';

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/artists?q=${encodeURIComponent(query.trim())}`);
      setQuery('');
    }
  }

  return (
    <div className="site-topbar" role="search" aria-label="Site search and stats">
      <div className="site-topbar-crumbs">
        <span className="site-topbar-crumb-dim">iHYPE</span>
        <span className="site-topbar-sep">/</span>
        <span className="site-topbar-crumb-active">{label}</span>
      </div>

      <div className="site-topbar-stats">
        <span className="site-topbar-live">● live</span>
        <span className="site-topbar-dot" />
        {session?.user && (
          <span className="site-topbar-stat">Workbench →</span>
        )}
      </div>

      <form className="site-topbar-search" onSubmit={handleSearch} role="search">
        <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>
        </svg>
        <input
          className="site-topbar-input"
          placeholder="Search artists, shows, venues…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search iHYPE"
        />
        <span className="site-topbar-kbd">⌘</span>
        <span className="site-topbar-kbd">K</span>
      </form>
    </div>
  );
}
