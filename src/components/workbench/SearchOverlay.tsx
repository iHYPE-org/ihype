'use client';

import React, { useState, useEffect, useRef } from 'react';

interface SearchResult {
  id: string;
  label: string;
  sub: string;
  type: 'track' | 'show' | 'artist' | 'genre';
  href?: string;
}

const GENRE_SUGGESTIONS = ['Hip-Hop', 'Electronic', 'R&B', 'Indie', 'Jazz', 'Soul', 'House', 'Punk'];

interface QuickAction {
  id: string;
  label: string;
  sub: string;
  icon: React.ReactNode;
  view?: string;
  href?: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'fan-page',
    label: 'Fan Page',
    sub: 'Build or edit your fan page with AI',
    icon: <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="12" height="12" rx="2"/><path d="M5 6h6M5 9h4"/><circle cx="11.5" cy="10.5" r="1.5" fill="currentColor" stroke="none"/></svg>,
    view: 'pagestudio',
  },
  {
    id: 'artist-page',
    label: 'Artist Page',
    sub: 'Edit your artist profile and page',
    icon: <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="12" height="12" rx="2"/><path d="M5 6h6M5 9h4"/><circle cx="11.5" cy="10.5" r="1.5" fill="currentColor" stroke="none"/></svg>,
    view: 'artistpage',
  },
  {
    id: 'seeds',
    label: 'Seeds',
    sub: 'Discover new music to hype',
    icon: <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2c2 3 4 4 4 7a4 4 0 1 1-8 0c0-3 2-4 4-7Z"/></svg>,
    view: 'seeds',
  },
  {
    id: 'radio',
    label: 'Radio',
    sub: 'Listen to live and recorded radio shows',
    icon: <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="6"/><circle cx="8" cy="8" r="2.5"/><circle cx="8" cy="8" r=".6" fill="currentColor"/></svg>,
    view: 'radio',
  },
  {
    id: 'studio',
    label: 'Studio',
    sub: 'Upload and manage your music',
    icon: <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="12" height="8" rx="1.5"/><path d="M5 8h1M8 6v4M11 7v2"/></svg>,
    view: 'studio',
  },
  {
    id: 'tickets',
    label: 'Ticketing',
    sub: 'Manage events and ticket sales',
    icon: <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M2 6a1.5 1.5 0 0 0 0 3v3h12V9a1.5 1.5 0 0 0 0-3V3H2v3Z"/><path d="M9 3v10" strokeDasharray="1.4 1.4"/></svg>,
    view: 'tickets',
  },
];

function navigate(action: QuickAction, onClose: () => void) {
  onClose();
  if (action.href) {
    window.location.href = action.href;
  } else if (action.view) {
    (window as Window & { __ihypeNav?: (v: string) => void }).__ihypeNav?.(action.view);
  }
}

