'use client';

import { Suspense, useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

type ResultType = 'artist' | 'venue' | 'promoter' | 'song' | 'show' | 'genre';
type Filter = 'all' | 'artists' | 'shows' | 'tracks';

interface ResultItem {
  type: ResultType;
  id: string;
  name: string;
  subtitle: string;
  slug?: string;
  status?: string;
}

interface SearchResponse {
  results: ResultItem[];
  genres: string[];
}

const TRENDING = ['deep house', 'alex rivera', 'fillmore', 'luna park', 'seeds', 'hype'];

const NoteIcon = ({ c }: { c: string }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
);
const TicketIcon = ({ c }: { c: string }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4z" /><path d="M13 5v2M13 11v2M13 17v2" /></svg>
);

function resultHref(r: ResultItem): string {
  if (r.type === 'venue') return r.slug ? `/venues/${r.slug}` : '#';
  if (r.type === 'artist' || r.type === 'promoter') return r.slug ? `/artists/${r.slug}` : '#';
  if (r.type === 'show') return r.slug ? `/shows/${r.slug}` : '#';
  return '#';
}

function resultColor(r: ResultItem): string {
  if (r.type === 'venue') return '#22e5d4';
  if (r.type === 'promoter') return '#ff3e9a';
  if (r.type === 'song') return '#b983ff';
  return '#ff5029';
}

const API_TYPE: Record<Filter, string> = { all: 'all', artists: 'artist', shows: 'show', tracks: 'song' };

function SearchPageInner() {
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get('q') || '');
  const [filter, setFilter] = useState<Filter>('all');
  const [data, setData] = useState<SearchResponse | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  function runSearch(val: string, f: Filter) {
    if (!val.trim()) { setData(null); return; }
    startTransition(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(val)}&type=${API_TYPE[f]}`);
        if (!res.ok) { setData(null); return; }
        setData(await res.json());
      } catch {
        setData(null);
      }
    });
  }

  function handleSearch(val: string) {
    setQ(val);
    runSearch(val, filter);
  }

  function handleFilter(f: Filter) {
    setFilter(f);
    if (q) runSearch(q, f);
  }

  const results = data?.results ?? [];
  const artists = results.filter((r) => r.type === 'artist' || r.type === 'venue' || r.type === 'promoter');
  const shows = results.filter((r) => r.type === 'show');
  const tracks = results.filter((r) => r.type === 'song');
  const hasResults = artists.length + shows.length + tracks.length > 0;
  const show = (type: Filter) => filter === 'all' || filter === type;

  return (
    <div style={{ maxWidth: 840, margin: '0 auto', padding: '32px 24px 100px' }}>
      <div style={{ position: 'relative', marginBottom: 28 }}>
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', opacity: .4, pointerEvents: 'none' }}>
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Artists, shows, tracks…"
          style={{
            width: '100%', padding: '14px 16px 14px 46px', border: '1px solid rgba(255,255,255,.12)',
            borderRadius: 10, background: 'var(--bg2)', color: 'var(--ink)', fontSize: 16, transition: 'all 150ms',
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 28, flexWrap: 'wrap' }}>
        {(['all', 'artists', 'shows', 'tracks'] as Filter[]).map((f) => (
          <div
            key={f}
            onClick={() => handleFilter(f)}
            style={{
              padding: '8px 16px', borderRadius: 9999,
              background: filter === f ? 'var(--accent)' : 'rgba(255,255,255,.05)',
              border: `1px solid ${filter === f ? 'var(--accent)' : 'rgba(255,255,255,.1)'}`,
              color: filter === f ? '#fff' : 'rgba(240,235,229,.75)',
              fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all 150ms',
            }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </div>
        ))}
      </div>

      {isPending && (
        <p style={{ color: 'rgba(240,235,229,.35)', fontSize: 13, fontFamily: 'var(--font-mono)' }}>Searching…</p>
      )}

      {!q && (
        <div>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.14em', color: 'rgba(240,235,229,.55)', marginBottom: 14, marginTop: 32 }}>Trending</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {TRENDING.map((t) => (
              <div
                key={t}
                onClick={() => handleSearch(t)}
                style={{ padding: '8px 14px', borderRadius: 8, background: 'var(--bg2)', border: '1px solid rgba(255,255,255,.06)', fontSize: 13, color: 'rgba(240,235,229,.75)', cursor: 'pointer', transition: 'all 150ms' }}
              >
                {t}
              </div>
            ))}
          </div>
        </div>
      )}

      {q && !isPending && !hasResults && (
        <div style={{ textAlign: 'center', padding: 60, color: 'rgba(240,235,229,.5)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(240,235,229,.3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
          </div>
          <p>No results for &quot;{q}&quot;</p>
        </div>
      )}

      {q && hasResults && (
        <div>
          {show('artists') && artists.length > 0 && (
            <div>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.14em', color: 'rgba(240,235,229,.55)', marginBottom: 14, marginTop: 32 }}>Artists</p>
              {artists.map((r) => {
                const c = resultColor(r);
                return (
                  <Link key={r.id} href={resultHref(r)} style={{ display: 'flex', gap: 16, alignItems: 'center', padding: '14px 16px', border: '1px solid rgba(255,255,255,.06)', borderRadius: 8, background: 'var(--bg2)', marginBottom: 10, textDecoration: 'none', color: 'inherit' }}>
                    <div style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg,${c}40,transparent)` }}>
                      <NoteIcon c={c} />
                    </div>
                    <div>
                      <h4 style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 800, marginBottom: 2, color: 'var(--ink)' }}>{r.name}</h4>
                      <p style={{ fontSize: 12, color: 'rgba(240,235,229,.55)' }}>{r.subtitle}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {show('shows') && shows.length > 0 && (
            <div>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.14em', color: 'rgba(240,235,229,.55)', marginBottom: 14, marginTop: 32 }}>Shows</p>
              {shows.map((r) => {
                const c = resultColor(r);
                return (
                  <Link key={r.id} href={resultHref(r)} style={{ display: 'flex', gap: 16, alignItems: 'center', padding: '14px 16px', border: '1px solid rgba(255,255,255,.06)', borderRadius: 8, background: 'var(--bg2)', marginBottom: 10, textDecoration: 'none', color: 'inherit' }}>
                    <div style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg,${c}40,transparent)` }}>
                      <TicketIcon c={c} />
                    </div>
                    <div>
                      <h4 style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 800, marginBottom: 2, color: 'var(--ink)' }}>{r.name}</h4>
                      <p style={{ fontSize: 12, color: 'rgba(240,235,229,.55)' }}>{r.subtitle}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {show('tracks') && tracks.length > 0 && (
            <div>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.14em', color: 'rgba(240,235,229,.55)', marginBottom: 14, marginTop: 32 }}>Tracks</p>
              {tracks.map((r) => {
                const c = resultColor(r);
                return (
                  <Link key={r.id} href={resultHref(r)} style={{ display: 'flex', gap: 16, alignItems: 'center', padding: '14px 16px', border: '1px solid rgba(255,255,255,.06)', borderRadius: 8, background: 'var(--bg2)', marginBottom: 10, textDecoration: 'none', color: 'inherit' }}>
                    <div style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg,${c}40,transparent)` }}>
                      <NoteIcon c={c} />
                    </div>
                    <div>
                      <h4 style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 800, marginBottom: 2, color: 'var(--ink)' }}>{r.name}</h4>
                      <p style={{ fontSize: 12, color: 'rgba(240,235,229,.55)' }}>{r.subtitle}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchPageInner />
    </Suspense>
  );
}
