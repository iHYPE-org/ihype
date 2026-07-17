import type { Metadata } from 'next';
import { cache } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { buildArtistMediaCollection } from '@/lib/media';
import { HypeButton } from '@/components/HypeButton';
import { FollowButton } from '@/components/FollowButton';
import { ShareButton } from '@/components/ShareButton';
import { ReportButton } from '@/components/ReportButton';
import { FanMailButton } from '@/components/FanMailButton';
import { ArtistMediaPlaylist } from '@/components/ArtistMediaPlaylist';
import { TrackUploadPanel } from '@/components/TrackUploadPanel';
import { ProfileInsights } from '@/components/ProfileInsights';
import { BookingRequestInbox } from '@/components/BookingRequestInbox';
import { SimilarArtistsRow } from '@/components/SimilarArtistsRow';
import { getSimilarArtists } from '@/lib/sounds-like';
import { getPinnedStatValues } from '@/lib/profile-stats';
import { PinnedStatTiles } from '@/components/PinnedStatTiles';
import { getSafeImageUrl } from '@/lib/asset-safety';
import { resolveProfileThemeVars } from '@/lib/profile-design';
import { canManageOwnedResource } from '@/lib/permissions';
import { getDemoCreatorExclusion, isDemoUser, shouldHideDemoContent } from '@/lib/runtime-flags';
import { getBaseUrl } from '@/lib/utils';
import { ConnectPayoutButton } from '@/components/ConnectPayoutButton';

export const revalidate = 60;

const artistSections = ['about', 'tracks', 'shows', 'insights'] as const;
type ArtistSection = (typeof artistSections)[number];

function getActiveSection(section: string | string[] | undefined): ArtistSection {
  if (typeof section === 'string' && artistSections.includes(section as ArtistSection)) return section as ArtistSection;
  return 'about';
}

const SECTION_LABEL: Record<ArtistSection, string> = { about: 'About', tracks: 'Tracks', shows: 'Shows', insights: 'Insights' };

const getArtistMeta = cache((slug: string) =>
  db.profile.findUnique({
    where: { slug },
    select: { name: true, headline: true, genres: true, city: true, stateRegion: true, hypeCount: true, avatarImage: true },
  })
);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getArtistMeta(slug);
  if (!profile) return { title: 'Artist · iHYPE' };
  const location = [profile.city, profile.stateRegion].filter(Boolean).join(', ');
  return {
    title: `${profile.name} · iHYPE`,
    description: ['Artist', profile.genres.slice(0, 3).join(', ') || null, location || null].filter(Boolean).join(' · '),
  };
}

