'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { FollowButton } from '@/components/FollowButton';
import { MobileQuickGrid, type QuickGridItem } from '@/components/MobileQuickGrid';
import { PageEditor } from '@/components/PageEditor';
import { PageRoleModules } from '@/components/PageRoleModules';
import { PullToRefresh } from '@/components/PullToRefresh';
import { useMobileShell } from '@/lib/MobileShellContext';

const TYPE_COLOR: Record<string, string> = {
  ARTIST: '#ff5029',
  DJ: '#ff3e9a',
  VENUE: '#22e5d4',
  LISTENER: '#b983ff',
};

const TYPE_LABEL: Record<string, string> = {
  ARTIST: 'Artist',
  DJ: 'Promoter / DJ',
  VENUE: 'Venue',
  LISTENER: 'Fan',
};

const profileRoute = (type: string, slug: string) =>
  type === 'VENUE' ? `/venues/${slug}` : type === 'DJ' ? `/promoters/${slug}` : `/artists/${slug}`;

const TABS = [
  { id: 'search', label: 'Search' },
  { id: 'mypage', label: 'My Page' },
  { id: 'network', label: 'Network' },
  { id: 'creator', label: 'Creator' },
] as const;

type TabId = (typeof TABS)[number]['id'];

type SearchResult = {
  type: 'artist' | 'venue' | 'promoter' | 'song' | 'show' | 'genre';
  id: string;
  name: string;
  subtitle: string;
  slug?: string;
};

const NET_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'ARTIST', label: 'Artists' },
  { id: 'VENUE', label: 'Venues' },
  { id: 'DJ', label: 'DJs' },
  { id: 'LISTENER', label: 'Fans' },
] as const;

const CREATE_CARDS: { type: string; color: string; bg: string; name: string; desc: string; icon: React.ReactNode }[] = [
  {
    type: 'ARTIST', color: '#ff5029', bg: 'rgba(255,80,41,.12)', name: 'Artist Page',
    desc: 'Upload tracks, list shows, sell tickets. Keep 45%.',
    icon: (
      <svg fill="none" height="20" stroke="#ff5029" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24" width="20">
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
    ),
  },
  {
    type: 'VENUE', color: '#22e5d4', bg: 'rgba(34,229,212,.1)', name: 'Venue Page',
    desc: 'Book from the demand radar. Keep 45% of every room.',
    icon: (
      <svg fill="none" height="20" stroke="#22e5d4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24" width="20">
        <path d="M3 21h18" />
        <path d="M5 21V7l8-4v18" />
        <path d="M19 21V11l-6-4" />
      </svg>
    ),
  },
  {
    type: 'DJ', color: '#ff3e9a', bg: 'rgba(255,62,154,.1)', name: 'DJ Page',
    desc: 'Host radio shows, build a crate, earn promoter cuts.',
    icon: (
      <svg fill="none" height="20" stroke="#ff3e9a" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24" width="20">
        <circle cx="12" cy="12" r="2" />
        <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" />
      </svg>
    ),
  },
];

const b: React.CSSProperties = {
  fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 13, padding: '10px 18px',
  borderRadius: 9, cursor: 'pointer', border: 'none', textDecoration: 'none',
  display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
};
const bSolid: React.CSSProperties = { ...b, background: 'var(--accent)', color: '#fff' };
const bGhost: React.CSSProperties = { ...b, background: 'transparent', color: 'var(--ink-a70)', boxShadow: 'inset 0 0 0 1px var(--line-2)' };

