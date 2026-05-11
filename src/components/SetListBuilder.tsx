'use client';

import { useEffect, useRef, useState } from 'react';

export type SetListTrack = {
  clientId: string;
  title: string;
  artistName: string;
  mediaHexId: string | null;
};

type SearchResult = {
  id: string;
  name: string;
  subtitle: string;
  slug?: string;
};

export function SetListBuilder({
  value,
  onChange
}: {
  value: SetListTrack[];
  onChange: (tracks: SetListTrack[]) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      setShowResults(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}&type=song&limit=12`);
        const data = await res.json() as { results: SearchResult[] };
        const songs = (data.results ?? []).filter((r) => (r as any).type === 'song');
        setResults(songs);
        setShowResults(true);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 280);
  }, [query]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function addTrack(result: SearchResult) {
    if (value.some((t) => t.mediaHexId === result.id)) return;
    const artistName = result.subtitle.startsWith('by ')
      ? result.subtitle.replace(/^by /, '').split(' / ')[0]
      : result.slug ?? '';
    onChange([
      ...value,
      {
        clientId: `sl-${result.id}-${Date.now()}`,
        title: result.name,
        artistName,
        mediaHexId: result.id
      }
    ]);
    setQuery('');
    setResults([]);
    setShowResults(false);
  }

  function removeTrack(clientId: string) {
    onChange(value.filter((t) => t.clientId !== clientId));
  }

  function moveUp(index: number) {
    if (index === 0) return;
    const next = [...value];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    onChange(next);
  }

  function moveDown(index: number) {
    if (index === value.length - 1) return;
    const next = [...value];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    onChange(next);
  }

  const addedIds = new Set(value.map((t) => t.mediaHexId));

  return (
    <div className="setlist-builder" ref={containerRef}>
      <div className="setlist-search-wrap">
        <input
          autoComplete="off"
          className="input"
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setShowResults(true)}
          placeholder="Search any artist's tracks to add to set…"
          type="search"
          value={query}
        />
        {searching && <span className="setlist-searching meta">Searching…</span>}

        {showResults && results.length > 0 && (
          <ul className="setlist-results" role="listbox">
            {results.map((r) => (
              <li className="setlist-result" key={r.id} role="option" aria-selected={addedIds.has(r.id)}>
                <div className="setlist-result-info">
                  <span className="setlist-result-title">{r.name}</span>
                  <span className="meta">{r.subtitle}</span>
                </div>
                <button
                  className="button small"
                  disabled={addedIds.has(r.id)}
                  onClick={() => addTrack(r)}
                  type="button"
                >
                  {addedIds.has(r.id) ? 'Added' : 'Add'}
                </button>
              </li>
            ))}
          </ul>
        )}

        {showResults && !searching && query.trim() && results.length === 0 && (
          <div className="setlist-no-results meta">No tracks found for &ldquo;{query}&rdquo;</div>
        )}
      </div>

      {value.length > 0 ? (
        <ol className="setlist-tracks">
          {value.map((track, index) => (
            <li className="setlist-track" key={track.clientId}>
              <span className="setlist-position">{index + 1}</span>
              <div className="setlist-track-info">
                <strong className="setlist-track-title">{track.title}</strong>
                <span className="meta">{track.artistName}</span>
              </div>
              <div className="setlist-track-actions">
                <button
                  aria-label="Move up"
                  className="setlist-reorder-btn"
                  disabled={index === 0}
                  onClick={() => moveUp(index)}
                  type="button"
                >
                  ↑
                </button>
                <button
                  aria-label="Move down"
                  className="setlist-reorder-btn"
                  disabled={index === value.length - 1}
                  onClick={() => moveDown(index)}
                  type="button"
                >
                  ↓
                </button>
                <button
                  aria-label="Remove track"
                  className="setlist-remove-btn"
                  onClick={() => removeTrack(track.clientId)}
                  type="button"
                >
                  ×
                </button>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="setlist-empty meta">
          Search above to build your set. Tracks will appear here in order.
        </p>
      )}
    </div>
  );
}
