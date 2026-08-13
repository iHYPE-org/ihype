'use client';

import { Suspense, useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useI18n } from '@/components/I18nProvider';

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

/**
 * Where a result actually lives, or `null` when it cannot be addressed.
 *
 * Two fixes here, both of the same shape: a link that goes somewhere it does
 * not mean.
 *
 * 1. A genre result used to open `/listen?genre=`. `/listen` has been a
 *    REDIRECT since DESIGN_SYNC row 273 and drops the query, so every genre
 *    search in the product has silently landed on an unfiltered page.
 *    `/discover` reads `params.genre` for real, so that is where they go.
 * 2. A result with no slug used to return `'#'`. That is not a link to
 *    nothing, it is a link to the top of the current page — indistinguishable
 *    from a broken click. It now returns `null` and the row renders as plain
 *    text, which is honest about there being nowhere to go.
 */
function resultHref(r: ResultItem): string | null {
  if (r.type === 'venue') return r.slug ? `/venues/${r.slug}` : null;
  if (r.type === 'promoter') return r.slug ? `/artists/${r.slug}` : null;
  if (r.type === 'artist') return r.slug ? `/artists/${r.slug}` : null;
  if (r.type === 'show') return r.slug ? `/shows/${r.slug}` : null;
  if (r.type === 'song') return `/tracks/${r.id}`;
  if (r.type === 'genre') return `/discover?genre=${encodeURIComponent(r.name)}`;
  return null;
}

const ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  gap: 16,
  alignItems: 'center',
  padding: '14px 16px',
  border: '1px solid var(--line)',
  borderRadius: 8,
  background: 'var(--bg2)',
  marginBottom: 10,
  textDecoration: 'none',
  color: 'inherit',
};

/**
 * One result row. The three result lists rendered this identically apart from
 * the icon, so the unaddressable-result handling would have had to be written
 * three times and kept in step; it is written once instead.
 */
function ResultRow({ r, icon }: { r: ResultItem; icon: 'note' | 'ticket' }) {
  const c = resultColor(r);
  const href = resultHref(r);
  const body = (
    <>
      <div style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg,${c}40,transparent)` }}>
        {icon === 'ticket' ? <TicketIcon c={c} /> : <NoteIcon c={c} />}
      </div>
      <div>
        <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '0.9375rem', fontWeight: 800, marginBottom: 2, color: 'var(--ink)' }}>{r.name}</h4>
        <p style={{ fontSize: '0.75rem', color: 'var(--ink-a55)' }}>{r.subtitle}</p>
      </div>
    </>
  );
  if (!href) return <div style={ROW_STYLE}>{body}</div>;
  return <Link href={href} style={ROW_STYLE}>{body}</Link>;
}

function resultColor(r: ResultItem): string {
  if (r.type === 'venue') return 'var(--role-venue)';
  if (r.type === 'promoter') return 'var(--role-promoter)';
  if (r.type === 'song') return 'var(--role-fan)';
  return 'var(--role-artist)';
}

const API_TYPE: Record<Filter, string> = { all: 'all', artists: 'artist', shows: 'show', tracks: 'song' };

function SearchPageInner() {
  const { t } = useI18n();
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

  const FILTER_LABEL: Record<Filter, string> = {
    all: t('searchPage.filterAll', 'All'),
    artists: t('searchPage.filterArtists', 'Artists'),
    shows: t('searchPage.filterShows', 'Shows'),
    tracks: t('searchPage.filterTracks', 'Tracks'),
  };

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
          placeholder={t('searchPage.searchPlaceholder', 'Artists, shows, tracks…')}
          style={{
            width: '100%', padding: '14px 16px 14px 46px', border: '1px solid var(--hair-120)',
            borderRadius: 10, background: 'var(--bg2)', color: 'var(--ink)', fontSize: '1rem', transition: 'all 150ms',
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
              background: filter === f ? 'var(--accent)' : 'var(--hair-50)',
              border: `1px solid ${filter === f ? 'var(--accent)' : 'var(--hair-100)'}`,
              color: filter === f ? 'var(--ink-on-accent)' : 'var(--ink-a75)',
              fontSize: '0.8125rem', fontWeight: 500, cursor: 'pointer', transition: 'all 150ms',
            }}
          >
            {FILTER_LABEL[f]}
          </div>
        ))}
      </div>

      {isPending && (
        <p style={{ color: 'var(--ink-a35)', fontSize: '0.8125rem', fontFamily: 'var(--font-mono)' }}>{t('searchPage.searching', 'Searching…')}</p>
      )}

      {!q && (
        <div>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '.14em', color: 'var(--ink-a55)', marginBottom: 14, marginTop: 32 }}>{t('searchPage.trending', 'Trending')}</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {TRENDING.map((term) => (
              <div
                key={term}
                onClick={() => handleSearch(term)}
                style={{ padding: '8px 14px', borderRadius: 8, background: 'var(--bg2)', border: '1px solid var(--line)', fontSize: '0.8125rem', color: 'var(--ink-a75)', cursor: 'pointer', transition: 'all 150ms' }}
              >
                {term}
              </div>
            ))}
          </div>
        </div>
      )}

      {q && !isPending && !hasResults && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--ink-a50)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--ink-a30)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
          </div>
          <p>{t('searchPage.noResultsPrefix', 'No results for')} &quot;{q}&quot;</p>
        </div>
      )}

      {q && hasResults && (
        <div>
          {show('artists') && artists.length > 0 && (
            <div>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '.14em', color: 'var(--ink-a55)', marginBottom: 14, marginTop: 32 }}>{FILTER_LABEL.artists}</p>
              {artists.map((r) => (
                <ResultRow icon="note" key={r.id} r={r} />
              ))}
            </div>
          )}

          {show('shows') && shows.length > 0 && (
            <div>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '.14em', color: 'var(--ink-a55)', marginBottom: 14, marginTop: 32 }}>{FILTER_LABEL.shows}</p>
              {shows.map((r) => (
                <ResultRow icon="ticket" key={r.id} r={r} />
              ))}
            </div>
          )}

          {show('tracks') && tracks.length > 0 && (
            <div>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '.14em', color: 'var(--ink-a55)', marginBottom: 14, marginTop: 32 }}>{FILTER_LABEL.tracks}</p>
              {tracks.map((r) => (
                <ResultRow icon="note" key={r.id} r={r} />
              ))}
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
