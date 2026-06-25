'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';

type ResultType = 'artist' | 'venue' | 'promoter' | 'song' | 'show' | 'genre';

interface ResultItem {
  type: ResultType;
  id: string;
  name: string;
  subtitle: string;
  slug?: string;
  hypeCount?: number;
  status?: string;
  isRadioShow?: boolean;
}

interface SearchResponse {
  results: ResultItem[];
  genres: string[];
  counts?: Record<string, number>;
}

const TYPE_COLOR: Record<string, string> = {
  artist: '#ff5029',
  promoter: '#ff3e9a',
  venue: '#22e5d4',
  fan: '#b983ff',
  show: 'rgba(240,235,229,.6)',
  song: '#b983ff',
};

const TYPE_LABEL: Record<string, string> = {
  artist: 'Artist',
  promoter: 'DJ / Promoter',
  venue: 'Venue',
  show: 'Show',
  song: 'Track',
  genre: 'Genre',
};

const TYPE_ICON: Record<string, string> = {
  artist: '🎤',
  promoter: '🎧',
  venue: '🏛️',
  show: '🎟️',
  song: '🎵',
  genre: '🎼',
};

function resultHref(r: ResultItem): string | null {
  if (r.type === 'venue') return r.slug ? `/venues/${r.slug}` : null;
  if (r.type === 'artist' || r.type === 'promoter') return r.slug ? `/artists/${r.slug}` : null;
  if (r.type === 'show') return r.slug ? `/shows/${r.slug}` : null;
  return null;
}

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [data, setData] = useState<SearchResponse | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function doSearch(q: string) {
    if (!q.trim()) { setData(null); return; }
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        if (!res.ok) { setError('Search failed'); return; }
        setData(await res.json());
      } catch {
        setError('Network error');
      }
    });
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    doSearch(val);
  }

  const results = data?.results ?? [];
  const hasResults = results.length > 0;

  // Group by type for display
  const profiles = results.filter(r => ['artist', 'venue', 'promoter'].includes(r.type));
  const shows = results.filter(r => r.type === 'show');
  const songs = results.filter(r => r.type === 'song');

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '32px 24px 100px' }}>

      <div style={{ marginBottom: 32 }}>
        <p className="ihype-eyebrow" style={{ marginBottom: 8 }}>SEARCH</p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.8rem, 4vw, 2.4rem)', fontWeight: 800, letterSpacing: '-.03em', margin: '0 0 24px' }}>
          Find artists, venues &amp; shows
        </h1>
        <input
          autoFocus
          value={query}
          onChange={handleChange}
          placeholder="Search iHYPE…"
          className="ihype-input ihype-input-lg"
        />
      </div>

      {isPending && (
        <p style={{ color: 'rgba(240,235,229,.35)', fontSize: 13, fontFamily: 'var(--font-mono)' }}>Searching…</p>
      )}
      {error && <p style={{ color: '#ff5029', fontSize: 13 }}>{error}</p>}

      {!isPending && data && !hasResults && (
        <div className="ihype-empty-state">
          <div className="icon">🔍</div>
          <h3>No results for &ldquo;{query}&rdquo;</h3>
          <p>Try a different name or city.</p>
        </div>
      )}

      {hasResults && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>

          {profiles.length > 0 && (
            <section>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(240,235,229,.4)', marginBottom: 12 }}>
                Artists &amp; Venues
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {profiles.map(r => {
                  const href = resultHref(r);
                  const color = TYPE_COLOR[r.type] ?? '#ff5029';
                  const card = (
                    <div className="ihype-card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px' }}>
                      <div style={{
                        width: 38, height: 38, borderRadius: 19, flexShrink: 0,
                        background: `linear-gradient(135deg, ${color}, #b983ff)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17,
                      }}>
                        {TYPE_ICON[r.type] ?? '🎤'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                        <div style={{ fontSize: 11, color, fontFamily: 'var(--font-mono)', letterSpacing: '.06em', textTransform: 'uppercase', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {TYPE_LABEL[r.type]}{r.subtitle ? ` · ${r.subtitle}` : ''}
                        </div>
                      </div>
                      {(r.hypeCount ?? 0) > 0 && (
                        <span style={{ fontSize: 11, color: 'rgba(240,235,229,.3)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                          🔥 {r.hypeCount?.toLocaleString()}
                        </span>
                      )}
                    </div>
                  );
                  return href ? (
                    <Link key={r.id} href={href} style={{ textDecoration: 'none' }}>{card}</Link>
                  ) : (
                    <div key={r.id}>{card}</div>
                  );
                })}
              </div>
            </section>
          )}

          {shows.length > 0 && (
            <section>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(240,235,229,.4)', marginBottom: 12 }}>
                Shows
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {shows.map(r => (
                  <Link key={r.id} href={r.slug ? `/shows/${r.slug}` : '#'} style={{ textDecoration: 'none' }}>
                    <div className="ihype-card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14, color: 'var(--ink)' }}>{r.name}</div>
                        <div style={{ fontSize: 11, color: 'rgba(240,235,229,.4)', marginTop: 2 }}>{r.subtitle}</div>
                      </div>
                      {r.status === 'LIVE' && (
                        <span style={{ fontSize: 10, color: 'var(--accent)', fontFamily: 'var(--font-mono)', letterSpacing: '.1em' }}>● LIVE</span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {songs.length > 0 && (
            <section>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(240,235,229,.4)', marginBottom: 12 }}>
                Tracks
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {songs.map(r => (
                  <Link key={r.id} href={r.slug ? `/artists/${r.slug}` : '#'} style={{ textDecoration: 'none' }}>
                    <div className="ihype-card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px' }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(185,131,255,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>🎵</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14, color: 'var(--ink)' }}>{r.name}</div>
                        <div style={{ fontSize: 11, color: 'rgba(240,235,229,.4)', marginTop: 2 }}>{r.subtitle}</div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {!query && (
        <div style={{ marginTop: 48 }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(240,235,229,.3)', marginBottom: 16 }}>
            Quick links
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {[
              { href: '/discover', label: 'Discover artists' },
              { href: '/shows', label: 'Upcoming shows' },
              { href: '/radio', label: 'Radio' },
            ].map(l => (
              <Link key={l.href} href={l.href} className="ihype-btn-ghost">{l.label}</Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
