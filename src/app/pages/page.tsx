import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getDemoOwnerExclusion } from '@/lib/runtime-flags';
import { PagesReferralTab } from '@/components/PagesReferralTab';
import { FollowButton } from '@/components/FollowButton';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Pages · iHYPE',
  description: 'Your public page, the creator, and every artist, venue, and DJ on iHYPE.',
  robots: { index: false, follow: false },
};

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
  { id: 'mypage', label: 'My Page' },
  { id: 'network', label: 'Network' },
  { id: 'creator', label: 'Creator' },
  { id: 'referral', label: 'HYPE Link' },
] as const;

type TabId = (typeof TABS)[number]['id'];

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
const bGhost: React.CSSProperties = { ...b, background: 'transparent', color: 'rgba(240,235,229,.7)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.14)' };

function hexA(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export default async function PagesPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string; page?: string; role?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/pages');
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const activeTab: TabId = TABS.some((t) => t.id === resolvedSearchParams.tab)
    ? (resolvedSearchParams.tab as TabId)
    : 'mypage';
  const netFilter = NET_FILTERS.some((f) => f.id === resolvedSearchParams.role) ? resolvedSearchParams.role! : 'all';

  const myProfiles = await db.profile.findMany({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true, slug: true, name: true, type: true, hexId: true,
      owner: { select: { username: true } },
    },
  });
  const myProfileIds = myProfiles.map((p) => p.id);

  const [followingRows, followersCount, suggestedProfiles] = await Promise.all([
    db.follow.findMany({
      where: { followerId: session.user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        followeeProfile: {
          select: { id: true, slug: true, name: true, type: true, city: true, genres: true, ownerId: true },
        },
      },
    }),
    myProfileIds.length
      ? db.follow.count({ where: { followeeProfileId: { in: myProfileIds } } })
      : Promise.resolve(0),
    activeTab === 'network'
      ? db.profile.findMany({
          where: {
            type: { in: ['ARTIST', 'DJ', 'VENUE', 'LISTENER'] },
            ownerId: { not: session.user.id },
            ...getDemoOwnerExclusion(),
          },
          orderBy: [{ verified: 'desc' }, { hypeCount: 'desc' }],
          take: 12,
          select: { id: true, slug: true, name: true, type: true, city: true, genres: true },
        })
      : Promise.resolve([]),
  ]);

  const following = followingRows.map((f) => f.followeeProfile).filter(Boolean);
  const followedProfileIds = new Set(following.map((p) => p.id));
  const suggested = suggestedProfiles.filter((p) => !followedProfileIds.has(p.id));

  let mutualCount = 0;
  if (following.length && myProfileIds.length) {
    const followingOwnerIds = following.map((p) => p.ownerId).filter(Boolean) as string[];
    if (followingOwnerIds.length) {
      mutualCount = await db.follow.count({
        where: { followerId: { in: followingOwnerIds }, followeeProfileId: { in: myProfileIds } },
      });
    }
  }

  const netMatch = (type: string) => netFilter === 'all' || netFilter === type;
  const netListShown = following.filter((p) => netMatch(p.type));
  const netSuggestShown = suggested.filter((p) => netMatch(p.type));

  const selectedProfile = myProfiles.find((p) => p.id === resolvedSearchParams.page) ?? myProfiles[0] ?? null;

  const tabHref = (tab: TabId) => (tab === 'mypage' ? '/pages' : `/pages?tab=${tab}`);

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px 100px' }}>
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 8 }}>
          YOUR PRESENCE
        </p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.75rem, 5vw, 2.5rem)', fontWeight: 800, letterSpacing: '-.03em', lineHeight: 1, margin: '0 0 6px' }}>
          Pages
        </h1>
        <p style={{ fontSize: 14, color: 'rgba(240,235,229,.55)', margin: 0 }}>
          Your public page, the creator, and every artist, venue, and DJ on iHYPE.
        </p>
      </div>

      <nav style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 26 }} aria-label="Pages sections">
        {TABS.map((tab) => (
          <Link
            key={tab.id}
            href={tabHref(tab.id)}
            style={{
              fontFamily: 'var(--font-body)', fontSize: 14, padding: '9px 18px', borderRadius: 9999,
              textDecoration: 'none',
              background: activeTab === tab.id ? 'rgba(255,80,41,.1)' : 'rgba(255,255,255,.03)',
              border: `1px solid ${activeTab === tab.id ? 'rgba(255,80,41,.35)' : 'rgba(255,255,255,.08)'}`,
              color: activeTab === tab.id ? 'var(--ink)' : 'rgba(240,235,229,.55)',
              fontWeight: activeTab === tab.id ? 500 : 400,
            }}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {activeTab === 'mypage' && (
        <>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: 'rgba(240,235,229,.35)', marginBottom: 14 }}>
            YOUR PAGES
          </div>

          {myProfiles.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 0' }}>
              <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, marginBottom: 8, color: 'var(--ink)' }}>
                No pages yet
              </p>
              <p style={{ fontSize: 14, color: 'rgba(240,235,229,.5)', marginBottom: 24 }}>
                Create an artist, venue, or promoter page to get started.
              </p>
              <Link href="/register?addPage=1" style={{ display: 'inline-block', padding: '12px 24px', background: 'var(--accent)', color: '#fff', borderRadius: 8, fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
                Create your first page →
              </Link>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
                {myProfiles.map((p) => {
                  const color = TYPE_COLOR[p.type] ?? '#ff5029';
                  const selected = selectedProfile?.id === p.id;
                  return (
                    <Link
                      key={p.id}
                      href={`/pages?page=${p.id}`}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '11px 15px 11px 12px',
                        borderRadius: 12, textDecoration: 'none',
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
                    </Link>
                  );
                })}
                <Link
                  href="/pages?tab=creator"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7, padding: '11px 16px', borderRadius: 12,
                    background: 'transparent', border: '1px dashed rgba(255,255,255,.18)',
                    color: 'rgba(240,235,229,.55)', fontSize: 13, fontWeight: 600, textDecoration: 'none',
                  }}
                >
                  + New page
                </Link>
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
                    <div style={{ fontSize: 13, color: 'rgba(240,235,229,.5)' }}>
                      @{selectedProfile.owner?.username ?? selectedProfile.hexId} · iHYPE
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <Link href={profileRoute(selectedProfile.type, selectedProfile.slug)} style={bGhost}>
                      View
                    </Link>
                    <Link href={`/home?profile=${selectedProfile.id}`} style={bSolid}>
                      Edit page
                    </Link>
                  </div>
                </div>
              )}
            </>
          )}

          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: 'rgba(240,235,229,.35)', marginBottom: 14, marginTop: 32 }}>
            ACCOUNT
          </div>
          <Link href="/me/settings" style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '18px 20px', border: '1px solid rgba(255,255,255,.06)',
            borderRadius: 14, background: 'rgba(255,255,255,.03)', textDecoration: 'none', color: 'inherit',
          }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(255,255,255,.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg fill="none" height="18" stroke="rgba(240,235,229,.7)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24" width="18">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 800 }}>Settings</div>
              <div style={{ fontSize: 12, color: 'rgba(240,235,229,.55)', marginTop: 2 }}>Notifications, privacy, MFA, identity detachment, account.</div>
            </div>
            <span style={{ marginLeft: 'auto', color: 'rgba(240,235,229,.3)' }}>→</span>
          </Link>
        </>
      )}

      {activeTab === 'network' && (
        <>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: 'rgba(240,235,229,.35)', marginBottom: 14 }}>
            YOUR NETWORK
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 18 }}>
            <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 14, padding: 16, textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, letterSpacing: '-.02em', marginBottom: 5 }}>
                {String(following.length).padStart(2, '0')}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(240,235,229,.5)' }}>Following</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 14, padding: 16, textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, letterSpacing: '-.02em', marginBottom: 5 }}>
                {String(followersCount).padStart(2, '0')}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(240,235,229,.5)' }}>Followers</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 14, padding: 16, textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, letterSpacing: '-.02em', marginBottom: 5 }}>
                {String(mutualCount).padStart(2, '0')}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(240,235,229,.5)' }}>Mutuals</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {NET_FILTERS.map((f) => (
              <Link
                key={f.id}
                href={`/pages?tab=network${f.id === 'all' ? '' : `&role=${f.id}`}`}
                style={{
                  fontSize: 12, padding: '7px 14px', borderRadius: 9999, textDecoration: 'none',
                  background: netFilter === f.id ? 'rgba(255,80,41,.12)' : 'rgba(255,255,255,.03)',
                  border: `1px solid ${netFilter === f.id ? 'rgba(255,80,41,.4)' : 'rgba(255,255,255,.1)'}`,
                  color: netFilter === f.id ? 'var(--ink)' : 'rgba(240,235,229,.6)',
                }}
              >
                {f.label}
              </Link>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 32 }}>
            {netListShown.length === 0 ? (
              <div style={{ color: 'rgba(240,235,229,.5)', fontSize: 13, padding: '10px 2px' }}>No connections match.</div>
            ) : (
              netListShown.map((p) => {
                const color = TYPE_COLOR[p.type] ?? '#ff5029';
                const initials = p.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
                return (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', border: '1px solid rgba(255,255,255,.06)', borderRadius: 14, background: 'rgba(255,255,255,.03)' }}>
                    <Link href={profileRoute(p.type, p.slug)} style={{
                      width: 46, height: 46, borderRadius: 9999, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, color: '#fff',
                      background: `linear-gradient(135deg, ${color}, ${hexA(color, 0.55)})`, textDecoration: 'none',
                    }}>
                      {initials}
                    </Link>
                    <Link href={profileRoute(p.type, p.slug)} style={{ flex: 1, minWidth: 0, textDecoration: 'none', color: 'inherit' }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 800, letterSpacing: '-.01em', display: 'flex', alignItems: 'center', gap: 7 }}>
                        {p.name}
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '.1em', textTransform: 'uppercase', padding: '2px 6px', borderRadius: 4, color, background: hexA(color, 0.14) }}>
                          {TYPE_LABEL[p.type] ?? p.type}
                        </span>
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(240,235,229,.5)', marginTop: 3 }}>
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
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: 'rgba(240,235,229,.35)' }}>
              SUGGESTED FOR YOU
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 32 }}>
            {netSuggestShown.length === 0 ? (
              <div style={{ color: 'rgba(240,235,229,.5)', fontSize: 13, padding: '10px 2px' }}>No suggestions match.</div>
            ) : (
              netSuggestShown.map((p) => {
                const color = TYPE_COLOR[p.type] ?? '#ff5029';
                const initials = p.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
                return (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', border: '1px solid rgba(255,255,255,.06)', borderRadius: 14, background: 'rgba(255,255,255,.03)' }}>
                    <Link href={profileRoute(p.type, p.slug)} style={{
                      width: 46, height: 46, borderRadius: 9999, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, color: '#fff',
                      background: `linear-gradient(135deg, ${color}, ${hexA(color, 0.55)})`, textDecoration: 'none',
                    }}>
                      {initials}
                    </Link>
                    <Link href={profileRoute(p.type, p.slug)} style={{ flex: 1, minWidth: 0, textDecoration: 'none', color: 'inherit' }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 800, letterSpacing: '-.01em', display: 'flex', alignItems: 'center', gap: 7 }}>
                        {p.name}
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '.1em', textTransform: 'uppercase', padding: '2px 6px', borderRadius: 4, color, background: hexA(color, 0.14) }}>
                          {TYPE_LABEL[p.type] ?? p.type}
                        </span>
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(240,235,229,.5)', marginTop: 3 }}>
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
        </>
      )}

      {activeTab === 'creator' && (
        <>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: 'rgba(240,235,229,.35)', marginBottom: 14 }}>
            PAGE CREATOR
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
            {CREATE_CARDS.map((card) => (
              <Link key={card.type} href={`/register?role=${card.type}&addPage=1`} style={{
                border: '1px solid rgba(255,255,255,.07)', borderRadius: 14, padding: 20,
                background: 'rgba(255,255,255,.03)', textDecoration: 'none', color: 'inherit',
                display: 'flex', flexDirection: 'column', gap: 12,
              }}>
                <div style={{ width: 40, height: 40, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', background: card.bg }}>
                  {card.icon}
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 800, letterSpacing: '-.01em', marginBottom: 3, color: card.color }}>
                    {card.name}
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(240,235,229,.55)', lineHeight: 1.5 }}>{card.desc}</div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {activeTab === 'referral' && <PagesReferralTab />}

      <p style={{ marginTop: 40, fontSize: 11, color: 'rgba(240,235,229,.25)', fontFamily: 'var(--font-mono)', letterSpacing: '.08em', textTransform: 'uppercase' }}>
        iHYPE · 0% platform fee · 45/45/10 split · admin@ihype.org
      </p>
    </div>
  );
}
