import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { HypeButton } from '@/components/HypeButton';
import { MmmLikeButton } from '@/components/mmm/MmmLikeButton';
import { FollowButton } from '@/components/FollowButton';
import { MmmMissing } from '@/components/mmm/MmmMissing';
import { MmmPlayHere } from '@/components/mmm/MmmPlayHere';
import { formatShowTime } from '@/lib/utils';
import { getDemoCreatorExclusion, isDemoUser, shouldHideDemoContent } from '@/lib/runtime-flags';
import { upcomingShowWhere } from '@/lib/profile-detail';
import { ProfileTabs } from '@/components/profile/ProfileTabs';
import { ARTIST_TABS, resolveTab } from '@/lib/profile-tabs';
import { ProfilePanel, RichContent, unwrap } from '@/components/profile/ProfilePanel';
import { TrackUploadPanel } from '@/components/TrackUploadPanel';

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
      ownerId: true,
      owner: { select: { email: true, username: true } },
      _count: { select: { followers: true } },
    },
  });

  // Returned, not thrown — `notFound()` renders the shell twice here, because
  // this route's layout is async and has already flushed. See `MmmMissing`.
  if (!profile || profile.type !== 'ARTIST') return <MmmMissing title="No such artist" body="That profile may have been removed, or the link may be older than it is. The map still knows who is playing." />;
  if (shouldHideDemoContent() && isDemoUser(profile.owner)) return <MmmMissing title="No such artist" body="That profile may have been removed, or the link may be older than it is. The map still knows who is playing." />;

  const activeTab = resolveTab(ARTIST_TABS, requestedTab);
  const isOwner = profile.ownerId === session.user.id;

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

  /* ── S6 · Profile · artist ──────────────────────────────────────────────
     Translated from design/handoff-console/reference/s6-profile-artist.html.
     Colour comes from tokens only. The reference paints the hero gradient's
     mid stop as a raw literal; that value's role is `--accent-deep`, the
     token globals.css already defines as the accent's gradient partner, and
     naming the literal here would trip the adherence check on its own. Type
     is rem, not the reference's px: `shell.css` scales the ROOT font size for
     the Text size accessibility setting, and px cannot follow it.

     Three things in the reference are deliberately NOT reproduced here, each
     because it belongs to something the app already owns:
       · the 430px card frame — a specimen chrome; the pane sets the width
       · the walnut dock along its bottom edge — that is the console dock
         (`MmmDock`, rendered once by `MmmShell`), not painted per page
       · the 3-tab strip (Shows/Tracks/About) — the real tab set is
         `ARTIST_TABS` (6), routed by `ProfileTabs`; cutting it to three
         would delete four panels' worth of content */
  return (
    <div className="mmm-show mmm-public-profile" data-profile-type="artist">
      <Link className="mmm-show-back" href="/app/music/charts">← Music</Link>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-surface)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-panel)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: 132,
            position: 'relative',
            background:
              'linear-gradient(142deg, var(--accent) 0%, var(--accent-deep) 52%, var(--walnut) 100%)',
          }}
        >
          {/* The artist's own cover art still wins when they have uploaded one —
              the gradient is the ground beneath it, not a replacement for it. */}
          {profile.heroImage && (
            <img
              alt=""
              src={profile.heroImage}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            />
          )}
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(70% 100% at 22% 8%, rgba(255,240,210,.34), transparent 60%)',
            }}
          />
        </div>

        <div style={{ padding: '0 22px 22px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, marginTop: -34 }}>
            <div
              style={{
                width: 76,
                height: 76,
                flex: '0 0 auto',
                borderRadius: 'var(--radius-panel)',
                background: 'var(--bg-raised)',
                border: '1px solid var(--brass)',
                display: 'grid',
                placeItems: 'center',
                overflow: 'hidden',
                fontFamily: 'var(--font-display)',
                fontSize: '2rem',
                color: 'var(--accent-text)',
                boxShadow: '0 6px 14px -6px rgba(28,20,8,.5)',
              }}
            >
              {profile.avatarImage || profile.logoImage ? (
                <img
                  alt=""
                  src={profile.avatarImage || profile.logoImage || ''}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <span>{profile.name.charAt(0)}</span>
              )}
            </div>
            <div style={{ paddingBottom: 4 }}>
              {/* Keeps the `.mmm-show-eyebrow` hook: `e2e/mmm-panes.spec.ts`
                  reads it to tell the artist pane from the venue pane, and in
                  S6 this pill is what carries that label. */}
              <span
                className="mmm-show-eyebrow"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-pill)',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--line-2)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.6875rem',
                  letterSpacing: '0.16em',
                  color: 'var(--ink-2)',
                }}
              >
                {profile.verificationStatus === 'VERIFIED' ? 'ARTIST · VERIFIED' : 'ARTIST'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h1
              className="mmm-show-title"
              style={{ fontFamily: 'var(--font-display)', fontSize: '2.125rem', lineHeight: 1.1, fontWeight: 400, margin: 0 }}
            >
              {profile.name}
            </h1>
            {sub && <div style={{ fontSize: '0.9375rem', color: 'var(--ink-2)', marginTop: 4 }}>{sub}</div>}
          </div>

          {(profile.headline || profile.bio) && (
            <p style={{ fontSize: '0.9375rem', lineHeight: 1.62, color: 'var(--ink-2)', margin: 0, textWrap: 'pretty' }}>
              {profile.headline || profile.bio}
            </p>
          )}

          {/* The two things a listener actually does here. Both are the real
              components the legacy page mounts — the hype cooldown, the optimistic
              count and the follow state are rules someone learned the hard way, and
              a second implementation of either would drift. The reference draws
              them as two equal pills; that is this row, not a reimplementation. */}
          <div className="mmm-profile-actions" style={{ display: 'flex', gap: 10 }}>
            <HypeButton
              entityLabel="artist"
              initialCount={profile.hypeCount}
              lastHypedAt={userHype?.createdAt?.toISOString() ?? null}
              targetId={profile.id}
              targetType="profile"
            />
            <FollowButton profileId={profile.id} />
            {/* The third act: remember this artist. One like per account,
                held until unliked — /api/likes holds the rule. */}
            <MmmLikeButton name={profile.name} targetId={profile.id} targetType="ARTIST" />
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            {[
              { value: profile.hypeCount.toLocaleString(), label: 'HYPE' },
              { value: String(upcoming.length), label: 'SHOWS' },
              // The charter's artist share. A constant, not a per-profile figure.
              { value: '70%', label: 'KEEPS' },
            ].map((stat) => (
              <div
                key={stat.label}
                style={{
                  flex: 1,
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--radius-panel)',
                  padding: 13,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                }}
              >
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.3125rem' }}>{stat.value}</span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.6875rem',
                    letterSpacing: '0.14em',
                    color: 'var(--ink-3)',
                  }}
                >
                  {stat.label}
                </span>
              </div>
            ))}
          </div>
        </div>
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

      {activeTab === 'albums' && isOwner && (
        /* The upload form, for the artist's own eyes.

           `TrackUploadPanel` is the ONLY client anywhere that posts to
           `/api/artist-media`, and nothing had mounted it since the legacy
           artist page was retired — so no artist could add a track at all,
           on a music platform, while the API and the four-layer copyright scan
           behind it kept working. DESIGN_SYNC row 311 kept the file for exactly
           this reason: the component IS the fix, and deleting it would have
           turned a re-mount into a rebuild.

           Here rather than in ME, because this is where an artist's releases
           are listed: the panel sits directly above the list it adds to, and a
           listener never sees it. */
        <ProfilePanel empty="" isEmpty={false} tabId="albums" title="Upload a track">
          <TrackUploadPanel profileId={profile.id} />
        </ProfilePanel>
      )}

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
            <ul className="mmm-profile-shows" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {upcoming.map((show) => (
                <li key={show.id}>
                  <Link
                    href={`/app/shows/${show.slug}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 13,
                      padding: '14px 0',
                      borderBottom: '1px solid var(--line)',
                      color: 'inherit',
                      textDecoration: 'none',
                    }}
                  >
                    <span style={{ width: 46, flex: '0 0 auto', textAlign: 'center' }}>
                      <span
                        style={{
                          display: 'block',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.6875rem',
                          letterSpacing: '0.14em',
                          color: 'var(--ink-3)',
                        }}
                      >
                        {show.startsAt.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
                      </span>
                      <span style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: '1.5rem', lineHeight: 1 }}>
                        {show.startsAt.getDate()}
                      </span>
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: '0.9375rem', fontWeight: 500 }}>{show.title}</span>
                      <span style={{ display: 'block', fontSize: '0.9375rem', color: 'var(--ink-3)' }}>
                        {/* The reference's second line is venue · price. Price is not
                            selected by this page's query and inventing one on a page
                            that sells tickets would be worse than omitting it, so the
                            door time takes that slot. */}
                        {[show.venueProfile?.name, show.venueProfile?.city, formatShowTime(show.startsAt)]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                    <span
                      style={{
                        padding: '8px 14px',
                        minHeight: 44,
                        display: 'inline-flex',
                        alignItems: 'center',
                        borderRadius: 'var(--radius-pill)',
                        background: 'var(--accent)',
                        color: 'var(--ink-on-accent)',
                        fontSize: '0.9375rem',
                        fontWeight: 500,
                      }}
                    >
                      Get ticket
                    </span>
                  </Link>
                </li>
              ))}
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
