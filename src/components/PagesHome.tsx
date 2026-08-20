'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { TunerDial } from '@/components/TunerDial';
import Link from 'next/link';
import { FollowButton } from '@/components/FollowButton';
import { PageEditor } from '@/components/PageEditor';
import { PageRoleModules } from '@/components/PageRoleModules';
import { PullToRefresh } from '@/components/PullToRefresh';
import { useI18n } from '@/components/I18nProvider';

const TYPE_COLOR: Record<string, string> = {
  ARTIST: 'var(--role-artist)',
  VENUE: 'var(--role-venue)',
  LISTENER: 'var(--role-fan)',
};

const TYPE_LABEL: Record<string, string> = {
  ARTIST: 'Artist',
  VENUE: 'Venue',
  LISTENER: 'Fan',
};

const profileRoute = (type: string, slug: string) =>
  type === 'VENUE' ? `/venues/${slug}` : `/artists/${slug}`;

/**
 * Tab ids the app shell's context strip already carries for PAGES ('mypage' via
 * Tour Creator, 'creator' via Page Creator). Inside the shell they come off this
 * strip; 'search' and 'network' stay, because the strip does not carry them.
 */

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
  { id: 'LISTENER', label: 'Fans' },
] as const;

const CREATE_CARDS: { type: string; color: string; bg: string; name: string; desc: string; icon: React.ReactNode }[] = [
  {
    type: 'ARTIST', color: 'var(--accent-text)', bg: 'rgba(var(--accent-rgb),.12)', name: 'Artist Page',
    desc: 'Upload tracks, list shows, sell tickets. Keep 70%.',
    icon: (
      <svg fill="none" height="20" stroke="var(--accent)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24" width="20">
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
    ),
  },
  {
    type: 'VENUE', color: 'var(--role-venue)', bg: 'rgba(var(--role-venue-rgb),.1)', name: 'Venue Page',
    desc: 'Book from the demand radar. Keep 20% of every room.',
    icon: (
      <svg fill="none" height="20" stroke="var(--role-venue)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24" width="20">
        <path d="M3 21h18" />
        <path d="M5 21V7l8-4v18" />
        <path d="M19 21V11l-6-4" />
      </svg>
    ),
  },
  // No DJ card. The role is being removed (docs/dj-role-removal-scope.md) and
  // POST /api/profiles rejects it — radio is computed per listener now, and
  // "earn promoter cuts" is something every fan account already does through
  // HYPE links, with no page required.
];

const b: React.CSSProperties = {
  fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '0.9375rem', padding: '10px 18px',
  borderRadius: 9, cursor: 'pointer', border: 'none', textDecoration: 'none',
  display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
};
const bSolid: React.CSSProperties = { ...b, background: 'var(--accent)', color: 'var(--ink-on-accent)' };
const bGhost: React.CSSProperties = { ...b, background: 'transparent', color: 'var(--ink-a70)', boxShadow: 'inset 0 0 0 1px var(--line-2)' };