export default async function ArtistPage({
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
      _count: { select: { followers: true } },
      mediaUploads: {
        select: { hexId: true, title: true, notes: true, mimeType: true, fileSizeBytes: true, createdAt: true, freeUseEnabled: true, artworkUrl: true, sortOrder: true },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      },
    },
  });
  if (!profile || profile.type !== 'ARTIST') return notFound();
  if (shouldHideDemoContent() && isDemoUser(profile.owner)) return notFound();

  const isOwner = canManageOwnedResource(session, profile.ownerId);
  const themeVars = resolveProfileThemeVars(profile);
  const media = buildArtistMediaCollection(profile.mediaContent, profile.mediaUploads);
  const uploadHexIds = profile.mediaUploads.map((u) => u.hexId);
  const artworkUrl = getSafeImageUrl(profile.galleryImage || profile.heroImage);

  const [shows, userHype, playCounts, similarArtists] = await Promise.all([
    db.show.findMany({
      where: { headlinerProfileId: profile.id, ...getDemoCreatorExclusion() },
      include: { venueProfile: true },
      orderBy: { startsAt: 'asc' },
    }),
    session?.user?.id
      ? db.profileHypeEvent.findUnique({ where: { userId_profileId: { userId: session.user.id, profileId: profile.id } }, select: { userId: true } })
      : null,
    uploadHexIds.length > 0
      ? db.mediaListen.groupBy({ by: ['mediaId'], where: { mediaId: { in: uploadHexIds } }, _count: { _all: true } })
      : Promise.resolve([]),
    getSimilarArtists(profile.slug),
  ]);

  const playCountMap = new Map(playCounts.map((r) => [r.mediaId, r._count._all]));
  const totalPlays = playCounts.reduce((sum, r) => sum + r._count._all, 0);
  const pinnedStats = await getPinnedStatValues(profile.id, profile.type, profile.pinnedStats);

  const now = new Date();
  const upcomingShows = shows.filter((s) => s.status === 'LIVE' || s.startsAt >= now);

  return (
    <div className="artist-page" style={(themeVars ?? undefined) as React.CSSProperties | undefined}>
      <div className="artist-hero">
        <div className="artist-hero-row">
          <div className="artist-avatar">
            {profile.avatarImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt={profile.name} src={profile.avatarImage} fetchPriority="high" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
            ) : (
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 32 }}>{profile.name.charAt(0)}</span>
            )}
          </div>
          <div className="artist-hero-info" style={{ flex: 1 }}>
            <div className="artist-name">{profile.name}</div>
            <div className="artist-sub">{profile.genres.join(' · ')}{profile.city ? ` · ${profile.city}` : ''}</div>
            <div className="artist-hero-badges">
              <span className="artist-badge" style={{ background: 'rgba(255,80,41,.15)', color: 'var(--accent)' }}>Artist</span>
              {profile.verificationStatus === 'VERIFIED' && <span className="artist-badge" style={{ background: 'rgba(34,229,212,.15)', color: 'var(--role-venue, #22e5d4)' }}>✓ Verified</span>}
            </div>
            <div className="artist-hero-actions">
              <FollowButton profileId={profile.id} variant="hero" />
              <ShareButton className="artist-hero-btn" label="Share" path={`/artists/${profile.slug}`} title={profile.name} />
              {!isOwner && session?.user?.id && (
                <ReportButton className="artist-hero-btn" entityLabel="profile" targetId={profile.id} targetType="profile" />
              )}
              {isOwner && (
                <>
                  <FanMailButton profileId={profile.id} triggerClassName="artist-hero-btn" />
                  <Link className="artist-hero-btn" href="/pages">Customize</Link>
                  <Link className="artist-hero-btn" href="/settings">Settings</Link>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="artist-stats">
          <div><div className="artist-stat-val">{totalPlays.toLocaleString()}</div><div className="artist-stat-label">Total Plays</div></div>
          <div><div className="artist-stat-val">{profile.hypeCount.toLocaleString()}</div><div className="artist-stat-label">Total Hypes</div></div>
          <div><div className="artist-stat-val">{shows.length}</div><div className="artist-stat-label">Shows</div></div>
          <div><div className="artist-stat-val">{profile._count.followers.toLocaleString()}</div><div className="artist-stat-label">Followers</div></div>
        </div>
      </div>

      <div className="artist-content">
        <div className="artist-tabs">
          {artistSections.filter((section) => section !== 'insights' || isOwner).map((section) => (
            <Link className={section === activeSection ? 'artist-tab active' : 'artist-tab'} href={`/artists/${profile.slug}?section=${section}`} key={section}>
              {SECTION_LABEL[section]}
            </Link>
          ))}
        </div>

        {activeSection === 'about' && (
          <div>
            <p className="artist-about-text">{profile.aboutContent || profile.bio || 'This artist has not filled out the About section yet.'}</p>
            <PinnedStatTiles accent="var(--profile-accent, var(--accent))" stats={pinnedStats} />
            <div className="artist-split-card">
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-a50)' }}>Charter Split · Every ticket</div>
              <div className="artist-split-bar">
                <div className="artist-split-seg" style={{ flex: 7, background: 'rgba(255,80,41,.15)' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>70%</div>
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.12em', color: 'var(--accent)', marginTop: 4 }}>Artist</div>
                </div>
                <div className="artist-split-seg" style={{ flex: 2, background: 'rgba(34,229,212,.15)' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--role-venue, #22e5d4)' }}>20%</div>
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.12em', color: 'var(--role-venue, #22e5d4)', marginTop: 4 }}>Venue</div>
                </div>
                <div className="artist-split-seg" style={{ flex: 1, background: 'rgba(255,62,154,.15)' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#ff3e9a' }}>10%</div>
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.12em', color: '#ff3e9a', marginTop: 4 }}>Promoters</div>
                </div>
              </div>
              <p style={{ fontSize: 12, color: 'var(--ink-a55)', marginTop: 12 }}>iHYPE takes 0% · locked in the charter</p>
            </div>
            <SimilarArtistsRow accent="var(--profile-hero, linear-gradient(135deg,#ff5029,#b983ff))" artists={similarArtists} />
          </div>
        )}

        {activeSection === 'tracks' && (
          <>
            {isOwner && <TrackUploadPanel profileId={profile.id} profileType="ARTIST" />}
            {media.entries.length ? (
              <ArtistMediaPlaylist
                artistName={profile.name}
                artistSlug={profile.slug}
                artworkUrl={artworkUrl}
                entries={media.entries}
                isOwner={isOwner}
                playCountMap={Object.fromEntries(playCountMap)}
                profileId={profile.id}
              />
            ) : (
              <div className="artist-empty">
                <svg fill="none" height="34" stroke="var(--ink-a30)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="34"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
                <p>No tracks yet.</p>
              </div>
            )}
          </>
        )}

        {activeSection === 'shows' && (
          <div>
            {upcomingShows.length === 0 ? (
              <div className="artist-empty"><p>No upcoming shows.</p></div>
            ) : (
              upcomingShows.map((show) => {
                const date = show.startsAt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                return (
                  <Link className="artist-show-card" href={`/shows/${show.slug}`} key={show.id}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="artist-show-title">{show.title}</div>
                      <div className="artist-show-meta">{date}{show.venueProfile?.city ? ` · ${show.venueProfile.city}` : ''}</div>
                    </div>
                    <div style={{ flexShrink: 0 }}>
                      <div className="artist-show-price">{show.isTicketed && show.ticketPriceCents ? `$${(show.ticketPriceCents / 100).toFixed(0)}` : 'Free'}</div>
                      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.12em', color: 'var(--ink-a50)', textAlign: 'right' }}>$0 fees</div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        )}

        {activeSection === 'insights' && isOwner && (
          <>
            <ConnectPayoutButton
              profileId={profile.id}
              connected={profile.stripeConnectOnboarded}
              hasStarted={Boolean(profile.stripeConnectAccountId)}
            />
            <BookingRequestInbox profileId={profile.id} />
            <ProfileInsights profileId={profile.id} profileType={profile.type} />
          </>
        )}
      </div>

      <style>{`
        .artist-page { max-width: 640px; margin: 0 auto; padding: 32px 0 100px; }
        .artist-hero { padding: 40px 32px 32px; border-bottom: 1px solid var(--profile-border, var(--line)); background: var(--profile-hero, transparent); }
        .artist-hero-row { display: flex; gap: 32px; align-items: flex-start; flex-wrap: wrap; }
        .artist-avatar { width: 96px; height: 96px; border-radius: 50%; background: var(--profile-hero, linear-gradient(135deg,#ff5029,#b983ff)); flex-shrink: 0; display: flex; align-items: center; justify-content: center; color: #fff; overflow: hidden; }
        .artist-name { font-family: var(--font-display); font-size: 32px; font-weight: 800; letter-spacing: -.02em; margin-bottom: 6px; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .artist-sub { font-size: 14px; color: var(--ink-a65); margin-bottom: 14px; }
        .artist-hero-badges { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
        .artist-badge { display: inline-block; padding: 5px 12px; border-radius: 4px; font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: .14em; }
        .artist-hero-actions { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
        .artist-hero-btn { display: inline-flex; align-items: center; gap: 7px; padding: 10px 18px; border-radius: 9px; font-size: 13px; font-weight: 700; text-decoration: none; background: var(--line); color: var(--ink); border: 1px solid var(--hair-100); }
        .artist-hero-btn:hover { background: var(--hair-100); }
        .artist-stats { display: flex; gap: 32px; margin-top: 24px; padding-top: 24px; border-top: 1px solid var(--line); flex-wrap: wrap; }
        .artist-stat-val { font-size: 22px; font-weight: 700; color: var(--profile-accent, var(--accent)); font-family: var(--font-display); }
        .artist-stat-label { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: .14em; color: var(--ink-a55); margin-top: 2px; }
        .artist-content { padding: 0 32px; }
        .artist-tabs { display: flex; gap: 24px; border-bottom: 1px solid var(--line); margin: 28px 0; }
        .artist-tab { padding: 10px 0; border-bottom: 2px solid transparent; cursor: pointer; font-weight: 600; font-size: 14px; color: var(--ink-a60); text-decoration: none; }
        .artist-tab.active { color: var(--ink); border-color: var(--profile-accent, var(--accent)); }
        .artist-about-text { font-size: 15px; line-height: 1.7; color: var(--ink-a85); margin-bottom: 24px; white-space: pre-wrap; }
        .artist-split-card { border: 1px solid rgba(255,80,41,.2); border-radius: 10px; padding: 20px; background: rgba(255,80,41,.05); }
        .artist-split-bar { display: flex; border-radius: 8px; overflow: hidden; margin-top: 14px; }
        .artist-split-seg { flex: 1; padding: 12px; text-align: center; }
        .artist-empty { text-align: center; padding: 48px 24px; color: var(--ink-a50); }
        .artist-show-card { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 16px 18px; border: 1px solid var(--line); border-radius: 8px; background: var(--bg2); margin-bottom: 10px; text-decoration: none; color: inherit; }
        .artist-show-card:hover { background: var(--bg3); }
        .artist-show-title { font-family: var(--font-display); font-size: 15px; font-weight: 800; margin-bottom: 3px; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .artist-show-meta { font-size: 12px; color: var(--ink-a55); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .artist-show-price { font-size: 18px; font-weight: 700; color: var(--accent); text-align: right; flex-shrink: 0; }

        @media (max-width: 600px) {
          .artist-hero { padding: 28px 20px 24px; }
          .artist-hero-row { flex-direction: column; align-items: center; text-align: center; gap: 16px; }
          .artist-avatar { width: 88px; height: 88px; }
          .artist-hero-info { width: 100%; }
          .artist-hero-badges { justify-content: center; }
          .artist-hero-actions { width: 100%; flex-wrap: nowrap; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; justify-content: flex-start; }
          .artist-hero-actions::-webkit-scrollbar { display: none; }
          .artist-hero-actions > * { flex-shrink: 0; white-space: nowrap; min-height: 44px; }
          .artist-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; text-align: center; width: 100%; }
          .artist-content { padding: 0 20px; }
          .artist-tabs { gap: 0; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
          .artist-tabs::-webkit-scrollbar { display: none; }
          .artist-tab { flex: 1; min-width: max-content; text-align: center; padding: 12px 16px; min-height: 44px; display: flex; align-items: center; justify-content: center; }
          .artist-show-card { min-height: 44px; }
        }
      `}</style>
    </div>
  );
}
