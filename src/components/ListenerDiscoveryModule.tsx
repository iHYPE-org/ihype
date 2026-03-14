'use client';

import Link from 'next/link';
import { useDeferredValue, useMemo, useState } from 'react';

export type ListenerDiscoveryProfile = {
  id: string;
  type: 'ARTIST' | 'DJ' | 'VENUE';
  slug: string;
  hexId: string;
  name: string;
  headline: string | null;
  bio: string | null;
  genres: string[];
  city: string | null;
  stateRegion: string | null;
  country: string | null;
  postalCode: string | null;
  relatedShowTitles: string[];
};

type ListenerDiscoveryModuleProps = {
  profiles: ListenerDiscoveryProfile[];
};

function normalizeValue(value: string) {
  return value.trim().toLowerCase();
}

function getProfileHref(profile: ListenerDiscoveryProfile) {
  if (profile.type === 'DJ') return `/promoters/${profile.slug}`;
  if (profile.type === 'VENUE') return `/venues/${profile.slug}`;
  return `/artists/${profile.slug}`;
}

function getBrowseHref(type: ListenerDiscoveryProfile['type']) {
  if (type === 'DJ') return '/promoters';
  if (type === 'VENUE') return '/venues';
  return '/artists';
}

function getTypeLabel(type: ListenerDiscoveryProfile['type']) {
  if (type === 'DJ') return 'Promoters';
  if (type === 'VENUE') return 'Venues';
  return 'Artists';
}

function profileMatches(profile: ListenerDiscoveryProfile, filters: Record<string, string>) {
  const keywordHaystack = [
    profile.name,
    profile.headline,
    profile.bio,
    profile.hexId,
    ...profile.genres,
    ...profile.relatedShowTitles,
    profile.city,
    profile.stateRegion,
    profile.country,
    profile.postalCode
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const genreHaystack = profile.genres.join(' ').toLowerCase();
  const subgenreHaystack = [profile.headline, profile.bio, ...profile.genres].filter(Boolean).join(' ').toLowerCase();
  const locationHaystack = [profile.city, profile.stateRegion, profile.country, profile.postalCode]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const tourHaystack = profile.relatedShowTitles.join(' ').toLowerCase();

  if (filters.keyword && !keywordHaystack.includes(filters.keyword)) return false;
  if (filters.genre && !genreHaystack.includes(filters.genre)) return false;
  if (filters.subgenre && !subgenreHaystack.includes(filters.subgenre)) return false;
  if (filters.location && !locationHaystack.includes(filters.location)) return false;
  if (filters.tour && !tourHaystack.includes(filters.tour)) return false;

  return true;
}

function formatLocation(profile: ListenerDiscoveryProfile) {
  const parts = [profile.city, profile.stateRegion || profile.country, profile.postalCode].filter(Boolean);
  return parts.length ? parts.join(', ') : 'Location not posted yet';
}

export function ListenerDiscoveryModule({ profiles }: ListenerDiscoveryModuleProps) {
  const [filters, setFilters] = useState({
    keyword: '',
    genre: '',
    subgenre: '',
    location: '',
    tour: ''
  });

  const deferredFilters = useDeferredValue(
    Object.fromEntries(Object.entries(filters).map(([key, value]) => [key, normalizeValue(value)]))
  );

  const filteredProfiles = useMemo(
    () => profiles.filter((profile) => profileMatches(profile, deferredFilters)),
    [profiles, deferredFilters]
  );

  const groups = useMemo(
    () =>
      (['ARTIST', 'DJ', 'VENUE'] as const).map((type) => ({
        type,
        label: getTypeLabel(type),
        browseHref: getBrowseHref(type),
        profiles: filteredProfiles.filter((profile) => profile.type === type).slice(0, 5)
      })),
    [filteredProfiles]
  );

  const hasFilters = Object.values(filters).some((value) => value.trim().length > 0);

  return (
    <section className="panel listener-dashboard-discovery-panel">
      <div className="listener-dashboard-module-head">
        <div>
          <h3>Discover</h3>
          <p className="meta">Search artists, promoters, venues, tours, and local scenes from one listener workspace.</p>
        </div>
      </div>

      <div className="listener-discovery-form-grid">
        <label className="listener-discovery-field listener-discovery-keyword-field">
          <span>Search</span>
          <input
            onChange={(event) => setFilters((current) => ({ ...current, keyword: event.target.value }))}
            placeholder="Name, share ID, bio, genre, city"
            type="search"
            value={filters.keyword}
          />
        </label>

        <label className="listener-discovery-field">
          <span>Genre</span>
          <input
            onChange={(event) => setFilters((current) => ({ ...current, genre: event.target.value }))}
            placeholder="House, techno, indie"
            type="search"
            value={filters.genre}
          />
        </label>

        <label className="listener-discovery-field">
          <span>Subgenre</span>
          <input
            onChange={(event) => setFilters((current) => ({ ...current, subgenre: event.target.value }))}
            placeholder="Afro house, minimal, synth pop"
            type="search"
            value={filters.subgenre}
          />
        </label>

        <label className="listener-discovery-field">
          <span>Location</span>
          <input
            onChange={(event) => setFilters((current) => ({ ...current, location: event.target.value }))}
            placeholder="ZIP, city, state, country"
            type="search"
            value={filters.location}
          />
        </label>

        <label className="listener-discovery-field listener-discovery-tour-field">
          <span>Tour</span>
          <input
            onChange={(event) => setFilters((current) => ({ ...current, tour: event.target.value }))}
            placeholder="Show title, session, residency"
            type="search"
            value={filters.tour}
          />
        </label>
      </div>

      <div className="listener-discovery-results-head">
        <p className="meta">
          {hasFilters
            ? `${filteredProfiles.length} result${filteredProfiles.length === 1 ? '' : 's'} match your filters`
            : `${profiles.length} profiles available to browse`}
        </p>
        {hasFilters ? (
          <button
            className="text-link"
            onClick={() =>
              setFilters({
                keyword: '',
                genre: '',
                subgenre: '',
                location: '',
                tour: ''
              })
            }
            type="button"
          >
            Clear search
          </button>
        ) : null}
      </div>

      <div className="listener-discovery-results-grid">
        {groups.map((group) => (
          <article className="listener-discovery-results-panel" key={group.type}>
            <div className="listener-discovery-results-panel-head">
              <h4>{group.label}</h4>
              <Link href={group.browseHref}>Browse all</Link>
            </div>

            {group.profiles.length ? (
              <div className="listener-discovery-results-list">
                {group.profiles.map((profile) => (
                  <Link className="listener-discovery-result" href={getProfileHref(profile)} key={profile.id}>
                    <div className="listener-discovery-result-title">
                      <strong>{profile.name}</strong>
                      <span>{profile.hexId}</span>
                    </div>
                    <p>{profile.headline || profile.bio || formatLocation(profile)}</p>
                    <div className="listener-discovery-result-meta">
                      <span>{formatLocation(profile)}</span>
                      {profile.genres[0] ? <span>{profile.genres[0]}</span> : null}
                      {profile.relatedShowTitles[0] ? <span>{profile.relatedShowTitles[0]}</span> : null}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="empty">No {group.label.toLowerCase()} match right now.</div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
