'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';

/**
 * The universal search field, from Design System 8's `templates/simplified-app/`.
 *
 * Three rules come straight off the template and each one is a decision, not a
 * detail:
 *
 * 1. **It shares a row with the tab strip.** The overhaul's own visual pass
 *    reads "three stacked control rows became one" — the header, tabs and a
 *    search bar in three rows cost more vertical space than the first row of
 *    content, which is the thing people came for.
 * 2. **The scope chips appear on FOCUS only.** "Six chips permanently on
 *    screen is six chips nobody reads."
 * 3. **It is persistent across every MUSIC surface, and MUSIC only.** MAP has
 *    its own venue search bound to the venues layer; ME has none, by design.
 *    Search stopped being a tab in this generation precisely so it could be
 *    everywhere at once.
 *
 * ## Scopes and the endpoint
 *
 * The six chips map onto `/api/search?type=`, which grew `venue`, `city` and
 * `playlist` for this surface. "Everything" is `type=all`, which covers four of
 * the five — playlists are the exception and are only ever fetched under their
 * own chip, because they are the caller's own rows and a response carrying them
 * cannot be CDN-cached. See the route's own header for that reasoning.
 *
 * Every result is a real link to a route that exists, and every kind with an
 * in-shell equivalent resolves inside `/app` — see `hrefFor` for the one that
 * still leaves and why.
 */

type SearchResult = {
  type: 'artist' | 'venue' | 'promoter' | 'song' | 'show' | 'genre' | 'city' | 'playlist';
  id: string;
  name: string;
  subtitle: string;
  slug?: string;
};

const SCOPES: ReadonlyArray<{ id: string; label: string; type: string }> = [
  { id: 'all', label: 'Everything', type: 'all' },
  { id: 'artists', label: 'Artists', type: 'artist' },
  { id: 'tracks', label: 'Tracks', type: 'song' },
  { id: 'venues', label: 'Venues', type: 'venue' },
  { id: 'cities', label: 'Cities', type: 'city' },
  { id: 'playlists', label: 'Playlists', type: 'playlist' },
];

/**
 * Where a result of each kind actually lives.
 *
 * **Every destination that has an in-shell equivalent resolves inside `/app`.**
 * This function used to return legacy routes for all eight kinds, which made
 * the most central control in MUSIC the widest door out of the shell: every
 * search result swapped the header and the player. It was also invisible to the
 * escape audit, which reads `href=` literals and cannot see a switch.
 *
 * Every kind now resolves inside `/app`. The last to move was CITY, which
 * needed `/api/discover/seeds` to grow a `city` parameter first — pointing it
 * at a tab that ignored the value would have reproduced the very bug this was
 * fixing rather than fixing it.
 */
function hrefFor(result: SearchResult): string {
  switch (result.type) {
    case 'song':
      return `/app/tracks/${result.id}`;
    case 'show':
      return `/app/shows/${result.slug ?? ''}`;
    case 'playlist':
      return `/app/playlists/${result.id}`;
    case 'venue':
      return `/app/venues/${result.slug ?? ''}`;
    // `/api/discover/seeds` grew a `city` parameter, so MUSIC's own Discover
    // tab now really filters by city and this no longer has to leave.
    case 'city':
      return `/app/music/discover?city=${encodeURIComponent(result.name)}`;
    // MUSIC's Discover tab takes `?genre=` and passes it to the seeds
    // endpoint, so this filter actually applies. Legacy sends genre results to
    // `/listen?genre=`, where the redirect drops the term.
    case 'genre':
      return `/app/music/discover?genre=${encodeURIComponent(result.name)}`;
    default:
      return `/app/artists/${result.slug ?? ''}`;
  }
}

const KIND_LABEL: Record<SearchResult['type'], string> = {
  artist: 'Artist',
  venue: 'Venue',
  promoter: 'Promoter',
  song: 'Track',
  show: 'Show',
  genre: 'Genre',
  city: 'City',
  playlist: 'Playlist',
};

/**
 * `initialQuery` prefills the field, so a search started somewhere else can be
 * continued here rather than restarted.
 *
 * MAP has its own venue/artist search bound to the map layers; its "Search all
 * of iHYPE" fallback is a handoff to THIS field, and the handoff is worthless
 * if it drops the words the member already typed.
 */
