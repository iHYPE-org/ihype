'use client';

import Link from 'next/link';
import { useDeferredValue, useState } from 'react';
import { useMediaPlayer, type MediaTrack } from '@/components/GlobalMediaPlayer';
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

export type DirectoryMediaSearchEntry = {
  id: string;
  mediaId: string;
  title: string;
  artistName: string;
  artistSlug: string;
  url: string;
  notes: string | null;
  artworkUrl: string | null;
  mediaType: 'audio' | 'video';
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

function mediaMatchesQuery(entry: DirectoryMediaSearchEntry, query: string) {
  if (!query) {
    return false;
  }

  return [entry.title, entry.artistName, entry.notes]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(query);
}

export function ProfileDirectoryBrowser({
  currentHref,
  profiles,
  mediaEntries = []
}: {
  currentHref: string;
  profiles: DirectoryBrowserProfile[];
  mediaEntries?: DirectoryMediaSearchEntry[];
}) {
  const { playTrack } = useMediaPlayer();
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const filteredProfiles = profiles.filter((profile) => profileMatchesQuery(profile, deferredQuery));
  const filteredMedia = mediaEntries.filter((entry) => mediaMatchesQuery(entry, deferredQuery));
  const mediaQueue: MediaTrack[] = filteredMedia.map((entry) => ({
    id: entry.id,
    title: entry.title,
    artistName: entry.artistName,
    url: entry.url,
    mediaId: entry.mediaId,
    artistProfileSlug: entry.artistSlug,
    notes: entry.notes,
    artworkUrl: entry.artworkUrl
  }));
  const hasQuery = Boolean(query.trim());

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
            placeholder="Song, artist, promoter, venue, city, region, or ID"
            type="search"
            value={query}
          />
        </label>
      </div>

      <div className="directory-browser-meta">
        <p className="meta">
          {hasQuery
            ? `${filteredProfiles.length} profiles and ${filteredMedia.length} songs match "${query.trim()}"`
            : `${profiles.length} profiles available`}
        </p>
        {query ? (
          <button className="text-link" onClick={() => setQuery('')} type="button">
            Clear search
          </button>
        ) : null}
      </div>

      {hasQuery && filteredMedia.length ? (
        <div className="discover-song-results">
          <div className="discover-song-results-head">
            <strong>Song matches</strong>
            <span className="meta">Play a result or jump straight to the artist page.</span>
          </div>
          <div className="discover-song-results-list">
            {filteredMedia.map((entry, index) => (
              <article className="discover-song-result-card" key={entry.id}>
                <div>
                  <strong>{entry.title}</strong>
                  <p className="meta">
                    {entry.artistName}
                    {entry.notes ? ` | ${entry.notes}` : ''}
                  </p>
                </div>
                <div className="cta-row">
                  {entry.mediaType !== 'video' ? (
                    <button
                      className="button small secondary"
                      onClick={() => playTrack(mediaQueue[index], mediaQueue)}
                      type="button"
                    >
                      Play
                    </button>
                  ) : null}
                  <Link className="button small secondary" href={`/artists/${entry.artistSlug}`}>
                    Artist page
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid grid-3">
        {filteredProfiles.length ? (
          filteredProfiles.map((profile) => <ProfileCard key={profile.id} profile={profile} />)
        ) : hasQuery && filteredMedia.length ? null : (
          <div className="empty">No profiles match that search yet.</div>
        )}
      </div>
    </section>
  );
}
