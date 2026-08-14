import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { HypeButton } from '@/components/HypeButton';
import { FollowButton } from '@/components/FollowButton';
import { MmmMissing } from '@/components/mmm/MmmMissing';
import { formatShowTime } from '@/lib/utils';
import { getDemoCreatorExclusion, isDemoUser, shouldHideDemoContent } from '@/lib/runtime-flags';
import { heatLevel, HEAT_LABEL, HEAT_TOKEN } from '@/lib/heat-level';
import { upcomingShowWhere } from '@/lib/profile-detail';

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
export default async function MmmArtistPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
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
      genres: true,
      city: true,
      stateRegion: true,
      hypeCount: true,
      verificationStatus: true,
      owner: { select: { email: true, username: true } },
      _count: { select: { followers: true } },
    },
  });

  // Returned, not thrown — `notFound()` renders the shell twice here, because
  // this route's layout is async and has already flushed. See `MmmMissing`.
  if (!profile || profile.type !== 'ARTIST') return <MmmMissing title="No such artist" body="That profile may have been removed, or the link may be older than it is. The map still knows who is playing." />;
  if (shouldHideDemoContent() && isDemoUser(profile.owner)) return <MmmMissing title="No such artist" body="That profile may have been removed, or the link may be older than it is. The map still knows who is playing." />;

  const now = new Date();
  const [userHype, upcoming] = await Promise.all([
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
  ]);

  const where = [profile.city, profile.stateRegion].filter(Boolean).join(', ');
  const sub = [profile.genres.slice(0, 3).join(' · ') || null, where || null].filter(Boolean).join(' · ');

  return (
    <div className="mmm-show">
      <Link className="mmm-show-back" href="/app/music/charts">← Music</Link>

      <div className="mmm-show-eyebrow">Artist</div>
      <h1 className="mmm-show-title">{profile.name}</h1>
      {sub && <div className="mmm-show-where">{sub}</div>}

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

      {profile.headline && <p className="mmm-me-note">{profile.headline}</p>}

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

      <section className="mmm-profile-section">
        <h2 className="mmm-profile-section-title">Coming up</h2>
        {upcoming.length === 0 ? (
          <p className="mmm-me-note">No dates announced yet.</p>
        ) : (
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
      </section>

      {/* Named rather than hidden. Tracks, insights and the owner's own tools
          live on the full profile; saying so is better than a member wondering
          where the music went. */}
      <Link className="mmm-profile-full" href={`/artists/${profile.slug}`}>
        Tracks, releases and more on the full profile →
      </Link>
    </div>
  );
}
