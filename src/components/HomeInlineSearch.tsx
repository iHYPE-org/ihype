'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useMediaPlayer } from '@/components/GlobalMediaPlayer';

type SearchResult = {
  type: 'artist' | 'venue' | 'promoter' | 'song' | 'show' | 'genre';
  id: string;
  name: string;
  subtitle: string;
  slug?: string;
  hypeCount?: number;
  status?: string;
};

const TYPE_LABELS: Record<string, string> = {
  artist: 'Artist',
  venue: 'Venue',
  promoter: 'Promoter / DJ',
  song: 'Track',
  show: 'Show'
};

export function HomeInlineSearch() {
  const { playTrack } = useMediaPlayer();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}&limit=15`);
        const data = await res.json() as { results: SearchResult[] };
        setResults((data.results ?? []).filter((r) => r.type !== 'genre'));
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 260);
  }, [query]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function getHref(result: SearchResult): string {
    if (!result.slug) return '#';
    if (result.type === 'artist') return `/artists/${result.slug}`;
    if (result.type === 'venue') return `/venues/${result.slug}`;
    if (result.type === 'promoter') return `/promoters/${result.slug}`;
    if (result.type === 'show') return `/shows/${result.slug}`;
    return '#';
  }

  function handlePlaySong(result: SearchResult) {
    if (result.type !== 'song') return;
    playTrack({
      id: result.id,
      title: result.name,
      artistName: result.subtitle.replace(/^by /, '').split(' / ')[0],
      url: `/api/media/${result.id}`,
      mediaId: result.id,
      artistProfileSlug: result.slug ?? null
    });
    setOpen(false);
  }

  return (
    <div className="home-search-wrap" ref={containerRef}>
      <div className="home-search-input-row">
        <input
          autoComplete="off"
          className="input home-search-input"
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search artists, tracks, shows, venues…"
          type="search"
          value={query}
        />
        {searching && <span className="home-search-spinner" aria-hidden="true" />}
      </div>

      {open && results.length > 0 && (
        <ul className="home-search-results" role="listbox">
          {results.map((result) => (
            <li className={`home-search-result home-search-result-${result.type}`} key={`${result.type}-${result.id}`} role="option">
              {result.type === 'song' ? (
                <button
                  className="home-search-result-inner home-search-result-song"
                  onClick={() => handlePlaySong(result)}
                  type="button"
                >
                  <span className="home-search-type-badge">{TYPE_LABELS[result.type]}</span>
                  <span className="home-search-name">{result.name}</span>
                  <span className="meta">{result.subtitle}</span>
                  <span className="home-search-play-hint">▶ play</span>
                </button>
              ) : (
                <Link
                  className="home-search-result-inner"
                  href={getHref(result)}
                  onClick={() => setOpen(false)}
                >
                  <span className="home-search-type-badge">{TYPE_LABELS[result.type] ?? result.type}</span>
                  <span className="home-search-name">{result.name}</span>
                  <span className="meta">{result.subtitle}</span>
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}

      {open && !searching && query.trim() && results.length === 0 && (
        <div className="home-search-empty meta">No results for &ldquo;{query}&rdquo;</div>
      )}

      {!open && (
        <p className="home-search-hint meta">
          <Link href="/search">Advanced search →</Link>
        </p>
      )}
    </div>
  );
}
