'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';

/**
 * Universal search — persistent on every MUSIC surface.
 *
 * ADHERENCE rule 37: "Universal search is persistent on MUSIC, and is not a
 * tab." It replaces the retired `/search` route, which was a whole page you had
 * to navigate to and back from. MAP keeps its own search (venues only, because
 * matching an artist there would send you to a pin that does not exist); ME has
 * none, by design.
 *
 * ## The scope chips are the scopes the endpoint can actually answer
 *
 * v8 names six scopes — artists, tracks, venues, cities, playlists. `GET
 * /api/search` returns five result *types*: artist, venue, song, show, genre.
 * The chips below are that set, not v8's, and the difference is deliberate:
 *
 *  - **Cities** is not a type. The endpoint already matches `city`,
 *    `stateRegion` and `hometown` when it searches artists and venues, so
 *    typing a city name works — it just surfaces as the artists and venues in
 *    it rather than as a "city" row. A chip that filtered to nothing would be
 *    worse than no chip.
 *  - **Playlists** are not searched at all. There is no playlist branch in the
 *    endpoint, so a Playlists chip would always come back empty. It needs a
 *    query added server-side first; adding the chip now would just be a
 *    guaranteed-empty control, which ADHERENCE rule 15 rules out ("never render
 *    a control that is guaranteed to fail").
 *  - **Shows** and **Genres** are types the endpoint does return and v8's list
 *    does not mention. They are offered rather than hidden — the alternative is
 *    an endpoint returning results no chip can reach.
 *
 * ## Reveal, not animation
 *
 * The chip row and the result panel are authored at their final values and
 * appear as a state change — ADHERENCE rule 23. Nothing here fades in from
 * `opacity: 0`: an unadvanced transition holds its FROM value permanently in
 * some contexts, and that is exactly how the arc nav read "open" in its props
 * while `getComputedStyle` said `opacity: 0` for three rounds.
 */

type ResultType = 'artist' | 'venue' | 'song' | 'show' | 'genre';

type SearchResult = {
  type: ResultType;
  id: string;
  name: string;
  subtitle: string;
  slug?: string;
};

/** Chip id → the endpoint's `type` param. `all` sends none. */
const SCOPES: ReadonlyArray<{ id: string; label: string; param: string | null }> = [
  { id: 'all', label: 'All', param: null },
  { id: 'artists', label: 'Artists', param: 'artist' },
  { id: 'tracks', label: 'Tracks', param: 'song' },
  { id: 'shows', label: 'Shows', param: 'show' },
];

/**
 * Where a result opens. A venue and an artist are both Profile rows but live on
 * different routes, so the type — not the row — decides. A genre has no page of
 * its own: it scopes the search rather than navigating, so it is not a link.
 */
function hrefFor(result: SearchResult): string | null {
  if (!result.slug) return null;
  if (result.type === 'venue') return `/venues/${result.slug}`;
  if (result.type === 'artist') return `/artists/${result.slug}`;
  if (result.type === 'show') return `/shows/${result.slug}`;
  if (result.type === 'song') return `/tracks/${result.id}`;
  return null;
}

export function MmmSearch() {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState(SCOPES[0]);
  const [focused, setFocused] = useState(false);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [failed, setFailed] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const panelId = useId();

  // Click-out dismisses the panel, matching the map's venue search. Listening
  // on the document rather than blurring the input is what lets a result be
  // clicked: a blur handler fires before the click lands and takes the target
  // with it.
  useEffect(() => {
    if (!focused) return;
    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setFocused(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [focused]);

  // Debounced, and aborted on every keystroke: without the abort a slow early
  // request can resolve after a fast later one and overwrite newer results with
  // older ones for a query the member has already finished typing.
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults(null);
      setFailed(false);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ q: trimmed, limit: '12' });
      if (scope.param) params.set('type', scope.param);
      fetch(`/api/search?${params}`, { cache: 'no-store', signal: controller.signal })
        .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
        .then((payload: { results?: SearchResult[] }) => {
          setResults(payload.results ?? []);
          setFailed(false);
        })
        .catch((error: unknown) => {
          if ((error as { name?: string })?.name === 'AbortError') return;
          // A failed search says so. Rendering an empty list would claim the
          // scene has nobody by that name, which is a different statement.
          setResults(null);
          setFailed(true);
        });
    }, 220);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, scope]);

  const open = focused && query.trim().length >= 2;

  return (
    <div className="mmm-search" ref={rootRef}>
      <div className="mmm-search-field">
        <input
          aria-controls={open ? panelId : undefined}
          aria-expanded={open}
          aria-label="Search artists, tracks, venues and shows"
          className="mmm-search-input"
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setFocused(true)}
          placeholder="Search artists, tracks, venues"
          role="combobox"
          type="search"
          value={query}
        />
        {query && (
          <button
            aria-label="Clear search"
            className="mmm-search-clear"
            onClick={() => { setQuery(''); setResults(null); setFailed(false); }}
            type="button"
          >
            <span aria-hidden="true">{'✕'}</span>
          </button>
        )}
      </div>

      {focused && (
        <div className="mmm-search-scopes" role="group" aria-label="Search scope">
          {SCOPES.map((item) => (
            <button
              aria-pressed={item.id === scope.id}
              className="mmm-search-scope"
              key={item.id}
              onClick={() => setScope(item)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {open && (
        <div className="mmm-search-panel" id={panelId}>
          {failed && <p className="mmm-search-note">Search is unavailable right now.</p>}
          {!failed && results === null && <p className="mmm-search-note" role="status">Searching…</p>}
          {!failed && results?.length === 0 && (
            <p className="mmm-search-note">Nothing matches “{query.trim()}” in {scope.label.toLowerCase()}.</p>
          )}
          {results?.map((result) => {
            const href = hrefFor(result);
            const body = (
              <>
                <span className="mmm-search-kind">{result.type}</span>
                <span className="mmm-search-name">{result.name}</span>
                {result.subtitle && <span className="mmm-search-sub">{result.subtitle}</span>}
              </>
            );
            // A genre scopes rather than navigates, and a result with no slug
            // has nowhere to go — neither is rendered as a link.
            return href ? (
              <Link className="mmm-search-result" href={href} key={`${result.type}-${result.id}`}>{body}</Link>
            ) : (
              <div className="mmm-search-result" key={`${result.type}-${result.id}`}>{body}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
