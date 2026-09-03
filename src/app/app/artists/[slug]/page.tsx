import Link from 'next/link';
import { getSimilarArtists, type SimilarArtist } from '@/lib/sounds-like';
import { SimilarArtistsRow } from '@/components/SimilarArtistsRow';
import { NewsletterSignup } from '@/components/NewsletterSignup';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { HypeButton } from '@/components/HypeButton';
import { MmmLikeButton } from '@/components/mmm/MmmLikeButton';
import { FollowButton } from '@/components/FollowButton';
import { MmmMissing } from '@/components/mmm/MmmMissing';
import { MmmPlayHere } from '@/components/mmm/MmmPlayHere';
import { getDemoCreatorExclusion, isDemoUser, shouldHideDemoContent } from '@/lib/runtime-flags';
import { upcomingShowWhere } from '@/lib/profile-detail';
import { ProfileTabs } from '@/components/profile/ProfileTabs';
import { ARTIST_TABS, resolveTab } from '@/lib/profile-tabs';
import { ProfilePanel, RichContent, unwrap } from '@/components/profile/ProfilePanel';
import { ProfileCounters, ProfileRow } from '@/components/profile/ProfileRow';
import { formatShowClock, formatTicketPrice, showRowTrail } from '@/lib/show-row';
import { TrackUploadPanel } from '@/components/TrackUploadPanel';
import { ArtistRequestForm } from '@/components/ArtistRequestForm';

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
  /* The calendar's dates are stored at UTC midnight (the editor posts the
     date input as an ISO instant). A date is a calendar day, so it stays on
     the page through that day — and twelve hours past it, because a Portland
     artist's "tonight" is still today at 3am UTC and dropping the gig while
     the band is on stage would be the wrong kind of precise. */
  const calendarFloor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - 12 * 3_600_000);
  const [userHype, upcoming, releases, calendar, albums, listeners, similarArtists] = await Promise.all([
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
          /* For the row's trail and price — the same fields the show page
             decides "on sale" from, so the row cannot disagree with it. */
          status: true,
          isTicketed: true,
          ticketingOpensAt: true,
          ticketPriceCents: true,
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
          albumId: true,
          /* Selected so the dock's joystick can play this artist. The page
             listed their releases and offered no way to hear one. Nullable: an
             asset can be published before its audio is stored, and `toQueue`
             drops those rather than stalling the player on a dead entry. */
          storageUrl: true,
        },
      })
      .catch(() => []),
    /* The tour calendar — `AvailabilityDate` rows the artist entered in the
       editor. Two kinds on one calendar: TOUR is a date they are playing that
       is not ticketed here (a ticketed one is a Show and is already in
       `upcoming`); AVAILABLE is a date they are open to be booked, which the
       schema has always said venues see on the public page and which, until
       this query, nothing rendered. Both are what the editor's hint promises
       will appear here. */
    db.availabilityDate
      .findMany({
        where: { profileId: profile.id, date: { gte: calendarFloor } },
        orderBy: { date: 'asc' },
        take: 24,
        select: { id: true, date: true, note: true, kind: true },
      })
      .catch(() => []),
    /* The artist's album folders (2026-09-02). Tracks are grouped under them
       on the Albums tab; tracks in no folder list as singles below. A track's
       own cover wins; the album's fills in where a track has none. */
    db.album
      .findMany({
        where: { profileId: profile.id },
        orderBy: [{ sortOrder: 'asc' }, { releasedOn: 'desc' }, { createdAt: 'desc' }],
        select: { id: true, title: true, artworkUrl: true, releasedOn: true },
      })
      .catch(() => []),
    /* Distinct accounts that have played any of this artist's tracks — the
       public stat catalogue's listener figure, computed the way the owner's
       insights compute it (MediaListen is one row per listener per track).
       Null, not 0, when the read fails: a zero is a claim about the artist. */
    db.artistMediaAsset
      .findMany({ where: { profileId: profile.id }, select: { hexId: true } })
      .then((assets) => (assets.length
        ? db.mediaListen
          .findMany({ where: { mediaId: { in: assets.map((asset) => asset.hexId) } }, select: { userId: true }, distinct: ['userId'] })
          .then((rows) => rows.length)
        : 0))
      .catch((): number | null => null),
    /* Same-genre acts, ranked. Independently caught like every other read on
       this page: a similarity lookup that fails must cost the Bio tab a row,
       never the whole profile. */
    getSimilarArtists(profile.slug, 6).catch((): SimilarArtist[] => []),
  ]);
  const albumById = new Map(albums.map((album) => [album.id, album]));
  const coverFor = (release: { artworkUrl: string | null; albumId: string | null }) =>
    release.artworkUrl ?? (release.albumId ? albumById.get(release.albumId)?.artworkUrl ?? null : null);
  const albumGroups = albums
    .map((album) => ({ album, tracks: releases.filter((release) => release.albumId === album.id) }))
    .filter((group) => group.tracks.length > 0);
  const singles = releases.filter((release) => !release.albumId || !albumById.has(release.albumId));

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

      <div className="mmm-profile-card">
        <div className="mmm-profile-band">
          {/* The artist's own cover art still wins when they have uploaded one —
              the gradient is the ground beneath it, not a replacement for it. */}
          {profile.heroImage && <img alt="" src={profile.heroImage} />}
          <span aria-hidden="true" className="mmm-profile-band-glare" />
        </div>

        <div className="mmm-profile-body">
          <div className="mmm-profile-head">
            <div className="mmm-profile-art">
              {profile.avatarImage || profile.logoImage ? (
                <img alt="" src={profile.avatarImage || profile.logoImage || ''} />
              ) : (
                <span>{profile.name.charAt(0)}</span>
              )}
            </div>
            <div className="mmm-profile-head-label">
              {/* Keeps the `.mmm-show-eyebrow` hook: `e2e/mmm-panes.spec.ts`
                  reads it to tell the artist pane from the venue pane, and in
                  S6 this pill is what carries that label. */}
              <span className="mmm-show-eyebrow">
                {profile.verificationStatus === 'VERIFIED' ? 'ARTIST · VERIFIED' : 'ARTIST'}
              </span>
            </div>
          </div>

          <div>
            <h1 className="mmm-show-title">{profile.name}</h1>
            {sub && <div className="mmm-profile-sub">{sub}</div>}
          </div>

          {(profile.headline || profile.bio) && (
            <p className="mmm-profile-lede">{profile.headline || profile.bio}</p>
          )}

          {/* The two things a listener actually does here. Both are the real
              components the legacy page mounts — the hype cooldown, the optimistic
              count and the follow state are rules someone learned the hard way, and
              a second implementation of either would drift. The reference draws
              them as two equal pills; that is this row, not a reimplementation. */}
          <div className="mmm-profile-actions">
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

          {/* The public stat catalogue's three artist figures, as the console
              template draws them. "70% KEEPS" used to sit here — a charter
              constant that read the same on every artist, so it said nothing
              about this one — while the follower count was fetched and never
              shown. Listeners is distinct accounts that have played a track;
              a figure that could not be read is a dash, not a zero. */}
          <ProfileCounters
            counters={[
              { label: 'Hypes', value: profile.hypeCount },
              { label: 'Followers', value: profile._count.followers },
              { label: 'Listeners', value: listeners },
            ]}
          />
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
        artworkUrl: coverFor(release),
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
          {albumGroups.map(({ album, tracks }) => (
            <section className="profile-album" key={album.id}>
              <header className="profile-album-lead">
                {album.artworkUrl
                  ? <img alt="" className="profile-release-art" src={album.artworkUrl} />
                  : <span aria-hidden="true" className="profile-release-art" />}
                <span className="profile-release-body">
                  <span className="profile-release-title">{album.title}</span>
                  <span className="profile-release-meta">
                    {[
                      album.releasedOn ? album.releasedOn.getUTCFullYear() : null,
                      `${tracks.length} ${tracks.length === 1 ? 'track' : 'tracks'}`,
                    ].filter(Boolean).join(' · ')}
                  </span>
                </span>
              </header>
              <ul className="profile-releases">
                {tracks.map((release) => (
              <li key={release.id}>
                    <Link className="profile-release" href={`/app/tracks/${release.hexId}`}>
                      {coverFor(release)
                        ? <img alt="" className="profile-release-art" src={coverFor(release) ?? undefined} />
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
            </section>
          ))}
          {singles.length > 0 && (
            <section className="profile-album">
              {albumGroups.length > 0 && (
                <header className="profile-album-lead">
                  <span className="profile-release-body">
                    <span className="profile-release-title">Singles</span>
                  </span>
                </header>
              )}
              <ul className="profile-releases">
                {singles.map((release) => (
              <li key={release.id}>
                    <Link className="profile-release" href={`/app/tracks/${release.hexId}`}>
                      {coverFor(release)
                        ? <img alt="" className="profile-release-art" src={coverFor(release) ?? undefined} />
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
            </section>
          )}
        </ProfilePanel>
      )}

      {activeTab === 'tour' && (
        <ProfilePanel
          tabId="tour"
          empty="No dates announced yet."
          isEmpty={upcoming.length === 0 && calendar.length === 0 && !unwrap(profile.tourContent)}
          title="Tour"
        >
          {/* Legacy free text. The editor no longer writes it; a profile that
              set it before the calendar existed keeps its paragraph. */}
          <RichContent value={profile.tourContent} />
          {upcoming.length > 0 && (
            <ul className="mmm-profile-rows">
              {upcoming.map((show) => (
                <ProfileRow
                  key={show.id}
                  date={show.startsAt}
                  href={`/app/shows/${show.slug}`}
                  meta={[show.venueProfile?.name, show.venueProfile?.city, formatShowClock(show.startsAt), formatTicketPrice(show)]
                    .filter(Boolean)
                    .join(' · ')}
                  title={show.title}
                  trail={showRowTrail(show, now)}
                />
              ))}
            </ul>
          )}
          {calendar.length > 0 && (
            <ul className="mmm-profile-rows">
              {calendar.map((entry) => (
                /* UTC on purpose: the row IS a UTC-midnight day, and a local-time
                   read shifts it to the evening before for everyone west of
                   Greenwich. */
                <ProfileRow
                  key={entry.id}
                  date={entry.date}
                  meta={[
                    entry.kind === 'TOUR' ? 'Playing' : 'Open to book',
                    entry.date.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }),
                  ].join(' · ')}
                  title={entry.note || (entry.kind === 'TOUR' ? 'Playing' : 'Open to book')}
                  utc
                />
              ))}
            </ul>
          )}
        </ProfilePanel>
      )}

      {activeTab === 'tour' && (
        /* The fan's side of the artist's demand: ask this act to come to a
           venue near the fan, or one they follow. Same request row the venue
           page's form files, entered from here, so it lands on the venue's
           radar AND in this artist's analytics. On Tour because that is where
           a fan looks for a date near them and finds none. */
        <ProfilePanel empty="" isEmpty={false} tabId="tour" title={isOwner ? 'Where fans want you' : 'Want them near you?'}>
          {isOwner ? (
            <p className="profile-standfirst">
              Fans can ask a venue to book you from here. Every ask ranks on that venue&apos;s demand radar and on your{' '}
              <Link href={`/app/me/artists/${profile.slug}/analytics`}>analytics</Link>, weighed by how recently, how many, and how close they are.
            </p>
          ) : (
            <>
              <p className="profile-standfirst">
                Pick a venue near you, or one you follow, and {profile.name} and the venue both see the ask.
              </p>
              <ArtistRequestForm artistName={profile.name} artistProfileId={profile.id} />
            </>
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
          {/* "Sounds like" — `getSimilarArtists` narrows to same-genre acts in
              the database and asks the model to rank them, falling back to the
              most-hyped candidates when the binding is absent. Both it and this
              row were built and called by nothing; the lib's own docstring
              claimed "artist profile pages call this directly", and none did.
              It renders nothing when there is no genre overlap, which on a new
              install is most of the time. */}
          <SimilarArtistsRow accent="var(--accent)" artists={similarArtists} heading="Sounds like" />
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
        /* Contact is also the coordination sheet (owner, 2026-09-02: "paperwork
           legally bound and ready for event coordination"): the owner's own
           words first, then the facts a venue or promoter needs before a date
           is agreed — where booking happens, the press kit, the split the
           charter fixes, the ticket terms, and whether iHYPE has verified
           who this is. Every line points at something the product already
           holds; nothing here is a new document. */
        <ProfilePanel empty="" isEmpty={false} tabId="contact" title="Contact">
          {unwrap(profile.contactInfo)
            ? <RichContent value={profile.contactInfo} />
            : <p className="profile-standfirst">{profile.name} has not added contact details. Hype the profile and they will see the interest.</p>}
          <dl className="profile-facts profile-facts-coordination">
            <div>
              <dt>Booking</dt>
              <dd>
                Venues book from their <Link href="/app/me/booking">demand radar</Link>; fans <Link href="?tab=tour">ask a venue</Link> from Tour.
              </dd>
            </div>
            <div><dt>Press</dt><dd><Link href="?tab=press">Press kit</Link></dd></div>
            <div>
              <dt>Split</dt>
              <dd>70% artist · 20% venue · 10% promoters, fixed by the <Link href="/info?tab=charter">charter</Link>.</dd>
            </div>
            <div>
              <dt>Tickets</dt>
              <dd>All sales are final; a cancelled show refunds every ticket. <Link href="/ticket-policy">Ticket policy</Link>.</dd>
            </div>
            <div>
              <dt>Identity</dt>
              <dd>{profile.verificationStatus === 'VERIFIED' ? 'Verified by iHYPE' : 'Not yet verified by iHYPE'}</dd>
            </div>
          </dl>
          {/* Updates by email, for someone who does not want an account. The
              double opt-in is the route's; the confirmed row is now a real
              recipient of this profile's fan mail, which it was not before —
              the subscription existed and nothing ever sent to it. The picker
              is skipped: on this page the answer is this page. */}
          <div className="profile-newsletter">
            <h3 className="profile-panel-subhead">Get updates by email</h3>
            <NewsletterSignup fixedProfile={{ id: profile.id, name: profile.name, type: profile.type }} />
          </div>
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