export function MmmSearch({
  autoFocus = false,
  initialQuery = '',
}: { autoFocus?: boolean; initialQuery?: string } = {}) {
  const [query, setQuery] = useState(initialQuery);
  const [scope, setScope] = useState('all');
  const [focused, setFocused] = useState(false);
  const [state, setState] = useState<{ status: 'idle' | 'loading' | 'ready' | 'error'; results: SearchResult[] }>({
    status: 'idle',
    results: [],
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  // ⌘K / Ctrl-K focuses the field, matching the hint the field itself renders.
  // A key hint that does nothing is a promise the UI does not keep.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        inputRef.current?.focus();
      }
      if (event.key === 'Escape' && document.activeElement === inputRef.current) {
        inputRef.current?.blur();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // The player pill's phone search control navigates here rather than opening a
  // surface of its own — the field IS the search surface — so arriving with
  // `?focus=search` has to land in the field, or the tap costs a navigation and
  // still leaves the member with something to aim at.
  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const trimmed = query.trim();
  const activeType = SCOPES.find((entry) => entry.id === scope)?.type ?? 'all';

  useEffect(() => {
    if (trimmed.length < 2) {
      setState({ status: 'idle', results: [] });
      return;
    }
    let cancelled = false;
    // Debounced: the field fires on every keystroke and the endpoint is rate
    // limited at 60/min per IP, which a raw per-keystroke fetch would burn
    // through inside one sentence.
    const timer = setTimeout(() => {
      setState((prev) => ({ status: 'loading', results: prev.results }));
      fetch(`/api/search?q=${encodeURIComponent(trimmed)}&type=${activeType}&limit=12`, { cache: 'no-store' })
        .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
        .then((payload: { results?: SearchResult[] }) => {
          if (!cancelled) setState({ status: 'ready', results: payload.results ?? [] });
        })
        .catch(() => {
          if (!cancelled) setState({ status: 'error', results: [] });
        });
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmed, activeType]);

  // Blur closes the scope row and the result list — but a click ON a result is
  // itself a blur, so the close is deferred past the click that caused it.
  const onBlur = useCallback(() => {
    setTimeout(() => setFocused(false), 140);
  }, []);

  const showResults = focused && trimmed.length >= 2;

  return (
    <div className="mmm-search-wrap">
      <div className="mmm-search-field">
        <span aria-hidden="true" className="mmm-search-glyph">⌕</span>
        <input
          aria-label="Search artists, tracks, venues, cities and playlists"
          className="mmm-search-input"
          onBlur={onBlur}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setFocused(true)}
          placeholder="Search artists, tracks, venues, cities, playlists"
          ref={inputRef}
          type="search"
          value={query}
        />
        <span aria-hidden="true" className="mmm-search-key">⌘K</span>
      </div>

      {focused && (
        <div className="mmm-search-scopes">
          {SCOPES.map((entry) => (
            <button
              aria-pressed={entry.id === scope}
              className="mmm-search-scope"
              key={entry.id}
              // onMouseDown, not onClick: a click on a chip blurs the input
              // first, which unmounts this row before the click can land.
              onMouseDown={(event) => {
                event.preventDefault();
                setScope(entry.id);
              }}
              type="button"
            >
              {entry.label}
            </button>
          ))}
        </div>
      )}

      {showResults && (
        <div aria-label="Search results" aria-live="polite" className="mmm-search-results" id={listId} role="region">
          {state.status === 'loading' && state.results.length === 0 && (
            <p className="mmm-search-note" role="status">Searching…</p>
          )}
          {state.status === 'error' && (
            <p className="mmm-search-note">Search is unavailable right now.</p>
          )}
          {state.status === 'ready' && state.results.length === 0 && (
            <p className="mmm-search-note">
              Nothing matched “{trimmed}”
              {scope === 'all' ? '.' : ` in ${SCOPES.find((s) => s.id === scope)?.label.toLowerCase()}.`}
            </p>
          )}
          {state.results.map((result) => (
            <Link className="mmm-search-result" href={hrefFor(result)} key={`${result.type}-${result.id}`}>
              <span className="mmm-search-result-main">
                <span className="mmm-row-title">{result.name}</span>
                {result.subtitle && <span className="mmm-row-sub">{result.subtitle}</span>}
              </span>
              <span className="mmm-search-kind">{KIND_LABEL[result.type]}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