export function SearchOverlay({ open, onClose, activeProfileTypes }: { open: boolean; onClose: () => void; activeProfileTypes?: string[] }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [apiGenres, setApiGenres] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setApiGenres([]);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) { setResults([]); setApiGenres([]); return; }
    setLoading(true);
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (!d) return;
          const items: SearchResult[] = (d.results ?? []).map((r: Record<string, unknown>) => {
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
          setApiGenres(Array.isArray(d.genres) ? d.genres : []);
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
      style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 'min(80px, 10vh)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(6px)' }} onClick={onClose} />
      <div style={{
        position: 'relative', width: '100%', maxWidth: 560,
        background: 'var(--bg-2)', border: '1px solid var(--line-2)',
        borderRadius: 16, boxShadow: '0 16px 48px rgba(0,0,0,.5)', animation: 'fadeIn .2s ease-out both',
        overflow: 'hidden', maxHeight: 'calc(100dvh - 100px)', display: 'flex', flexDirection: 'column',
      }}>
        {/* Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: results.length > 0 || loading ? '1px solid var(--line)' : 'none' }}>
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ color: 'var(--ink-3)' }}><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
            placeholder="Search tracks, artists, shows…"
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              fontFamily: 'var(--f-b)', fontSize: 15, color: 'var(--ink)',
            }}
          />
          {query && <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 18, lineHeight: 1 }}>×</button>}
          <kbd style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-3)', border: '1px solid var(--line-2)', borderRadius: 4, padding: '2px 6px' }}>esc</kbd>
        </div>

        {/* Scrollable results area */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
        {/* Results */}
        {loading && <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'var(--f-m)', fontSize: 13, color: 'var(--ink-3)' }}>Searching…</div>}
        {!loading && results.length > 0 && (
          <div>
            {results.map(r => (
              <div key={r.id}
                onClick={() => { if (r.href) window.location.href = r.href; onClose(); }}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', cursor: 'pointer', borderBottom: '1px solid var(--line)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,80,41,.05)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--f-b)', fontSize: 14, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</div>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{r.sub}</div>
                </div>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', padding: '2px 7px', borderRadius: 99,
                  fontFamily: 'var(--f-m)', fontSize: 10, fontWeight: 700, letterSpacing: '.08em', flexShrink: 0,
                  background: r.type === 'track' ? 'rgba(255,80,41,.15)' : r.type === 'show' ? 'rgba(34,229,212,.12)' : r.type === 'genre' ? 'rgba(255,184,74,.12)' : 'rgba(185,131,255,.12)',
                  color: r.type === 'track' ? 'var(--accent)' : r.type === 'show' ? '#22e5d4' : r.type === 'genre' ? '#ffb84a' : '#b983ff',
                  border: `1px solid ${r.type === 'track' ? 'rgba(255,80,41,.25)' : r.type === 'show' ? 'rgba(34,229,212,.2)' : r.type === 'genre' ? 'rgba(255,184,74,.2)' : 'rgba(185,131,255,.2)'}`,
                }}>{r.type}</span>
              </div>
            ))}
          </div>
        )}
        {!loading && query && results.length === 0 && (
          <div style={{ padding: '20px 18px' }}>
            <div style={{ fontFamily: 'var(--f-b)', fontSize: 14, color: 'var(--ink-3)', textAlign: 'center', marginBottom: 14 }}>
              No matches for &quot;{query}&quot; — try a genre
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, justifyContent: 'center' }}>
              {(apiGenres.length > 0 ? apiGenres : GENRE_SUGGESTIONS).map(g => (
                <button
                  key={g}
                  onClick={() => setQuery(g)}
                  style={{
                    padding: '5px 13px', borderRadius: 99, cursor: 'pointer',
                    fontFamily: 'var(--f-m)', fontSize: 12, fontWeight: 700, letterSpacing: '.06em',
                    background: 'rgba(255,184,74,.1)', color: '#ffb84a',
                    border: '1px solid rgba(255,184,74,.25)',
                  }}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        )}
        {!query && (
          <div>
            <div style={{ padding: '12px 18px 6px', fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-4)', letterSpacing: '.1em', textTransform: 'uppercase' }}>Quick Navigation</div>
            {QUICK_ACTIONS.filter(a => {
              if (a.id === 'artist-page') return activeProfileTypes?.includes('ARTIST') || activeProfileTypes?.includes('DJ');
              return true;
            }).map(action => (
              <div key={action.id}
                onClick={() => navigate(action, onClose)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px', cursor: 'pointer', borderBottom: '1px solid var(--line)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,80,41,.05)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ color: 'var(--ink-3)', flexShrink: 0 }}>{action.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--f-b)', fontSize: 14, color: 'var(--ink)' }}>{action.label}</div>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{action.sub}</div>
                </div>
                <svg width={12} height={12} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ color: 'var(--ink-4)', flexShrink: 0 }}><path d="M6 3l5 5-5 5"/></svg>
              </div>
            ))}
            <div style={{ padding: '10px 18px 14px', fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.04em' }}>
              Or search: <strong style={{ color: 'var(--ink-2)' }}>artist name</strong>, track title, venue, show…
            </div>
          </div>
        )}
        </div>{/* end scrollable */}
      </div>
    </div>
  );
}
