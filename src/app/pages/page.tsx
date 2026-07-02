import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getDemoOwnerExclusion } from '@/lib/runtime-flags';
import { PagesReferralTab } from '@/components/PagesReferralTab';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Pages · iHYPE',
  description: 'Your iHYPE pages — artist, venue, and promoter profiles you manage.',
  robots: { index: false, follow: false },
};

const TYPE_COLOR: Record<string, string> = {
  ARTIST: '#ff5029',
  DJ: '#ff3e9a',
  VENUE: '#22e5d4',
  FAN: '#b983ff',
};

const TYPE_LABEL: Record<string, string> = {
  ARTIST: 'Artist',
  DJ: 'Promoter / DJ',
  VENUE: 'Venue',
  FAN: 'Fan',
};

const profileRoute = (type: string, slug: string) =>
  type === 'VENUE' ? `/venues/${slug}` : `/artists/${slug}`;

const TABS = [
  { id: 'mypage', label: 'My Page' },
  { id: 'network', label: 'Network' },
  { id: 'creator', label: 'Creator' },
  { id: 'referral', label: 'Referral' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const CREATE_CARDS: { type: string; color: string; name: string; desc: string }[] = [
  { type: 'ARTIST', color: '#ff5029', name: 'Artist Page', desc: 'Upload tracks, list shows, sell tickets. Keep 45%.' },
  { type: 'VENUE', color: '#22e5d4', name: 'Venue Page', desc: 'Book from the demand radar. Keep 45% of every room.' },
  { type: 'DJ', color: '#ff3e9a', name: 'DJ Page', desc: 'Host radio shows, build a crate, earn promoter cuts.' },
];

export default async function PagesPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/pages');
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const activeTab: TabId = TABS.some((t) => t.id === resolvedSearchParams.tab)
    ? (resolvedSearchParams.tab as TabId)
    : 'mypage';

  const [profiles, networkProfiles] = await Promise.all([
    db.profile.findMany({
      where: { ownerId: session.user.id },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true, slug: true, name: true, type: true, city: true,
        stateRegion: true, hypeCount: true, verificationStatus: true,
        _count: { select: { headlinerShows: true } },
      },
    }),
    activeTab === 'network'
      ? db.profile.findMany({
          where: {
            type: { in: ['ARTIST', 'DJ', 'VENUE'] },
            ownerId: { not: session.user.id },
            ...getDemoOwnerExclusion(),
          },
          orderBy: [{ verified: 'desc' }, { hypeCount: 'desc' }],
          take: 8,
          select: { id: true, slug: true, name: true, type: true, city: true, stateRegion: true, genres: true },
        })
      : Promise.resolve([]),
  ]);

  const tabHref = (tab: TabId) => (tab === 'mypage' ? '/pages' : `/pages?tab=${tab}`);

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px 100px' }}>
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 6 }}>
          YOUR PRESENCE
        </p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', fontWeight: 800, letterSpacing: '-.03em', margin: '0 0 6px' }}>
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
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              padding: '9px 18px',
              borderRadius: 9999,
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
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <Link href="/register?addPage=1" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '10px 18px', background: 'var(--accent)', color: '#fff',
              borderRadius: 8, fontWeight: 700, fontSize: 13, letterSpacing: '.04em',
              textDecoration: 'none',
            }}>
              + Add page
            </Link>
          </div>

          {profiles.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 0' }}>
              <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, marginBottom: 8, color: 'var(--ink)' }}>
                No pages yet
              </p>
              <p style={{ fontSize: 14, color: 'rgba(240,235,229,.5)', marginBottom: 24 }}>
                Create an artist, venue, or promoter page to get started.
              </p>
              <Link href="/register?addPage=1" style={{
                display: 'inline-block', padding: '12px 24px',
                background: 'var(--accent)', color: '#fff',
                borderRadius: 8, fontWeight: 700, fontSize: 14, textDecoration: 'none',
              }}>
                Create your first page →
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {profiles.map((p) => {
                const color = TYPE_COLOR[p.type] ?? '#ff5029';
                return (
                  <div key={p.id} style={{
                    display: 'flex', gap: 16, alignItems: 'center',
                    padding: '18px 20px', border: '1px solid rgba(255,255,255,.07)',
                    borderRadius: 10, background: 'var(--bg-2, #100d09)',
                  }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 24, flexShrink: 0,
                      background: `linear-gradient(135deg, ${color}, #b983ff)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
                    }}>
                      {p.type === 'VENUE' ? '🏛️' : p.type === 'DJ' ? '🎛️' : '🎤'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, color: 'var(--ink)' }}>
                          {p.name}
                        </span>
                        {p.verificationStatus === 'VERIFIED' && (
                          <span style={{ fontSize: 12, color, fontFamily: 'var(--font-mono)', letterSpacing: '.06em' }}>✓</span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(240,235,229,.45)' }}>
                        <span style={{ color, fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', marginRight: 8 }}>
                          {TYPE_LABEL[p.type] ?? p.type}
                        </span>
                        {p.city && `${p.city}${p.stateRegion ? `, ${p.stateRegion}` : ''} · `}
                        {p._count.headlinerShows} show{p._count.headlinerShows !== 1 ? 's' : ''}
                        {p.hypeCount > 0 ? ` · 🔥 ${p.hypeCount.toLocaleString()} hypes` : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      <Link href={profileRoute(p.type, p.slug)} style={{
                        padding: '8px 14px', border: '1px solid rgba(255,255,255,.1)',
                        borderRadius: 6, fontSize: 12, color: 'rgba(240,235,229,.6)',
                        textDecoration: 'none', fontFamily: 'var(--font-mono)',
                      }}>
                        View
                      </Link>
                      <Link href={`/home?profile=${p.id}`} style={{
                        padding: '8px 14px', background: 'rgba(255,80,41,.15)',
                        border: '1px solid rgba(255,80,41,.25)',
                        borderRadius: 6, fontSize: 12, color: 'var(--accent)',
                        textDecoration: 'none', fontFamily: 'var(--font-mono)',
                      }}>
                        Manage
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <Link href="/me/settings" style={{
            display: 'flex', alignItems: 'center', gap: 14, marginTop: 32,
            padding: '18px 20px', border: '1px solid rgba(255,255,255,.06)',
            borderRadius: 14, background: 'rgba(255,255,255,.03)', textDecoration: 'none', color: 'inherit',
          }}>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 800 }}>Settings</div>
              <div style={{ fontSize: 12, color: 'rgba(240,235,229,.45)', marginTop: 2 }}>Notifications, security, and account.</div>
            </div>
            <span style={{ marginLeft: 'auto', color: 'rgba(240,235,229,.3)' }}>→</span>
          </Link>
        </>
      )}

      {activeTab === 'network' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
          {networkProfiles.length === 0 ? (
            <div className="empty">No other pages to show yet.</div>
          ) : (
            networkProfiles.map((p) => {
              const color = TYPE_COLOR[p.type] ?? '#ff5029';
              const initials = p.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
              return (
                <Link key={p.id} href={profileRoute(p.type, p.slug)} style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px',
                  border: '1px solid rgba(255,255,255,.06)', borderRadius: 14, background: 'rgba(255,255,255,.03)',
                  textDecoration: 'none', color: 'inherit',
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 9999, flexShrink: 0,
                    background: `linear-gradient(135deg, ${color}, #b983ff)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, color: '#fff',
                  }}>
                    {initials}
                  </div>
                  <div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 800, letterSpacing: '-.01em' }}>{p.name}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(240,235,229,.4)', marginTop: 2 }}>
                      {TYPE_LABEL[p.type] ?? p.type}{p.genres[0] ? ` · ${p.genres[0]}` : ''}{p.city ? ` · ${p.city}` : ''}
                    </div>
                  </div>
                </Link>
              );
            })
          )}
          <Link href="/discover" style={{ gridColumn: '1 / -1', textAlign: 'center', fontSize: 13, color: 'var(--accent)', textDecoration: 'none', marginTop: 8 }}>
            See all on Discover →
          </Link>
        </div>
      )}

      {activeTab === 'creator' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
          {CREATE_CARDS.map((card) => (
            <Link key={card.type} href={`/register?role=${card.type}`} style={{
              border: '1px solid rgba(255,255,255,.07)', borderRadius: 14, padding: 20,
              background: 'rgba(255,255,255,.03)', textDecoration: 'none', color: 'inherit',
              display: 'flex', flexDirection: 'column', gap: 12,
            }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 800, letterSpacing: '-.01em', color: card.color }}>
                {card.name}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(240,235,229,.45)', lineHeight: 1.5 }}>{card.desc}</div>
            </Link>
          ))}
        </div>
      )}

      {activeTab === 'referral' && <PagesReferralTab />}

      <p style={{ marginTop: 40, fontSize: 11, color: 'rgba(240,235,229,.25)', fontFamily: 'var(--font-mono)', letterSpacing: '.08em', textTransform: 'uppercase' }}>
        iHYPE · 0% platform fee · 45/45/10 split · admin@ihype.org
      </p>
    </div>
  );
}
