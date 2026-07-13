import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { buildArtistMediaCollection } from '@/lib/media';
import { HypeButton } from '@/components/HypeButton';
import { FollowButton } from '@/components/FollowButton';
import { ArtistMediaPlaylist } from '@/components/ArtistMediaPlaylist';
import { ProfileInsights } from '@/components/ProfileInsights';
import { getSafeImageUrl } from '@/lib/asset-safety';
import { resolveProfileThemeVars } from '@/lib/profile-design';
import { canManageOwnedResource } from '@/lib/permissions';
import { getDemoCreatorExclusion, isDemoUser, shouldHideDemoContent } from '@/lib/runtime-flags';

export const revalidate = 60;

const djSections = ['shows', 'crate', 'earnings', 'insights'] as const;
type DjSection = (typeof djSections)[number];

function getActiveSection(section: string | string[] | undefined): DjSection {
  if (typeof section === 'string' && djSections.includes(section as DjSection)) return section as DjSection;
  return 'shows';
}

const SECTION_LABEL: Record<DjSection, string> = { shows: 'Shows', crate: 'Crate', earnings: 'Earnings', insights: 'Insights' };

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const profile = await db.profile.findUnique({
    where: { slug },
    select: { name: true, headline: true, genres: true, city: true, stateRegion: true, hypeCount: true },
  });
  if (!profile) return { title: 'DJ · iHYPE' };
  const loc = [profile.city, profile.stateRegion].filter(Boolean).join(', ');
  return {
    title: `${profile.name} · iHYPE`,
    description: ['DJ', profile.genres.slice(0, 3).join(', ') || null, loc || null].filter(Boolean).join(' · '),
  };
}