function hexA(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

type Profile = { id: string; slug: string; name: string; type: string; hexId: string; owner?: { username: string | null } };
type NetProfile = { id: string; slug: string; name: string; type: string; city: string | null; genres: string[] };

type PagesData = {
  myProfiles: Profile[];
  following: NetProfile[];
  followersCount: number;
  suggested: NetProfile[];
  mutualCount: number;
};

export function PagesHome({ initialTab, isShellForeground = true, resetToken }: { initialTab?: string; isShellForeground?: boolean; resetToken?: number } = {}) {
  const shell = useMobileShell();
  const validInitialTab = TABS.some((t) => t.id === initialTab) ? (initialTab as TabId) : null;
  const [tab, setTab] = useState<TabId>(validInitialTab ?? 'mypage');
  const [gridMode, setGridMode] = useState(!validInitialTab);
  const prevResetToken = useRef(resetToken);
  useEffect(() => {
    if (resetToken !== undefined && resetToken !== prevResetToken.current) {
      prevResetToken.current = resetToken;
      setGridMode(true);
    }
  }, [resetToken]);
  const [netFilter, setNetFilter] = useState<(typeof NET_FILTERS)[number]['id']>('all');
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [data, setData] = useState<PagesData | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [q, setQ] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [creatingType, setCreatingType] = useState<string | null>(null);
  const [creatingName, setCreatingName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [justCreatedName, setJustCreatedName] = useState<string | null>(null);
  const contentTopRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    contentTopRef.current?.scrollIntoView({ block: 'start' });
  }, [tab]);

  const refreshAll = useCallback(() => {
    return fetch('/api/pages/home')
      .then((r) => {
        if (r.status === 401) { setSignedOut(true); return null; }
        return r.json();
      })
      .then((d) => { if (d) setData(d); })
      .catch(() => setData({ myProfiles: [], following: [], followersCount: 0, suggested: [], mutualCount: 0 }));
  }, []);

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addProfile(type: string) {
    const name = creatingName.trim();
    if (!name) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: type, name }),
      });
      const created = await res.json();
      if (!res.ok) {
        setCreateError(created.error ?? 'Could not create page.');
        return;
      }
      setData((prev) =>
        prev && !prev.myProfiles.some((p) => p.id === created.id)
          ? { ...prev, myProfiles: [...prev.myProfiles, created] }
          : prev
      );
      setSelectedPageId(created.id);
      void refreshAll();
      setCreatingType(null);
      setCreatingName('');
      setJustCreatedName(created.name ?? name);
      contentTopRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      setTimeout(() => setJustCreatedName(null), 6000);
    } catch {
      setCreateError('Network error — try again.');
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => {
    const ql = q.trim();
    if (!ql) { setSearchResults(null); return; }
    const handle = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(ql)}&type=artist`).then((r) => r.json()).then((d) => setSearchResults(d.results ?? [])).catch(() => setSearchResults([]));
    }, 250);
    return () => clearTimeout(handle);
  }, [q]);

  const myProfiles = data?.myProfiles ?? [];
  const following = data?.following ?? [];
  const followersCount = data?.followersCount ?? 0;
  const suggested = data?.suggested ?? [];
  const mutualCount = data?.mutualCount ?? 0;

  const netMatch = (type: string) => netFilter === 'all' || netFilter === type;
  const netListShown = following.filter((p) => netMatch(p.type));
  const netSuggestShown = suggested.filter((p) => netMatch(p.type));

  const selectedProfile = myProfiles.find((p) => p.id === selectedPageId) ?? myProfiles[0] ?? null;

  const gridItems: QuickGridItem[] = [
    {
      id: 'mypage', label: 'My Page', color: '#ff5029', sublabel: `${myProfiles.length} page${myProfiles.length === 1 ? '' : 's'}`,
      icon: <svg fill="none" height="30" stroke="#ff5029" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24" width="30"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /></svg>,
    },
    {
      id: 'network', label: 'Network', color: '#22e5d4', sublabel: `${following.length} following`,
      icon: <svg fill="none" height="30" stroke="#22e5d4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24" width="30"><circle cx="8" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M2 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><path d="M14.5 14.2c2.5.4 4.5 2.6 4.5 5.3" /></svg>,
    },
    {
      id: 'creator', label: 'Creator', color: '#ff3e9a', sublabel: 'Add a page',
      icon: <svg fill="none" height="30" stroke="#ff3e9a" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24" width="30"><line x1="12" x2="12" y1="5" y2="19" /><line x1="5" x2="19" y1="12" y2="12" /></svg>,
    },
    {
      id: 'settings', label: 'Settings', color: '#b983ff', sublabel: 'Account & privacy', href: '/me/settings',
      icon: (
        <svg fill="none" height="30" stroke="#b983ff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24" width="30">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      ),
    },
  ];

  if (signedOut) {
    return (
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px 100px', textAlign: 'center' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, marginBottom: 10 }}>Sign in to see your pages</h1>
        <Link href="/login?callbackUrl=/pages" style={bSolid}>Log in</Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px 100px' }}>
      <MobileQuickGrid
        active={gridMode && isShellForeground}
        items={gridItems}
        onSearchTap={() => { setGridMode(false); setTab('search'); }}
        onSelect={(id) => { setGridMode(false); setTab(id as TabId); }}
        onSwipeSection={shell?.swipeSection}
        searchPlaceholder="Search artists, venues, shows…"
      />

      <PullToRefresh onRefresh={refreshAll}>
      <div className={`mqg-content${gridMode ? ' is-hidden' : ''}`}>
      <div ref={contentTopRef} />
      <button className="mqg-back" onClick={() => setGridMode(true)} type="button">
        <svg fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="18"><polyline points="15 18 9 12 15 6" /></svg>
        Pages
      </button>

      <h1 className="sr-only">Pages</h1>

      <nav className="mqg-tabstrip" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 26 }} aria-label="Pages sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? 'sub-tab active' : 'sub-tab'}
            onClick={() => setTab(t.id)}
            type="button"
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'search' && (
        <div className="sub-panel">
          <div style={{ position: 'relative', marginBottom: 22 }}>
            <svg fill="none" height="16" stroke="var(--ink-a50)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} viewBox="0 0 24 24" width="16">
              <circle cx="11" cy="11" r="8" /><line x1="21" x2="16.65" y1="21" y2="16.65" />
            </svg>
            <input
              autoFocus
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search artists, venues, shows…"
              style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: '14px 16px 14px 46px', color: 'var(--ink)', fontFamily: 'var(--font-body)', fontSize: 16 }}
              type="text"
              value={q}
            />
          </div>
          {!q.trim() ? (
            <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--ink-a50)' }}>
              <p>Find an artist, venue, or DJ page.</p>
            </div>
          ) : searchResults === null ? (
            <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--ink-a50)' }}><p>Loading…</p></div>
          ) : searchResults.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--ink-a50)' }}><p>No results for &ldquo;{q}&rdquo;.</p></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {searchResults.map((r) => {
                const color = r.type === 'venue' ? '#22e5d4' : r.type === 'promoter' ? '#ff3e9a' : '#ff5029';
                const label = r.type === 'venue' ? 'Venue' : r.type === 'promoter' ? 'Promoter / DJ' : 'Artist';
                const route = r.type === 'venue' ? `/venues/${r.slug}` : r.type === 'promoter' ? `/promoters/${r.slug}` : `/artists/${r.slug}`;
                const initials = r.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
                return (
                  <Link key={r.id} href={route} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', border: '1px solid var(--line)', borderRadius: 14, background: 'rgba(255,255,255,.03)', textDecoration: 'none', color: 'inherit' }}>
                    <div style={{
                      width: 46, height: 46, borderRadius: 9999, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, color: '#fff',
                      background: `linear-gradient(135deg, ${color}, ${hexA(color, 0.55)})`,
                    }}>
                      {initials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 800, letterSpacing: '-.01em', display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '.1em', textTransform: 'uppercase', padding: '2px 6px', borderRadius: 4, color, background: hexA(color, 0.14), flexShrink: 0 }}>
                          {label}
                        </span>
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink-a50)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.subtitle}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'mypage' && (
        <div className="sub-panel">
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--ink-a35)', marginBottom: 14 }}>
            YOUR PAGES
          </div>

          {data === null ? (
            <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--ink-a50)' }}><p>Loading your pages…</p></div>
          ) : myProfiles.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 0' }}>
              <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, marginBottom: 8, color: 'var(--ink)' }}>
                No pages yet
              </p>
              <p style={{ fontSize: 14, color: 'var(--ink-a50)', marginBottom: 24 }}>
                Create an artist, venue, or promoter page to get started.
              </p>
              <button onClick={() => setTab('creator')} style={{ display: 'inline-block', padding: '12px 24px', background: 'var(--accent)', color: '#fff', borderRadius: 8, fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer' }} type="button">
                Create your first page →
              </button>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
                {myProfiles.map((p) => {
                  const color = TYPE_COLOR[p.type] ?? '#ff5029';
                  const selected = selectedProfile?.id === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedPageId(p.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '11px 15px 11px 12px',
                        borderRadius: 12, cursor: 'pointer',
                        background: selected ? hexA(color, 0.1) : 'rgba(255,255,255,.03)',
                        border: `1px solid ${selected ? color : 'rgba(255,255,255,.1)'}`,
                        boxShadow: selected ? `0 0 0 1px ${color} inset` : 'none',
                      }}
                    >
                      <div style={{
                        width: 30, height: 30, borderRadius: 9999, flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14, color: '#fff',
                        background: color,
                      }}>
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color }}>
                          {TYPE_LABEL[p.type] ?? p.type}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{p.name}</span>
                      </div>
                    </div>
                  );
                })}
                <button
                  onClick={() => setTab('creator')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7, padding: '11px 16px', borderRadius: 12,
                    background: 'transparent', border: '1px dashed rgba(255,255,255,.18)', cursor: 'pointer',
                    color: 'var(--ink-a55)', fontSize: 13, fontWeight: 600,
                  }}
                  type="button"
                >
                  + New page
                </button>
              </div>

              {selectedProfile && (
                <div style={{
                  borderRadius: 18, padding: 24, marginBottom: 36,
                  display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
                  border: `1px solid ${hexA(TYPE_COLOR[selectedProfile.type] ?? '#ff5029', 0.3)}`,
                  background: hexA(TYPE_COLOR[selectedProfile.type] ?? '#ff5029', 0.07),
                }}>
                  <div style={{
                    width: 72, height: 72, borderRadius: 9999, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, color: '#fff',
                    background: TYPE_COLOR[selectedProfile.type] ?? '#ff5029',
                  }}>
                    {selectedProfile.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase',
                      marginBottom: 5, color: TYPE_COLOR[selectedProfile.type] ?? '#ff5029',
                    }}>
                      {(TYPE_LABEL[selectedProfile.type] ?? selectedProfile.type).toUpperCase()} PAGE
                    </div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, letterSpacing: '-.02em', marginBottom: 3 }}>
                      {selectedProfile.name}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--ink-a50)' }}>
                      @{selectedProfile.owner?.username ?? selectedProfile.hexId} · iHYPE
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <Link href={profileRoute(selectedProfile.type, selectedProfile.slug)} style={bGhost}>
                      View
                    </Link>
                    <button onClick={() => setTab('creator')} style={bSolid} type="button">
                      Edit page
                    </button>
                  </div>
                </div>
              )}

              {selectedProfile && (
                <PageRoleModules
                  key={selectedProfile.id}
                  color={TYPE_COLOR[selectedProfile.type] ?? '#ff5029'}
                  profile={selectedProfile}
                />
              )}
            </>
          )}

        </div>
      )}

      {tab === 'network' && (
        <div className="sub-panel">
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--ink-a35)', marginBottom: 14 }}>
            YOUR NETWORK
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 18 }}>
            <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid var(--line)', borderRadius: 14, padding: 16, textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, letterSpacing: '-.02em', marginBottom: 5 }}>
                {String(following.length).padStart(2, '0')}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-a50)' }}>Following</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid var(--line)', borderRadius: 14, padding: 16, textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, letterSpacing: '-.02em', marginBottom: 5 }}>
                {String(followersCount).padStart(2, '0')}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-a50)' }}>Followers</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid var(--line)', borderRadius: 14, padding: 16, textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, letterSpacing: '-.02em', marginBottom: 5 }}>
                {String(mutualCount).padStart(2, '0')}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-a50)' }}>Mutuals</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {NET_FILTERS.map((f) => (
              <div
                key={f.id}
                onClick={() => setNetFilter(f.id)}
                style={{
                  fontSize: 12, padding: '7px 14px', borderRadius: 9999, cursor: 'pointer',
                  background: netFilter === f.id ? 'rgba(255,80,41,.12)' : 'rgba(255,255,255,.03)',
                  border: `1px solid ${netFilter === f.id ? 'rgba(255,80,41,.4)' : 'rgba(255,255,255,.1)'}`,
                  color: netFilter === f.id ? 'var(--ink)' : 'var(--ink-a60)',
                }}
              >
                {f.label}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 32 }}>
            {netListShown.length === 0 ? (
              <div style={{ color: 'var(--ink-a50)', fontSize: 13, padding: '10px 2px' }}>No connections match.</div>
            ) : (
              netListShown.map((p) => {
                const color = TYPE_COLOR[p.type] ?? '#ff5029';
                const initials = p.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
                return (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', border: '1px solid var(--line)', borderRadius: 14, background: 'rgba(255,255,255,.03)' }}>
                    <Link href={profileRoute(p.type, p.slug)} style={{
                      width: 46, height: 46, borderRadius: 9999, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, color: '#fff',
                      background: `linear-gradient(135deg, ${color}, ${hexA(color, 0.55)})`, textDecoration: 'none',
                    }}>
                      {initials}
                    </Link>
                    <Link href={profileRoute(p.type, p.slug)} style={{ flex: 1, minWidth: 0, textDecoration: 'none', color: 'inherit' }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 800, letterSpacing: '-.01em', display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '.1em', textTransform: 'uppercase', padding: '2px 6px', borderRadius: 4, color, background: hexA(color, 0.14), flexShrink: 0 }}>
                          {TYPE_LABEL[p.type] ?? p.type}
                        </span>
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink-a50)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.genres[0] ? `${p.genres[0]} · ` : ''}{p.city ?? ''}
                      </div>
                    </Link>
                    <div style={{ width: 100, flexShrink: 0 }}>
                      <FollowButton profileId={p.id} />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '8px 0 12px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--ink-a35)' }}>
              SUGGESTED FOR YOU
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 32 }}>
            {netSuggestShown.length === 0 ? (
              <div style={{ color: 'var(--ink-a50)', fontSize: 13, padding: '10px 2px' }}>No suggestions match.</div>
            ) : (
              netSuggestShown.map((p) => {
                const color = TYPE_COLOR[p.type] ?? '#ff5029';
                const initials = p.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
                return (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', border: '1px solid var(--line)', borderRadius: 14, background: 'rgba(255,255,255,.03)' }}>
                    <Link href={profileRoute(p.type, p.slug)} style={{
                      width: 46, height: 46, borderRadius: 9999, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, color: '#fff',
                      background: `linear-gradient(135deg, ${color}, ${hexA(color, 0.55)})`, textDecoration: 'none',
                    }}>
                      {initials}
                    </Link>
                    <Link href={profileRoute(p.type, p.slug)} style={{ flex: 1, minWidth: 0, textDecoration: 'none', color: 'inherit' }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 800, letterSpacing: '-.01em', display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '.1em', textTransform: 'uppercase', padding: '2px 6px', borderRadius: 4, color, background: hexA(color, 0.14), flexShrink: 0 }}>
                          {TYPE_LABEL[p.type] ?? p.type}
                        </span>
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink-a50)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.genres[0] ? `${p.genres[0]} · ` : ''}{p.city ?? ''}
                      </div>
                    </Link>
                    <div style={{ width: 100, flexShrink: 0 }}>
                      <FollowButton profileId={p.id} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {tab === 'creator' && (
        <div className="sub-panel">
          {justCreatedName && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', marginBottom: 18,
              borderRadius: 12, border: '1px solid rgba(34,229,212,.3)', background: 'rgba(34,229,212,.08)',
              color: '#22e5d4', fontSize: 13, fontWeight: 600,
            }}>
              ✓ &ldquo;{justCreatedName}&rdquo; page created — saved to your account. Edit it below.
            </div>
          )}
          {selectedProfile && (
            <>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--ink-a35)', marginBottom: 14 }}>
                EDITING · {(TYPE_LABEL[selectedProfile.type] ?? selectedProfile.type).toUpperCase()}
              </div>
              <PageEditor key={selectedProfile.id} profileId={selectedProfile.id} />
              <div style={{ borderTop: '1px solid rgba(255,255,255,.07)', margin: '36px 0 22px' }} />
            </>
          )}

          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--ink-a35)', marginBottom: 14 }}>
            {selectedProfile ? 'ADD ANOTHER PAGE' : 'PAGE CREATOR'}
          </div>
          <div className="pages-create-grid">
            {CREATE_CARDS.map((card) => {
              const isCreating = creatingType === card.type;
              if (isCreating) {
                return (
                  <div key={card.type} style={{
                    border: `1px solid ${hexA(card.color, 0.35)}`, borderRadius: 14, padding: 20,
                    background: hexA(card.color, 0.06), display: 'flex', flexDirection: 'column', gap: 12,
                  }}>
                    <div style={{ width: 40, height: 40, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', background: card.bg }}>
                      {card.icon}
                    </div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 800, letterSpacing: '-.01em', color: card.color }}>
                      {card.name}
                    </div>
                    <input
                      autoFocus
                      disabled={creating}
                      onChange={(e) => setCreatingName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') addProfile(card.type); }}
                      placeholder={`${card.name} name`}
                      style={{ boxSizing: 'border-box', width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)', color: 'var(--ink)', fontFamily: 'var(--font-body)', fontSize: 14 }}
                      type="text"
                      value={creatingName}
                    />
                    {createError && <div style={{ fontSize: 12, color: '#ff5029' }}>{createError}</div>}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        disabled={creating || !creatingName.trim()}
                        onClick={() => addProfile(card.type)}
                        style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', background: card.color, color: '#fff', fontWeight: 700, fontSize: 13, cursor: creating ? 'default' : 'pointer', opacity: creating || !creatingName.trim() ? 0.6 : 1 }}
                        type="button"
                      >
                        {creating ? 'Creating…' : 'Create'}
                      </button>
                      <button
                        disabled={creating}
                        onClick={() => { setCreatingType(null); setCreatingName(''); setCreateError(null); }}
                        style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,.1)', background: 'transparent', color: 'var(--ink-a70)', fontSize: 13, cursor: 'pointer' }}
                        type="button"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                );
              }
              return (
                <button
                  key={card.type}
                  onClick={() => { setCreatingType(card.type); setCreatingName(''); setCreateError(null); }}
                  style={{
                    border: '1px solid rgba(255,255,255,.07)', borderRadius: 14, padding: 20,
                    background: 'rgba(255,255,255,.03)', textAlign: 'left', color: 'inherit', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', gap: 12, font: 'inherit',
                  }}
                  type="button"
                >
                  <div style={{ width: 40, height: 40, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', background: card.bg }}>
                    {card.icon}
                  </div>
                  <div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 800, letterSpacing: '-.01em', marginBottom: 3, color: card.color }}>
                      {card.name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink-a55)', lineHeight: 1.5 }}>{card.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
      </div>
      </PullToRefresh>
      <style>{`
        .pages-create-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; }
        @media (max-width: 640px) {
          .pages-create-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
