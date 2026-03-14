'use client';

import Link from 'next/link';
import { useDeferredValue, useState } from 'react';
import { ProfileCard } from '@/components/ProfileCard';

export type DirectoryBrowserProfile = {
  id: string;
  type: 'ARTIST' | 'DJ' | 'VENUE' | 'LISTENER';
  slug: string;
  hexId: string;
  name: string;
  contactInfo: string | null;
  addressLine1: string | null;
  hoursText: string | null;
  hometown: string | null;
  city: string | null;
  stateRegion: string | null;
  country: string | null;
  hypeCount: number;
  bio: string | null;
  genres: string[];
  avatarImage: string | null;
};

const browseTabs = [
  { href: '/artists', label: 'Artists' },
  { href: '/promoters', label: 'Promoters' },
  { href: '/venues', label: 'Venues' }
] as const;

function profileMatchesQuery(profile: DirectoryBrowserProfile, query: string) {
  if (!query) {
    return true;
  }

  const haystack = [
    profile.name,
    profile.contactInfo,
    profile.addressLine1,
    profile.hoursText,
    profile.hometown,
    profile.city,
    profile.stateRegion,
    profile.country,
    profile.bio,
    profile.hexId,
    ...profile.genres
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(query);
}

export function ProfileDirectoryBrowser({
  currentHref,
  profiles
}: {
  currentHref: string;
  profiles: DirectoryBrowserProfile[];
}) {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const filteredProfiles = profiles.filter((profile) => profileMatchesQuery(profile, deferredQuery));

  return (
    <section className="directory-browser">
      <div className="directory-browser-topline">
        <nav aria-label="Browse creators and venues" className="directory-switcher">
          {browseTabs.map((tab) => (
            <Link
              key={tab.href}
              className={tab.href === currentHref ? 'directory-switcher-link active' : 'directory-switcher-link'}
              href={tab.href}
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        <label className="directory-search">
          <span>Search</span>
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name, city, genre, bio, or share ID"
            type="search"
            value={query}
          />
        </label>
      </div>

      <div className="directory-browser-meta">
        <p className="meta">
          {filteredProfiles.length === profiles.length
            ? `${profiles.length} profiles available`
            : `${filteredProfiles.length} of ${profiles.length} profiles match "${query.trim()}"`}
        </p>
        {query ? (
          <button className="text-link" onClick={() => setQuery('')} type="button">
            Clear search
          </button>
        ) : null}
      </div>

      <div className="grid grid-3">
        {filteredProfiles.length ? (
          filteredProfiles.map((profile) => <ProfileCard key={profile.id} profile={profile} />)
        ) : (
          <div className="empty">No profiles match that search yet.</div>
        )}
      </div>
    </section>
  );
}
