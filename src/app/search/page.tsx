'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';

interface Result {
  id: string;
  slug: string;
  name: string;
  type: string;
  city?: string | null;
  hypeCount: number;
}

interface ShowResult {
  id: string;
  slug: string;
  title: string;
  startsAt: string;
  status: string;
  venueCity?: string | null;
  headlinerName?: string | null;
}

interface SearchResponse {
  profiles: Result[];
  shows: ShowResult[];
}

const TYPE_COLOR: Record<string, string> = {
  ARTIST: '#ff5029',
  DJ: '#ff3e9a',
  VENUE: '#22e5d4',
  FAN: '#b983ff',
};

const TYPE_LABEL: Record<string, string> = {
  ARTIST: 'Artist',
  DJ: 'Promoter',
  VENUE: 'Venue',
  FAN: 'Fan',
};

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function doSearch(q: string) {
    if (!q.trim()) { setResults(null); return; }
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        if (!res.ok) { setError('Search failed'); return; }
        setResults(await res.json());
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

  const profileRoute = (type: string, slug: string) =>
    type === 'VENUE' ? `/venues/${slug}` : `/artists/${slug}`;

  const hasResults = results && (results.profiles.length > 0 || results.shows.length > 0);

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

      {error && (
        <p style={{ color: '#ff5029', fontSize: 13 }}>{error}</p>
      )}

      {!isPending && results && !hasResults && (
        <div className="ihype-empty-state">
          <div className="icon">🔍</div>
          <h3>No results for &ldquo;{query}&rdquo;</h3>
          <p>Try a different name or city.</p>
        </div>
      )}

      {hasResults && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>

          {results.profiles.length > 0 && (
            <section>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(240,235,229,.4)', marginBottom: 12 }}>
                Artists &amp; Venues
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {results.profiles.map(p => (
                  <Link key={p.id} href={profileRoute(p.type, p.slug)} style={{ textDecoration: 'none' }}>
                    <div className="ihype-card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px' }}>
                      <div style={{
                        width: 38, height: 38, borderRadius: 19, flexShrink: 0,
                        background: `linear-gradient(135deg, ${TYPE_COLOR[p.type] ?? '#ff5029'}, #b983ff)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17,
                      }}>
                        {p.type === 'VENUE' ? '🏛️' : '🎤'}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14, color: 'var(--ink)' }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: TYPE_COLOR[p.type] ?? '#ff5029', fontFamily: 'var(--font-mono)', letterSpacing: '.06em', textTransform: 'uppercase', marginTop: 2 }}>
                          {TYPE_LABEL[p.type] ?? p.type}{p.city ? ` · ${p.city}` : ''}
                        </div>
                      </div>
                      {p.hypeCount > 0 && (
                        <span style={{ fontSize: 11, color: 'rgba(240,235,229,.3)', fontFamily: 'var(--font-mono)' }}>
                          🔥 {p.hypeCount.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {results.shows.length > 0 && (
            <section>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(240,235,229,.4)', marginBottom: 12 }}>
                Shows
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {results.shows.map(s => {
                  const date = new Date(s.startsAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                  return (
                    <Link key={s.id} href={`/shows/${s.slug}`} style={{ textDecoration: 'none' }}>
                      <div className="ihype-card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14, color: 'var(--ink)' }}>{s.title}</div>
                          <div style={{ fontSize: 11, color: 'rgba(240,235,229,.4)', marginTop: 2 }}>
                            {s.headlinerName ?? 'iHYPE Radio'}
                            {s.venueCity ? ` · ${s.venueCity}` : ''}
                          </div>
                        </div>
                        <span style={{ fontSize: 11, color: 'rgba(240,235,229,.3)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>{date}</span>
                      </div>
                    </Link>
                  );
                })}
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
