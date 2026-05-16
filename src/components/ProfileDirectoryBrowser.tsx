'use client';

import Link from 'next/link';
import { useDeferredValue, useMemo, useState } from 'react';
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
  artistProfileId?: string | null;
  artistHypeCount?: number | null;
  url: string;
  notes: string | null;
  artworkUrl: string | null;
  mediaType: 'audio' | 'video';
};

const browseTabs = [
  { href: '/artists', label: 'Artists' },
  { href: '/promoters', label: 'Promoters' },
  { href: '/venues', label: 'Venues' },
  { href: '/fans', label: 'Fans' }
] as const;

const typeLabels: Record<DirectoryBrowserProfile['type'], string> = {
  ARTIST: 'Artists',
  DJ: 'Promoters',
  VENUE: 'Venues',
  LISTENER: 'Fans'
};

function getMarketLabel(profile: DirectoryBrowserProfile) {
  return [profile.city, profile.stateRegion ?? profile.country].filter(Boolean).join(', ');
}

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
  const [selectedType, setSelectedType] = useState<'all' | DirectoryBrowserProfile['type']>('all');
  const [selectedMarket, setSelectedMarket] = useState('all');
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [sortMode, setSortMode] = useState<'hype' | 'name' | 'market'>('hype');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const marketOptions = useMemo(
    () => Array.from(new Set(profiles.map(getMarketLabel).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [profiles]
  );
  const genreOptions = useMemo(
    () => Array.from(new Set(profiles.flatMap((profile) => profile.genres))).sort((a, b) => a.localeCompare(b)),
    [profiles]
  );
  const filteredProfiles = useMemo(() => {
    return profiles
      .filter((profile) => profileMatchesQuery(profile, deferredQuery))
      .filter((profile) => selectedType === 'all' || profile.type === selectedType)
      .filter((profile) => selectedMarket === 'all' || getMarketLabel(profile) === selectedMarket)
      .filter((profile) => selectedGenre === 'all' || profile.genres.includes(selectedGenre))
      .sort((a, b) => {
        if (sortMode === 'name') {
          return a.name.localeCompare(b.name);
        }
        if (sortMode === 'market') {
          return getMarketLabel(a).localeCompare(getMarketLabel(b)) || b.hypeCount - a.hypeCount;
        }
        return b.hypeCount - a.hypeCount || a.name.localeCompare(b.name);
      });
  }, [deferredQuery, profiles, selectedGenre, selectedMarket, selectedType, sortMode]);
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
  const hasFilters = hasQuery || selectedType !== 'all' || selectedMarket !== 'all' || selectedGenre !== 'all' || sortMode !== 'hype';

  function clearFilters() {
    setQuery('');
    setSelectedType('all');
    setSelectedMarket('all');
    setSelectedGenre('all');
    setSortMode('hype');
  }

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

      <button
        className="directory-filter-toggle"
        onClick={() => setFiltersOpen((open) => !open)}
        type="button"
      >
        {filtersOpen ? 'Hide filters' : 'Show filters'} ({filteredProfiles.length})
      </button>

      <div className={filtersOpen ? 'directory-filter-grid open' : 'directory-filter-grid'} aria-label="Directory filters">
        <label className="directory-filter-control">
          <span>Role</span>
          <select value={selectedType} onChange={(event) => setSelectedType(event.target.value as typeof selectedType)}>
            <option value="all">All roles</option>
            {Object.entries(typeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="directory-filter-control">
          <span>Market</span>
          <select value={selectedMarket} onChange={(event) => setSelectedMarket(event.target.value)}>
            <option value="all">All markets</option>
            {marketOptions.map((market) => (
              <option key={market} value={market}>
                {market}
              </option>
            ))}
          </select>
        </label>

        <label className="directory-filter-control">
          <span>Genre</span>
          <select value={selectedGenre} onChange={(event) => setSelectedGenre(event.target.value)}>
            <option value="all">All genres</option>
            {genreOptions.map((genre) => (
              <option key={genre} value={genre}>
                {genre}
              </option>
            ))}
          </select>
        </label>

        <label className="directory-filter-control">
          <span>Sort</span>
          <select value={sortMode} onChange={(event) => setSortMode(event.target.value as typeof sortMode)}>
            <option value="hype">Most hype</option>
            <option value="name">Name</option>
            <option value="market">Market</option>
          </select>
        </label>
      </div>

      <div className="directory-browser-meta">
        <p className="meta">
          {hasQuery
            ? `${filteredProfiles.length} profiles and ${filteredMedia.length} songs match "${query.trim()}"`
            : `${filteredProfiles.length} of ${profiles.length} profiles visible`}
        </p>
        {hasFilters ? (
          <button className="text-link" onClick={clearFilters} type="button">
            Clear filters
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
          <div className="empty directory-empty-state">
            <span className="empty-title">No profiles match those filters yet.</span>
            <p>Clear filters or join free to seed the public directory with a stronger local signal.</p>
            <div className="cta-row">
              <button className="text-link" onClick={clearFilters} type="button">
                Clear filters
              </button>
              <Link className="button small secondary" href="/register">
                Join free
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