function hexA(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

type Profile = { id: string; slug: string; name: string; type: string; hexId: string; onboardedAt?: string | null; owner?: { username: string | null } };
type NetProfile = { id: string; slug: string; name: string; type: string; city: string | null; genres: string[] };

type PagesData = {
  myProfiles: Profile[];
  following: NetProfile[];
  followersCount: number;
  suggested: NetProfile[];
  mutualCount: number;
};

export function PagesHome({
  initialTab,
  initialProfileId,
  initialEditorSection,
  initialTool,
}: {
  initialTab?: string;
  initialProfileId?: string;
  initialEditorSection?: string;
  initialTool?: string;
} = {}) {
  const { t } = useI18n();
  const validInitialTab = TABS.some((t) => t.id === initialTab) ? (initialTab as TabId) : null;
  const [tab, setTab] = useState<TabId>(validInitialTab ?? 'mypage');
  // The app shell's context strip navigates between these tabs with real
  // links (/pages?tab=creator). Same route, different query = a soft nav, so
  // the useState initialiser above never re-runs and the tab would otherwise
  // stay put while its pill lit up.
  useEffect(() => {
    if (!validInitialTab) return;
    setTab(validInitialTab);
  }, [validInitialTab]);
  const visibleTabs = TABS;
  const [netFilter, setNetFilter] = useState<(typeof NET_FILTERS)[number]['id']>('all');
  const [selectedPageId, setSelectedPageId] = useState<string | null>(initialProfileId ?? null);
  const [data, setData] = useState<PagesData | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [q, setQ] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [creatingType, setCreatingType] = useState<string | null>(null);
  // The artist upload-policy attestation, collected here because this is where
  // upload rights are granted. It must be a real tick: sending `true` because
  // the role happens to be ARTIST would be a rubber stamp, not consent.
  const [acceptedUploadPolicy, setAcceptedUploadPolicy] = useState(false);
  const [creatingName, setCreatingName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [justCreatedName, setJustCreatedName] = useState<string | null>(null);
  const contentTopRef = useRef<HTMLDivElement>(null);

  // These are local tabs, not route navigation, so the shell's route scroll
  // manager never runs. `scrollIntoView()` was also the wrong primitive here:
  // it aligned the zero-height marker inside this component's 32px padding and
  // left `.mmm-pane` visibly scrolled down. Reset the actual scroll owner in
  // MMM, and fall back to the document when PagesHome is rendered elsewhere.
  useEffect(() => {
    const marker = contentTopRef.current;
    const pane = marker?.closest<HTMLElement>('.mmm-pane');
    if (pane) pane.scrollTo({ top: 0, behavior: 'auto' });
    else window.scrollTo({ top: 0, behavior: 'auto' });
  }, [tab]);

  useEffect(() => {
    if (initialProfileId) setSelectedPageId(initialProfileId);
  }, [initialProfileId]);

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
        // The artist upload-policy attestation moved here from signup, where
        // it was asked of every fan whether or not they would ever upload.
        // The confirm dialog below is what collects it.
        body: JSON.stringify({ role: type, name, acceptedArtistUploadPolicy: acceptedUploadPolicy }),
      });
      const created = await res.json();
      if (!res.ok) {
        setCreateError(created.error ?? t('pagesHome.createPageFailed', 'Could not create page.'));
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
      setAcceptedUploadPolicy(false);
      setJustCreatedName(created.name ?? name);
      contentTopRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      setTimeout(() => setJustCreatedName(null), 6000);
    } catch {
      setCreateError(t('pagesHome.networkError', 'Network error — try again.'));
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

  const typeLabel = (type: string) => t(`pagesHome.typeLabel.${type}`, TYPE_LABEL[type] ?? type);

  if (signedOut) {
    return (
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px 100px', textAlign: 'center' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.375rem', fontWeight: 800, marginBottom: 10 }}>{t('pagesHome.signedOutHeading', 'Sign in to see your pages')}</h1>
        <Link href="/login?callbackUrl=/pages" style={bSolid}>{t('pagesHome.logIn', 'Log in')}</Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px 100px' }}>
      <PullToRefresh onRefresh={refreshAll}>
      <div className="section-content">
      <div ref={contentTopRef} />
      <h1 className="sr-only">{t('pagesHome.pagesHeading', 'Dashboard')}</h1>

      {/* The tuner, not a strip of wrapping pills. This set can reach seven
          entries depending on the member's roles, which on a phone wrapped to
          two and sometimes three rows of 13px buttons before any content
          appeared. The dial is one row whatever the count. */}
      <TunerDial
        active={tab}
        label={t('pagesHome.tabstripAriaLabel', 'Pages sections')}
        onSelect={(id) => setTab(id as typeof tab)}
        stops={visibleTabs.map((tabItem) => ({
          id: tabItem.id,
          label: t(`pagesHome.tabLabel.${tabItem.id}`, tabItem.label),
        }))}
      />

      {tab === 'search' && (
        <div className="sub-panel">
          <div style={{ position: 'relative', marginBottom: 22 }}>
            <svg fill="none" height="16" stroke="var(--ink-a50)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} viewBox="0 0 24 24" width="16">
              <circle cx="11" cy="11" r="8" /><line x1="21" x2="16.65" y1="21" y2="16.65" />
            </svg>
            <input
              autoFocus
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('pagesHome.searchPlaceholder', 'Search artists, venues, shows…')}
              style={{ width: '100%', boxSizing: 'border-box', background: 'var(--hair-30)', border: '1px solid var(--hair-80)', borderRadius: 12, padding: '14px 16px 14px 46px', color: 'var(--ink)', fontFamily: 'var(--font-body)', fontSize: '1rem' }}
              type="text"
              value={q}
            />
          </div>
          {!q.trim() ? (
            <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--ink-a65)' }}>
              <p>{t('pagesHome.searchEmptyState', 'Find an artist or venue page.')}</p>
            </div>
          ) : searchResults === null ? (
            <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--ink-a65)' }}><p>{t('pagesHome.loading', 'Loading…')}</p></div>
          ) : searchResults.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--ink-a65)' }}><p>{t('pagesHome.noResultsFor', 'No results for')} &ldquo;{q}&rdquo;.</p></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {searchResults.map((r) => {
                const color = r.type === 'venue' ? 'var(--role-venue)' : r.type === 'promoter' ? 'var(--accent-2)' : 'var(--accent)';
                const label = r.type === 'venue' ? t('pagesHome.resultTypeVenue', 'Venue') : r.type === 'promoter' ? t('pagesHome.resultTypePromoter', 'Promoter / DJ') : t('pagesHome.resultTypeArtist', 'Artist');
                const route = r.type === 'venue' ? `/venues/${r.slug}` : r.type === 'promoter' ? `/artists/${r.slug}` : `/artists/${r.slug}`;
                const initials = r.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
                return (
                  <Link key={r.id} href={route} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', border: '1px solid var(--line)', borderRadius: 14, background: 'var(--hair-30)', textDecoration: 'none', color: 'inherit' }}>
                    <div style={{
                      width: 46, height: 46, borderRadius: 9999, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', color: 'var(--ink-on-accent)',
                      background: `linear-gradient(135deg, ${color}, ${hexA(color, 0.55)})`,
                    }}>
                      {initials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.9375rem', fontWeight: 800, letterSpacing: '-.01em', display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, flexWrap: 'wrap', rowGap: 4 }}>
                        <span style={{ flex: '1 1 auto', minWidth: '7ch', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9375rem', letterSpacing: '.1em', textTransform: 'uppercase', padding: '2px 6px', borderRadius: 4, color, background: hexA(color, 0.14), flexShrink: 0 }}>
                          {label}
                        </span>
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9375rem', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink-a65)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--ink-a65)', marginBottom: 14 }}>
            {t('pagesHome.yourPagesLabel', 'YOUR PAGES')}
          </div>

          {data === null ? (
            <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--ink-a65)' }}><p>{t('pagesHome.loadingPages', 'Loading your pages…')}</p></div>
          ) : myProfiles.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 0' }}>
              <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.25rem', marginBottom: 8, color: 'var(--ink)' }}>
                {t('pagesHome.noPagesYet', 'No pages yet')}
              </p>
              <p style={{ fontSize: '0.9375rem', color: 'var(--ink-a65)', marginBottom: 24 }}>
                {t('pagesHome.noPagesYetSub', 'Create an artist, venue, or promoter page to get started.')}
              </p>
              <button onClick={() => setTab('creator')} style={{ display: 'inline-block', padding: '12px 24px', background: 'var(--accent)', color: 'var(--ink-on-accent)', borderRadius: 8, fontWeight: 700, fontSize: '0.9375rem', border: 'none', cursor: 'pointer' }} type="button">
                {t('pagesHome.createFirstPage', 'Create your first page →')}
              </button>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
                {myProfiles.map((p) => {
                  const color = TYPE_COLOR[p.type] ?? 'var(--accent)';
                  const selected = selectedProfile?.id === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedPageId(p.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '11px 15px 11px 12px',
                        borderRadius: 12, cursor: 'pointer',
                        background: selected ? hexA(color, 0.1) : 'var(--hair-30)',
                        border: `1px solid ${selected ? color : 'var(--hair-100)'}`,
                        boxShadow: selected ? `0 0 0 1px ${color} inset` : 'none',
                      }}
                    >
                      <div style={{
                        width: 30, height: 30, borderRadius: 9999, flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '0.9375rem', color: 'var(--ink-on-accent)',
                        background: color,
                      }}>
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', letterSpacing: '.14em', textTransform: 'uppercase', color }}>
                          {typeLabel(p.type)}
                        </span>
                        <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--ink)' }}>{p.name}</span>
                      </div>
                    </div>
                  );
                })}
                <button
                  onClick={() => setTab('creator')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7, padding: '11px 16px', borderRadius: 12,
                    background: 'transparent', border: '1px dashed var(--hair-180)', cursor: 'pointer',
                    color: 'var(--ink-a65)', fontSize: '0.9375rem', fontWeight: 600,
                  }}
                  type="button"
                >
                  {t('pagesHome.newPage', '+ New page')}
                </button>
              </div>

              {selectedProfile && (
                <div style={{
                  borderRadius: 18, padding: 24, marginBottom: 36,
                  display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
                  border: `1px solid ${hexA(TYPE_COLOR[selectedProfile.type] ?? 'var(--accent)', 0.3)}`,
                  background: hexA(TYPE_COLOR[selectedProfile.type] ?? 'var(--accent)', 0.07),
                }}>
                  <div style={{
                    width: 72, height: 72, borderRadius: 9999, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.75rem', color: 'var(--ink-on-accent)',
                    background: TYPE_COLOR[selectedProfile.type] ?? 'var(--accent)',
                  }}>
                    {selectedProfile.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', letterSpacing: '.14em', textTransform: 'uppercase',
                      marginBottom: 5, color: TYPE_COLOR[selectedProfile.type] ?? 'var(--accent-text)',
                    }}>
                      {typeLabel(selectedProfile.type).toUpperCase()} {t('pagesHome.pageSuffix', 'PAGE')}
                    </div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.375rem', fontWeight: 800, letterSpacing: '-.02em', marginBottom: 3 }}>
                      {selectedProfile.name}
                    </div>
                    <div style={{ fontSize: '0.9375rem', color: 'var(--ink-a65)' }}>
                      @{selectedProfile.owner?.username ?? selectedProfile.hexId} · iHYPE
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <Link href={profileRoute(selectedProfile.type, selectedProfile.slug)} style={bGhost}>
                      {t('pagesHome.view', 'View')}
                    </Link>
                    <button onClick={() => setTab('creator')} style={bSolid} type="button">
                      {t('pagesHome.editPage', 'Edit page')}
                    </button>
                  </div>
                </div>
              )}

              {selectedProfile && (
                <PageRoleModules
                  key={selectedProfile.id}
                  color={TYPE_COLOR[selectedProfile.type] ?? 'var(--accent)'}
                  initialTool={initialTool}
                  profile={selectedProfile}
                />
              )}
            </>
          )}

        </div>
      )}

      {tab === 'network' && (
        <div className="sub-panel">
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--ink-a65)', marginBottom: 14 }}>
            {t('pagesHome.yourNetworkLabel', 'YOUR NETWORK')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginBottom: 18 }}>
            <div style={{ background: 'var(--hair-30)', border: '1px solid var(--line)', borderRadius: 14, padding: 16, textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.375rem', letterSpacing: '-.02em', marginBottom: 5 }}>
                {String(following.length).padStart(2, '0')}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9375rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-a65)' }}>{t('pagesHome.followingStat', 'Following')}</div>
            </div>
            <div style={{ background: 'var(--hair-30)', border: '1px solid var(--line)', borderRadius: 14, padding: 16, textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.375rem', letterSpacing: '-.02em', marginBottom: 5 }}>
                {String(followersCount).padStart(2, '0')}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9375rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-a65)' }}>{t('pagesHome.followersStat', 'Followers')}</div>
            </div>
            <div style={{ background: 'var(--hair-30)', border: '1px solid var(--line)', borderRadius: 14, padding: 16, textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.375rem', letterSpacing: '-.02em', marginBottom: 5 }}>
                {String(mutualCount).padStart(2, '0')}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9375rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-a65)' }}>{t('pagesHome.mutualsStat', 'Mutuals')}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {NET_FILTERS.map((f) => (
              <div
                key={f.id}
                onClick={() => setNetFilter(f.id)}
                style={{
                  fontSize: '0.9375rem', padding: '7px 14px', borderRadius: 9999, cursor: 'pointer',
                  background: netFilter === f.id ? 'rgba(var(--accent-rgb),.12)' : 'var(--hair-30)',
                  border: `1px solid ${netFilter === f.id ? 'rgba(var(--accent-rgb),.4)' : 'var(--hair-100)'}`,
                  color: netFilter === f.id ? 'var(--ink)' : 'var(--ink-a65)',
                }}
              >
                {t(`pagesHome.netFilterLabel.${f.id}`, f.label)}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 32 }}>
            {netListShown.length === 0 ? (
              <div style={{ color: 'var(--ink-a65)', fontSize: '0.9375rem', padding: '10px 2px' }}>{t('pagesHome.noConnectionsMatch', 'No connections match.')}</div>
            ) : (
              netListShown.map((p) => {
                const color = TYPE_COLOR[p.type] ?? 'var(--accent)';
                const initials = p.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
                return (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', border: '1px solid var(--line)', borderRadius: 14, background: 'var(--hair-30)' }}>
                    <Link href={profileRoute(p.type, p.slug)} style={{
                      width: 46, height: 46, borderRadius: 9999, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', color: 'var(--ink-on-accent)',
                      background: `linear-gradient(135deg, ${color}, ${hexA(color, 0.55)})`, textDecoration: 'none',
                    }}>
                      {initials}
                    </Link>
                    <Link href={profileRoute(p.type, p.slug)} style={{ flex: 1, minWidth: 0, textDecoration: 'none', color: 'inherit' }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.9375rem', fontWeight: 800, letterSpacing: '-.01em', display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, flexWrap: 'wrap', rowGap: 4 }}>
                        <span style={{ flex: '1 1 auto', minWidth: '7ch', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9375rem', letterSpacing: '.1em', textTransform: 'uppercase', padding: '2px 6px', borderRadius: 4, color, background: hexA(color, 0.14), flexShrink: 0 }}>
                          {typeLabel(p.type)}
                        </span>
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9375rem', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink-a65)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--ink-a65)' }}>
              {t('pagesHome.suggestedForYou', 'SUGGESTED FOR YOU')}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 32 }}>
            {netSuggestShown.length === 0 ? (
              <div style={{ color: 'var(--ink-a65)', fontSize: '0.9375rem', padding: '10px 2px' }}>{t('pagesHome.noSuggestionsMatch', 'No suggestions match.')}</div>
            ) : (
              netSuggestShown.map((p) => {
                const color = TYPE_COLOR[p.type] ?? 'var(--accent)';
                const initials = p.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
                return (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', border: '1px solid var(--line)', borderRadius: 14, background: 'var(--hair-30)' }}>
                    <Link href={profileRoute(p.type, p.slug)} style={{
                      width: 46, height: 46, borderRadius: 9999, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', color: 'var(--ink-on-accent)',
                      background: `linear-gradient(135deg, ${color}, ${hexA(color, 0.55)})`, textDecoration: 'none',
                    }}>
                      {initials}
                    </Link>
                    <Link href={profileRoute(p.type, p.slug)} style={{ flex: 1, minWidth: 0, textDecoration: 'none', color: 'inherit' }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.9375rem', fontWeight: 800, letterSpacing: '-.01em', display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, flexWrap: 'wrap', rowGap: 4 }}>
                        <span style={{ flex: '1 1 auto', minWidth: '7ch', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9375rem', letterSpacing: '.1em', textTransform: 'uppercase', padding: '2px 6px', borderRadius: 4, color, background: hexA(color, 0.14), flexShrink: 0 }}>
                          {typeLabel(p.type)}
                        </span>
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9375rem', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink-a65)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
              borderRadius: 12, border: '1px solid rgba(var(--role-venue-rgb),.3)', background: 'rgba(var(--role-venue-rgb),.08)',
              color: 'var(--role-venue)', fontSize: '0.9375rem', fontWeight: 600,
            }}>
              ✓ &ldquo;{justCreatedName}&rdquo; {t('pagesHome.pageCreatedSuffix', 'page created — saved to your account. Edit it below.')}
            </div>
          )}
          {selectedProfile && (
            <>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--ink-a65)', marginBottom: 14 }}>
                {t('pagesHome.editingLabel', 'EDITING')} · {typeLabel(selectedProfile.type).toUpperCase()}
              </div>
              <PageEditor initialSection={initialEditorSection} key={selectedProfile.id} profileId={selectedProfile.id} />
              <div style={{ borderTop: '1px solid var(--hair-70)', margin: '36px 0 22px' }} />
            </>
          )}

          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--ink-a65)', marginBottom: 14 }}>
            {selectedProfile ? t('pagesHome.addAnotherPageLabel', 'ADD ANOTHER PAGE') : t('pagesHome.pageCreatorLabel', 'PAGE CREATOR')}
          </div>
          <div className="pages-create-grid">
            {CREATE_CARDS.map((card) => {
              const isCreating = creatingType === card.type;
              const cardName = t(`pagesHome.createCardName.${card.type}`, card.name);
              const cardDesc = t(`pagesHome.createCardDesc.${card.type}`, card.desc);
              if (isCreating) {
                return (
                  <div key={card.type} style={{
                    border: `1px solid ${hexA(card.color, 0.35)}`, borderRadius: 14, padding: 20,
                    background: hexA(card.color, 0.06), display: 'flex', flexDirection: 'column', gap: 12,
                  }}>
                    <div style={{ width: 40, height: 40, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', background: card.bg }}>
                      {card.icon}
                    </div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 800, letterSpacing: '-.01em', color: card.color }}>
                      {cardName}
                    </div>
                    <input
                      autoFocus
                      disabled={creating}
                      onChange={(e) => setCreatingName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') addProfile(card.type); }}
                      placeholder={`${cardName} ${t('pagesHome.createCardNameFieldSuffix', 'name')}`}
                      style={{ boxSizing: 'border-box', width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--hair-100)', background: 'var(--hair-40)', color: 'var(--ink)', fontFamily: 'var(--font-body)', fontSize: '0.9375rem' }}
                      type="text"
                      value={creatingName}
                    />
                    {card.type === 'ARTIST' && (
                      <label style={{ display: 'flex', gap: 9, alignItems: 'flex-start', fontSize: '0.9375rem', lineHeight: 1.5, color: 'var(--ink-a70)' }}>
                        <input
                          checked={acceptedUploadPolicy}
                          disabled={creating}
                          onChange={(e) => setAcceptedUploadPolicy(e.target.checked)}
                          style={{ marginTop: 2 }}
                          type="checkbox"
                        />
                        <span>{t('pagesHome.uploadPolicyAttestation', 'I confirm I am authorized to upload or use the music/media I add to iHYPE.')}</span>
                      </label>
                    )}
                    {createError && <div style={{ fontSize: '0.9375rem', color: 'var(--accent-text)' }}>{createError}</div>}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        disabled={creating || !creatingName.trim() || (card.type === 'ARTIST' && !acceptedUploadPolicy)}
                        onClick={() => addProfile(card.type)}
                        style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', background: card.color, color: 'var(--ink-on-accent)', fontWeight: 700, fontSize: '0.9375rem', cursor: creating ? 'default' : 'pointer', opacity: creating || !creatingName.trim() ? 0.6 : 1 }}
                        type="button"
                      >
                        {creating ? t('pagesHome.creating', 'Creating…') : t('pagesHome.create', 'Create')}
                      </button>
                      <button
                        disabled={creating}
                        onClick={() => { setCreatingType(null); setCreatingName(''); setCreateError(null); setAcceptedUploadPolicy(false); }}
                        style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid var(--hair-100)', background: 'transparent', color: 'var(--ink-a70)', fontSize: '0.9375rem', cursor: 'pointer' }}
                        type="button"
                      >
                        {t('pagesHome.cancel', 'Cancel')}
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
                    border: '1px solid var(--hair-70)', borderRadius: 14, padding: 20,
                    background: 'var(--hair-30)', textAlign: 'left', color: 'inherit', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', gap: 12, font: 'inherit',
                  }}
                  type="button"
                >
                  <div style={{ width: 40, height: 40, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', background: card.bg }}>
                    {card.icon}
                  </div>
                  <div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 800, letterSpacing: '-.01em', marginBottom: 3, color: card.color }}>
                      {cardName}
                    </div>
                    <div style={{ fontSize: '0.9375rem', color: 'var(--ink-a65)', lineHeight: 1.5 }}>{cardDesc}</div>
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
        .pages-create-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
        @media (max-width: 640px) {
          .pages-create-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
