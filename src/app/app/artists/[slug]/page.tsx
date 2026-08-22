import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { HypeButton } from '@/components/HypeButton';
import { FollowButton } from '@/components/FollowButton';
import { MmmMissing } from '@/components/mmm/MmmMissing';
import { MmmPlayHere } from '@/components/mmm/MmmPlayHere';
import { formatShowTime } from '@/lib/utils';
import { getDemoCreatorExclusion, isDemoUser, shouldHideDemoContent } from '@/lib/runtime-flags';
import { heatLevel, HEAT_LABEL, HEAT_TOKEN } from '@/lib/heat-level';
import { upcomingShowWhere } from '@/lib/profile-detail';
import { ProfileTabs } from '@/components/profile/ProfileTabs';
import { ARTIST_TABS, resolveTab } from '@/lib/profile-tabs';
import { ProfilePanel, RichContent, unwrap } from '@/components/profile/ProfilePanel';

export const dynamic = 'force-dynamic';

/**
 * An artist profile, inside the Music · Map · Me shell.
 *
 * ## Why this exists
 *
 * MUSIC's chart rows and the in-shell show pane both linked at
 * `/artists/<slug>`, which renders in the LEGACY shell. Tapping a chart row
 * therefore dropped a member out of MMM — different header, different player —
 * and the only way back was a drawer row they had no reason to look for. Ten
 * such doors were open; this closes the most-trafficked one.
 *
 * ## What it deliberately does NOT do
 *
 * It is not a copy of the legacy artist page. That page also carries the media
 * playlist, the upload panel, insights, the booking inbox, pinned stat tiles,
 * similar-artists and Connect onboarding — owner tooling and long-tail surfaces
 * whose logic must not exist twice, which is the failure the LISTEN deck was
 * retired for. This pane carries who the artist is, the two things a listener
 * does (hype, follow) and what is coming up; everything else is one link away
 * and the link says so rather than pretending the extras are gone.
 *
 * Same split of responsibility `/app/shows/[slug]` already follows.
 */