export default async function DJProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ section?: string | string[] }>;
}) {
  const session = await auth();
  const { slug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const activeSection = getActiveSection(resolvedSearchParams.section);

  const profile = await db.profile.findUnique({
    where: { slug },
    include: {
      owner: { select: { email: true, username: true } },
      mediaUploads: {
        where: { freeUseEnabled: true },
        select: { hexId: true, title: true, notes: true, mimeType: true, fileSizeBytes: true, createdAt: true, freeUseEnabled: true, sortOrder: true },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      },
    },
  });
  if (!profile || profile.type !== 'DJ') return notFound();
  if (shouldHideDemoContent() && isDemoUser(profile.owner)) return notFound();

  const isOwner = canManageOwnedResource(session, profile.ownerId);
  const themeVars = resolveProfileThemeVars(profile);
  const media = buildArtistMediaCollection(null, profile.mediaUploads);
  const artworkUrl = getSafeImageUrl(profile.galleryImage || profile.heroImage);

  const [shows, userHype, earningsOrders] = await Promise.all([
    db.show.findMany({
      where: { promoterProfileId: profile.id, ...getDemoCreatorExclusion() },
      orderBy: { startsAt: 'asc' },
    }),
    session?.user?.id
      ? db.profileHypeEvent.findUnique({ where: { userId_profileId: { userId: session.user.id, profileId: profile.id } }, select: { userId: true } })
      : null,
    isOwner
      ? db.ticketOrder.findMany({
          where: { affiliatePromoterProfileId: profile.id, status: { in: ['CAPTURED', 'RESERVED'] } },
          select: { promoterPayoutCents: true, show: { select: { title: true } } },
        })
      : Promise.resolve([]),
  ]);

  const now = new Date();
  const relevantShows = shows.filter((s) => s.status === 'LIVE' || s.startsAt >= now || (now.getTime() - s.startsAt.getTime()) < 7 * 86400000);
  const totalEarnedCents = earningsOrders.reduce((sum, o) => sum + o.promoterPayoutCents, 0);
  const earningsByShow = new Map<string, number>();
  for (const o of earningsOrders) {
    const key = o.show.title;
    earningsByShow.set(key, (earningsByShow.get(key) ?? 0) + o.promoterPayoutCents);
  }

  return (
    <div className="dj-page" style={(themeVars ?? undefined) as React.CSSProperties | undefined}>
      <div className="dj-hero">
        <div className="dj-hero-row">
          <div className="dj-avatar">
            {profile.avatarImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt={profile.name} src={profile.avatarImage} fetchPriority="high" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
            ) : (
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 26 }}>{profile.name.charAt(0)}</span>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <div className="dj-name">{profile.name}</div>
            <div className="dj-handle">{profile.owner?.username ? `@${profile.owner.username}` : profile.hexId}{profile.city ? ` · ${profile.city}` : ''}</div>
            <div className="dj-hero-badges">
              <span className="dj-badge" style={{ background: 'rgba(255,62,154,.15)', color: '#ff3e9a' }}>DJ</span>
              {profile.verificationStatus === 'VERIFIED' && <span className="dj-badge" style={{ background: 'rgba(34,229,212,.15)', color: 'var(--role-venue, #22e5d4)' }}>✓ Verified</span>}
            </div>
            <div className="dj-hero-actions">
              <FollowButton profileId={profile.id} variant="hero" />
              <Link className="dj-hero-btn" href="/radio">Tune In →</Link>
              {isOwner && (
                <>
                  {profile.type === 'DJ' && <Link className="dj-hero-btn" href="/radio/studio">Radio Studio</Link>}
                  <Link className="dj-hero-btn" href="/pages">Customize</Link>
                  <Link className="dj-hero-btn" href="/settings">Settings</Link>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="dj-stats">
          <div><div className="dj-stat-val">{shows.length}</div><div className="dj-stat-label">Shows</div></div>
          <div><div className="dj-stat-val">{profile.hypeCount.toLocaleString()}</div><div className="dj-stat-label">Hypes</div></div>
          {isOwner && <div><div className="dj-stat-val">${(totalEarnedCents / 100).toFixed(0)}</div><div className="dj-stat-label">Referral Earned</div></div>}
        </div>
      </div>

      <div className="dj-content">
        <div className="dj-tabs">
          {djSections.filter((s) => (s !== 'earnings' && s !== 'insights') || isOwner).map((section) => (
            <Link className={section === activeSection ? 'dj-tab active' : 'dj-tab'} href={`/promoters/${profile.slug}?section=${section}`} key={section}>
              {SECTION_LABEL[section]}
            </Link>
          ))}
        </div>

        {activeSection === 'shows' && (
          <div>
            {relevantShows.length === 0 ? (
              <div className="dj-empty"><p>No shows yet.</p></div>
            ) : (
              relevantShows.map((s) => (
                <Link className="dj-show-card" href={`/shows/${s.slug}`} key={s.id}>
                  <div>
                    <div className="dj-show-title">{s.title}</div>
                    <div className="dj-show-meta">
                      {s.status === 'LIVE' ? 'Live now' : s.startsAt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </div>
                  </div>
                  {s.status === 'LIVE' && <span className="dj-live-pill">Live</span>}
                </Link>
              ))
            )}
          </div>
        )}

        {activeSection === 'crate' && (
          media.entries.length ? (
            <ArtistMediaPlaylist
              artistName={profile.name}
              artistSlug={profile.slug}
              artworkUrl={artworkUrl}
              entries={media.entries}
              isOwner={isOwner}
              profileId={profile.id}
            />
          ) : (
            <div className="dj-empty"><p>No free-use tracks in the crate yet.</p></div>
          )
        )}

        {activeSection === 'earnings' && isOwner && (
          <div>
            <p style={{ fontSize: 12, color: 'var(--ink-a50)', marginBottom: 16 }}>
              Earnings are a proportional share of the 10% promoter pool per event, based on gate driven.
            </p>
            {earningsByShow.size === 0 ? (
              <div className="dj-empty"><p>No referral earnings yet.</p></div>
            ) : (
              <div className="dj-earn-list">
                {[...earningsByShow.entries()].map(([title, cents]) => (
                  <div className="dj-earn-row" key={title}>
                    <span>{title}</span>
                    <span className="dj-earn-val">+${(cents / 100).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeSection === 'insights' && isOwner && (
          <ProfileInsights profileId={profile.id} profileType={profile.type} />
        )}
      </div>

      <div style={{ padding: '0 32px' }}>
        <HypeButton entityLabel="DJ" initialCount={profile.hypeCount} initiallyHyped={!!userHype} targetId={profile.id} targetType="profile" />
      </div>

      <style>{`
        .dj-page { max-width: 640px; margin: 0 auto; padding: 32px 0 100px; }
        .dj-hero { background: var(--profile-hero, linear-gradient(140deg, rgba(255,62,154,.12), rgba(185,131,255,.08))); border-bottom: 1px solid var(--profile-border, rgba(255,62,154,.18)); padding: 40px 32px 32px; }
        .dj-hero-row { display: flex; gap: 28px; align-items: flex-start; flex-wrap: wrap; }
        @media (max-width: 600px) { .dj-hero { padding: 24px 20px; } .dj-content { padding: 0 20px; } }
        .dj-avatar { width: 80px; height: 80px; border-radius: 50%; background: var(--profile-hero, linear-gradient(135deg,#ff3e9a,#b983ff)); flex-shrink: 0; display: flex; align-items: center; justify-content: center; color: #fff; overflow: hidden; }
        .dj-name { font-family: var(--font-display); font-size: 28px; font-weight: 800; letter-spacing: -.02em; margin-bottom: 4px; color: var(--ink); }
        .dj-handle { font-family: var(--font-mono); font-size: 12px; text-transform: uppercase; letter-spacing: .14em; color: var(--ink-a50); margin-bottom: 12px; }
        .dj-hero-badges { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; }
        .dj-badge { display: inline-block; padding: 5px 12px; border-radius: 4px; font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: .14em; }
        .dj-hero-actions { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
        .dj-hero-btn { display: inline-flex; align-items: center; gap: 7px; padding: 10px 18px; border-radius: 9px; font-size: 13px; font-weight: 700; text-decoration: none; background: var(--line); color: var(--ink); border: 1px solid var(--hair-100); }
        .dj-hero-btn:hover { background: var(--hair-100); }
        .dj-stats { display: flex; gap: 28px; margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--line); }
        .dj-stat-val { font-size: 22px; font-weight: 700; color: var(--profile-accent, #ff3e9a); font-family: var(--font-display); }
        .dj-stat-label { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: .14em; color: var(--ink-a55); margin-top: 2px; }
        .dj-content { padding: 0 32px; }
        .dj-tabs { display: flex; gap: 24px; border-bottom: 1px solid var(--line); margin: 28px 0; }
        .dj-tab { padding: 10px 0; border-bottom: 2px solid transparent; cursor: pointer; font-weight: 600; font-size: 14px; color: var(--ink-a60); text-decoration: none; }
        .dj-tab.active { color: var(--ink); border-color: var(--profile-accent, #ff3e9a); }
        .dj-show-card { border: 1px solid var(--line); border-radius: 10px; padding: 18px 20px; background: var(--bg2); display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; text-decoration: none; color: inherit; }
        .dj-show-card:hover { background: var(--bg3); }
        .dj-show-title { font-family: var(--font-display); font-size: 15px; font-weight: 800; margin-bottom: 3px; color: var(--ink); }
        .dj-show-meta { font-size: 12px; color: var(--ink-a55); }
        .dj-live-pill { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 9999px; background: rgba(255,62,154,.15); color: #ff3e9a; font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: .12em; }
        .dj-earn-list { border: 1px solid var(--line); border-radius: 10px; padding: 0 20px; background: var(--bg2); }
        .dj-earn-row { display: flex; justify-content: space-between; padding: 14px 0; border-bottom: 1px solid var(--line); font-size: 14px; }
        .dj-earn-row:last-child { border-bottom: none; }
        .dj-earn-val { font-weight: 700; color: #ff3e9a; }
        .dj-empty { text-align: center; padding: 48px 24px; color: var(--ink-a50); }
      `}</style>
    </div>
  );
}
