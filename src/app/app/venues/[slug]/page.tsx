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
import { ProfileTabs } from '@/components/profile/ProfileTabs';
import { VENUE_TABS, resolveTab } from '@/lib/profile-tabs';
import { ProfilePanel, RichContent, unwrap } from '@/components/profile/ProfilePanel';
import { VenueRequestForm } from '@/components/VenueRequestForm';

export const dynamic = 'force-dynamic';

/**
 * A venue, inside the shell.
 *
 * This one matters more than its size suggests: **MAP is the base layer of the
 * whole shell, and its bottom sheet's PRIMARY action was "Open venue page",
 * pointing at `/venues/<slug>` in the legacy shell.** Tapping a pin on the map
 * — the single most obvious gesture in the product — left the design. The map
 * sheet's venue and event cards and universal search all landed in the same
 * place.
 *
 * Same split as the artist pane: identity, the two listener actions, and the
 * calendar. The booking inbox, analytics, owner tooling and the full calendar
 * stay on the legacy page, linked once and labelled.
 */
export default async function MmmVenuePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { slug } = await params;
  const { tab: requestedTab } = await searchParams;
  const session = await auth();
  if (!session?.user?.id) redirect(`/login?callbackUrl=/app/venues/${slug}`);

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
      city: true,
      stateRegion: true,
      capacity: true,
      hypeCount: true,
      verificationStatus: true,
      /* The fixed subnav's content — all existing columns. `requestContent`
         backs Rules & FAQs; see the note in @/lib/profile-tabs about why that
         is a borrowed field and what it would take to give it its own. */
      roomType: true,
      addressLine1: true,
      hoursText: true,
      contactInfo: true,
      requestContent: true,
      ownerId: true,
      owner: { select: { email: true, username: true } },
      _count: { select: { followers: true } },
    },
  });

  const missing = (
    <MmmMissing
      body="It may have been removed, or the link may be older than it is. The map still knows what is open tonight."
      title="No such venue"
    />
  );
  // Returned, not thrown — see `MmmMissing`.
  if (!profile || profile.type !== 'VENUE') return missing;
  if (shouldHideDemoContent() && isDemoUser(profile.owner)) return missing;

  const activeTab = resolveTab(VENUE_TABS, requestedTab);
  const isOwner = profile.ownerId === session.user.id;

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
          venueProfileId: profile.id,
          /* See `@/lib/profile-detail`: `status in (...) AND startsAt >= now`
             drops the show currently on stage, which on a VENUE page is the
             one most worth showing. */
          ...upcomingShowWhere(now),
          ...getDemoCreatorExclusion(),
        },
        orderBy: { startsAt: 'asc' },
        take: 8,
        select: {
          id: true,
          slug: true,
          title: true,
          startsAt: true,
          hypeCount: true,
          headlinerProfile: { select: { name: true } },
        },
      })
      .catch(() => []),
  ]);

  const where = [profile.city, profile.stateRegion].filter(Boolean).join(', ');

  return (
    <div className="mmm-show mmm-public-profile" data-profile-type="venue">
      <Link className="mmm-show-back" href="/app/map">← Map</Link>

      <header className="mmm-profile-hero">
        {profile.heroImage ? <img alt="" className="mmm-profile-cover" src={profile.heroImage} /> : <span aria-hidden="true" className="mmm-profile-cover mmm-profile-cover-fallback" />}
        <span aria-hidden="true" className="mmm-profile-cover-veil" />
        <div className="mmm-profile-identity">
          <div className="mmm-profile-avatar">
            {profile.logoImage || profile.avatarImage ? <img alt="" src={profile.logoImage || profile.avatarImage || ''} /> : <span>{profile.name.charAt(0)}</span>}
          </div>
          <div>
            <div className="mmm-show-eyebrow">Venue profile</div>
            <h1 className="mmm-show-title">{profile.name}</h1>
            {where && <div className="mmm-show-where">{where}</div>}
          </div>
        </div>
      </header>

      <div className="mmm-profile-badges">
        {profile.verificationStatus === 'VERIFIED' && (
          <span className="mmm-profile-badge" data-kind="verified">Verified</span>
        )}
        {profile.capacity ? (
          <span className="mmm-profile-badge">Capacity {profile.capacity.toLocaleString()}</span>
        ) : null}
        <span className="mmm-profile-badge">{profile.hypeCount.toLocaleString()} hypes</span>
        <span className="mmm-profile-badge">
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

      <div className="mmm-profile-actions">
        <HypeButton
          entityLabel="venue"
          initialCount={profile.hypeCount}
          lastHypedAt={userHype?.createdAt?.toISOString() ?? null}
          targetId={profile.id}
          targetType="profile"
        />
        <FollowButton profileId={profile.id} />
      </div>

      <ProfileTabs active={activeTab} label="Venue sections" tabs={VENUE_TABS} />

      {activeTab === 'calendar' && (
        <ProfilePanel
          tabId="calendar"
          empty="Nothing on the calendar yet."
          isEmpty={upcoming.length === 0}
          title="Event Calendar"
        >
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
                        {show.headlinerProfile?.name ?? ''}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </ProfilePanel>
      )}

      {activeTab === 'info' && (
        <ProfilePanel
          tabId="info"
          empty={`${profile.name} has not added room details yet.`}
          isEmpty={
            !profile.capacity && !profile.roomType && !profile.addressLine1
            && !profile.hoursText && !profile.bio && !profile.headline
          }
          title="Venue Info"
        >
          {profile.headline && <p className="profile-standfirst">{profile.headline}</p>}
          <dl className="profile-facts">
            {profile.capacity && (
              <div><dt>Capacity</dt><dd>{profile.capacity.toLocaleString()}</dd></div>
            )}
            {profile.roomType && <div><dt>Room</dt><dd>{profile.roomType}</dd></div>}
            {profile.addressLine1 && (
              <div>
                <dt>Address</dt>
                <dd>{[profile.addressLine1, profile.city, profile.stateRegion].filter(Boolean).join(', ')}</dd>
              </div>
            )}
            {profile.hoursText && <div><dt>Hours</dt><dd>{profile.hoursText}</dd></div>}
          </dl>
          <RichContent value={profile.bio} />
        </ProfilePanel>
      )}

      {activeTab === 'rules' && (
        <ProfilePanel
          tabId="rules"
          empty={`${profile.name} has not published house rules yet. Ask them through Contact.`}
          isEmpty={!unwrap(profile.requestContent)}
          title="Rules & FAQs"
        >
          <RichContent value={profile.requestContent} />
        </ProfilePanel>
      )}

      {activeTab === 'contact' && (
        <ProfilePanel
          tabId="contact"
          empty={`${profile.name} has not added contact details yet.`}
          isEmpty={!unwrap(profile.contactInfo)}
          title="Contact"
        >
          <RichContent value={profile.contactInfo} />
        </ProfilePanel>
      )}

      {activeTab === 'contact' && (
        /* The fan's side of the demand radar. `VenueRequestForm` posts to
           /api/venue-requests and, until 2026-09-01, was mounted on no page —
           fans could not ask a venue for anyone, so the venue's radar had
           nothing to analyse. It lives on Contact because "bring this act
           here" is the one thing a fan has to say to a venue. The owner sees
           where the answers land instead of a form addressed to themselves. */
        <ProfilePanel empty="" isEmpty={false} tabId="contact" title="Ask them to book someone">
          {isOwner ? (
            <p className="profile-standfirst">
              Fans use this form to ask you to book an act. Their requests rank on your{' '}
              <Link href="/app/me/booking">demand radar</Link>, weighed by how recently, how many, and how close they are.
            </p>
          ) : (
            <>
              <p className="profile-standfirst">
                Want to see someone play here? Name the act and {profile.name} sees the request, ranked with everyone else who asked.
              </p>
              <VenueRequestForm venueProfileId={profile.id} />
            </>
          )}
        </ProfilePanel>
      )}

    </div>
  );
}