export default async function MmmArtistPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { slug } = await params;
  const { tab: requestedTab } = await searchParams;
  const session = await auth();
  // The layout gates this too; every destination keeps its own check.
  if (!session?.user?.id) redirect(`/login?callbackUrl=/app/artists/${slug}`);

  const profile = await db.profile.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      type: true,
      headline: true,
      bio: true,
      heroImage: true,
      avatarImage: true,
      logoImage: true,
      genres: true,
      city: true,
      stateRegion: true,
      hypeCount: true,
      verificationStatus: true,
      /* The fixed subnav's content. All existing columns — this is a
         presentation change, not a schema one. */
      tourContent: true,
      merchContent: true,
      pressKitContent: true,
      contactInfo: true,
      owner: { select: { email: true, username: true } },
      _count: { select: { followers: true } },
    },
  });

  // Returned, not thrown — `notFound()` renders the shell twice here, because
  // this route's layout is async and has already flushed. See `MmmMissing`.
  if (!profile || profile.type !== 'ARTIST') return <MmmMissing title="No such artist" body="That profile may have been removed, or the link may be older than it is. The map still knows who is playing." />;
  if (shouldHideDemoContent() && isDemoUser(profile.owner)) return <MmmMissing title="No such artist" body="That profile may have been removed, or the link may be older than it is. The map still knows who is playing." />;

  const activeTab = resolveTab(ARTIST_TABS, requestedTab);

  const now = new Date();
  const [userHype, upcoming, releases] = await Promise.all([
    db.profileHypeEvent
      .findUnique({
        where: { userId_profileId: { userId: session.user.id, profileId: profile.id } },
        select: { createdAt: true },
      })
      .catch(() => null),
    db.show
      .findMany({
        where: {
          headlinerProfileId: profile.id,
          /* `upcomingShowWhere` rather than `status in (...) AND startsAt >=
             now`, which is what stood here and which silently dropped the one
             show a member is most likely looking for: a LIVE show that started
             an hour ago fails the clock test. See `@/lib/profile-detail`. */
          ...upcomingShowWhere(now),
          ...getDemoCreatorExclusion(),
        },
        orderBy: { startsAt: 'asc' },
        take: 6,
        select: {
          id: true,
          slug: true,
          title: true,
          startsAt: true,
          hypeCount: true,
          venueProfile: { select: { name: true, city: true } },
        },
      })
      .catch(() => []),
    /* Albums. Published assets only — an unpublished upload is one the artist
       or a moderator has pulled, and the public profile is exactly where that
       must be honoured. Independently `.catch()`'d like its siblings, so a
       failure here empties one tab rather than 500-ing the profile. */
    db.artistMediaAsset
      .findMany({
        where: {
          profileId: profile.id,
          isPublished: true,
          /* `publishAt` is a scheduled release date. A row can be published
             AND dated forward; showing it early would leak an unannounced
             release from the one page fans watch. Null means "no embargo". */
          OR: [{ publishAt: null }, { publishAt: { lte: now } }],
        },
        // The artist's own ordering first — sortOrder is what the upload panel
        // lets them drag — and newest first only to break ties.
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        take: 24,
        select: {
          id: true,
          hexId: true,
          title: true,
          artworkUrl: true,
          durationSecs: true,
          createdAt: true,
          /* Selected so the dock's joystick can play this artist. The page
             listed their releases and offered no way to hear one. Nullable: an
             asset can be published before its audio is stored, and `toQueue`
             drops those rather than stalling the player on a dead entry. */
          storageUrl: true,
        },
      })
      .catch(() => []),
  ]);

  const where = [profile.city, profile.stateRegion].filter(Boolean).join(', ');
  const sub = [profile.genres.slice(0, 3).join(' · ') || null, where || null].filter(Boolean).join(' · ');

  return (
    <div className="mmm-show mmm-public-profile" data-profile-type="artist">
      <Link className="mmm-show-back" href="/app/music/charts">← Music</Link>

      <header className="mmm-profile-hero">
        {profile.heroImage ? <img alt="" className="mmm-profile-cover" src={profile.heroImage} /> : <span aria-hidden="true" className="mmm-profile-cover mmm-profile-cover-fallback" />}
        <span aria-hidden="true" className="mmm-profile-cover-veil" />
        <div className="mmm-profile-identity">
          <div className="mmm-profile-avatar">
            {profile.avatarImage || profile.logoImage ? <img alt="" src={profile.avatarImage || profile.logoImage || ''} /> : <span>{profile.name.charAt(0)}</span>}
          </div>
          <div>
            <div className="mmm-show-eyebrow">Artist profile</div>
            <h1 className="mmm-show-title">{profile.name}</h1>
            {sub && <div className="mmm-show-where">{sub}</div>}
          </div>
        </div>
      </header>

      <div className="mmm-profile-badges">
        {profile.verificationStatus === 'VERIFIED' && (
          <span className="mmm-profile-badge" data-kind="verified">Verified</span>
        )}
        <span className="mmm-profile-badge" data-kind="hypes">
          {profile.hypeCount.toLocaleString()} hypes
        </span>
        <span className="mmm-profile-badge" data-kind="followers">
          {profile._count.followers.toLocaleString()} followers
        </span>
      </div>

      {(profile.headline || profile.bio) && (
        <section className="mmm-profile-about mmm-card">
          <span className="mmm-eyebrow">About</span>
          {profile.headline && <h2>{profile.headline}</h2>}
          {profile.bio && <p>{profile.bio}</p>}
        </section>
      )}

      {/* The two things a listener actually does here. Both are the real
          components the legacy page mounts — the hype cooldown, the optimistic
          count and the follow state are rules someone learned the hard way, and
          a second implementation of either would drift. */}
      <div className="mmm-profile-actions">
        <HypeButton
          entityLabel="artist"
          initialCount={profile.hypeCount}
          lastHypedAt={userHype?.createdAt?.toISOString() ?? null}
          targetId={profile.id}
          targetType="profile"
        />
        <FollowButton profileId={profile.id} />
      </div>

      {/* Renders nothing; hands this artist's published releases to the dock's
          transport, in the artist's own order. Registered outside the tab
          condition on purpose: the joystick should play them whichever section
          of the profile is showing. */}
      <MmmPlayHere rows={releases.map((release) => ({
        hexId: release.hexId,
        title: release.title,
        artistName: profile.name,
        artistSlug: profile.slug,
        mediaUrl: release.storageUrl,
        artworkUrl: release.artworkUrl,
      }))} />

      <ProfileTabs active={activeTab} label="Artist sections" tabs={ARTIST_TABS} />

      {activeTab === 'albums' && (
        <ProfilePanel
          tabId="albums"
          empty={`${profile.name} has not published any releases yet.`}
          isEmpty={releases.length === 0}
          title="Albums"
        >
          <ul className="profile-releases">
            {releases.map((release) => (
              <li key={release.id}>
                <Link className="profile-release" href={`/app/tracks/${release.hexId}`}>
                  {release.artworkUrl
                    ? <img alt="" className="profile-release-art" src={release.artworkUrl} />
                    : <span aria-hidden="true" className="profile-release-art" />}
                  <span className="profile-release-body">
                    <span className="profile-release-title">{release.title}</span>
                    <span className="profile-release-meta">
                      {[
                        release.durationSecs
                          ? `${Math.floor(release.durationSecs / 60)}:${String(release.durationSecs % 60).padStart(2, '0')}`
                          : null,
                        release.createdAt.getFullYear(),
                      ].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </ProfilePanel>
      )}

      {activeTab === 'tour' && (
        <ProfilePanel
          tabId="tour"
          empty="No dates announced yet."
          isEmpty={upcoming.length === 0 && !unwrap(profile.tourContent)}
          title="Tour"
        >
          <RichContent value={profile.tourContent} />
          {upcoming.length > 0 && (
            <ul className="mmm-profile-shows">
              {upcoming.map((show) => {
                const heat = heatLevel(show.hypeCount);
                return (
                  <li key={show.id}>
                    <Link className="mmm-profile-show" href={`/app/shows/${show.slug}`}>
                      <span
                        aria-label={HEAT_LABEL[heat]}
                        className="mmm-profile-heat"
                        role="img"
                        style={{ background: HEAT_TOKEN[heat] }}
                        title={HEAT_LABEL[heat]}
                      />
                      <span className="mmm-profile-show-main">
                        <span className="mmm-profile-show-when">{formatShowTime(show.startsAt)}</span>
                        <span className="mmm-profile-show-title">{show.title}</span>
                        <span className="mmm-profile-show-where">
                          {[show.venueProfile?.name, show.venueProfile?.city].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </ProfilePanel>
      )}

      {activeTab === 'bio' && (
        <ProfilePanel
          tabId="bio"
          empty={`${profile.name} has not written a bio yet.`}
          isEmpty={!profile.headline && !profile.bio}
          title="Bio"
        >
          {profile.headline && <p className="profile-standfirst">{profile.headline}</p>}
          <RichContent value={profile.bio} />
        </ProfilePanel>
      )}

      {activeTab === 'merch' && (
        <ProfilePanel
          tabId="merch"
          empty={`${profile.name} is not selling merch through iHYPE yet.`}
          isEmpty={!unwrap(profile.merchContent)}
          title="Merch"
        >
          <RichContent value={profile.merchContent} />
        </ProfilePanel>
      )}

      {activeTab === 'contact' && (
        <ProfilePanel
          tabId="contact"
          empty={`${profile.name} has not added contact details. Hype the profile and they will see the interest.`}
          isEmpty={!unwrap(profile.contactInfo)}
          title="Contact"
        >
          <RichContent value={profile.contactInfo} />
        </ProfilePanel>
      )}

      {activeTab === 'press' && (
        <ProfilePanel
          tabId="press"
          empty={`${profile.name} has not published a press kit yet.`}
          isEmpty={!unwrap(profile.pressKitContent)}
          title="Press Kit"
        >
          <RichContent value={profile.pressKitContent} />
        </ProfilePanel>
      )}

    </div>
  );
}
