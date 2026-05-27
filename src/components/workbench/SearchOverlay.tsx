'use client';

import React, { useState, useEffect, useRef } from 'react';

interface SearchResult {
  id: string;
  label: string;
  sub: string;
  type: 'track' | 'show' | 'artist' | 'genre';
  href?: string;
}

export function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    setLoading(true);
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (!d?.results) return;
          const items: SearchResult[] = d.results.map((r: Record<string, unknown>) => {
            const type = r.type === 'song' ? 'track' : r.type === 'show' ? 'show' : r.type === 'genre' ? 'genre' : 'artist';
            const href = r.type === 'song'
              ? undefined  // tracks play inline
              : r.type === 'show'
                ? `/shows/${r.id}`
                : r.type === 'genre'
                  ? undefined
                  : `/artists/${r.slug ?? r.id}`;
            return {
              id: String(r.id),
              label: String(r.name),
              sub: String(r.subtitle ?? ''),
              type: type as SearchResult['type'],
              href,
            };
          });
          setResults(items.slice(0, 12));
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  if (!open) return null;

  return (
    <div
      role="dialog" aria-modal="true" aria-label="Search"
      style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 80 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(6px)' }} onClick={onClose} />
      <div style={{
        position: 'relative', width: '100%', maxWidth: 560,
        background: 'var(--bg-2)', border: '1px solid var(--line-2)',
        borderRadius: 14, boxShadow: '0 16px 48px rgba(0,0,0,.5)',
        overflow: 'hidden',
      }}>
        {/* Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: results.length > 0 || loading ? '1px solid var(--line)' : 'none' }}>
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
            placeholder="Search tracks, artists, shows…"
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              fontFamily: 'var(--f-b)', fontSize: 16, color: 'var(--ink)',
            }}
          />
          {query && <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 18, lineHeight: 1 }}>×</button>}
          <kbd style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-3)', border: '1px solid var(--line-2)', borderRadius: 4, padding: '2px 6px' }}>esc</kbd>
        </div>

        {/* Results */}
        {loading && <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'var(--f-m)', fontSize: 13, color: 'var(--ink-3)' }}>Searching…</div>}
        {!loading && results.length > 0 && (
          <div>
            {results.map(r => (
              <div key={r.id}
                onClick={() => { if (r.href) window.location.href = r.href; onClose(); }}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', cursor: 'pointer', borderBottom: '1px solid var(--line)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.03)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: r.type === 'track' ? 'var(--accent)' : r.type === 'show' ? '#22e5d4' : r.type === 'genre' ? '#ffb84a' : '#b983ff' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--f-b)', fontSize: 14, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</div>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{r.sub} · {r.type}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        {!loading && query && results.length === 0 && (
          <div style={{ padding: '24px 18px', fontFamily: 'var(--f-b)', fontSize: 14, color: 'var(--ink-3)', textAlign: 'center' }}>No results for &quot;{query}&quot;</div>
        )}
        {!query && (
          <div style={{ padding: '20px 18px', fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.06em' }}>
            Try: artist name, track title, venue, show…
          </div>
        )}
      </div>
    </div>
  );
}
