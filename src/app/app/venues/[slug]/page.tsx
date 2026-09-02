import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { HypeButton } from '@/components/HypeButton';
import { FollowButton } from '@/components/FollowButton';
import { MmmMissing } from '@/components/mmm/MmmMissing';
import { getDemoCreatorExclusion, isDemoUser, shouldHideDemoContent } from '@/lib/runtime-flags';
import { upcomingShowWhere } from '@/lib/profile-detail';
import { ProfileTabs } from '@/components/profile/ProfileTabs';
import { VENUE_TABS, resolveTab } from '@/lib/profile-tabs';
import { ProfilePanel, RichContent, unwrap } from '@/components/profile/ProfilePanel';
import { ProfileCounters, ProfileRow } from '@/components/profile/ProfileRow';
import { MmmLikeButton } from '@/components/mmm/MmmLikeButton';
import { formatShowClock, formatTicketPrice, showRowTrail } from '@/lib/show-row';
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
  const [userHype, upcoming, ticketsSold] = await Promise.all([
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
          /* For the row's trail and price — the same fields the show page
             decides "on sale" from, so the row cannot disagree with it. */
          status: true,
          isTicketed: true,
          ticketingOpensAt: true,
          ticketPriceCents: true,
          headlinerProfile: { select: { name: true } },
        },
      })
      .catch(() => []),
    /* Paid tickets across every show hosted here — the public stat
       catalogue's venue figure, the same CAPTURED-only count the owner's
       insights use. Null, not 0, when the read fails. */
    db.ticketOrder
      .aggregate({ where: { show: { venueProfileId: profile.id }, status: 'CAPTURED' }, _sum: { quantity: true } })
      .then((totals) => totals._sum.quantity ?? 0)
      .catch((): number | null => null),
  ]);

  const where = [profile.city, profile.stateRegion].filter(Boolean).join(', ');
  const sub = [profile.roomType || null, where || null].filter(Boolean).join(' · ');
  const address = [profile.addressLine1, profile.city, profile.stateRegion].filter(Boolean).join(', ');

  /* ── Profile · venue ────────────────────────────────────────────────────
     The same console card the artist pane draws (`.mmm-profile-*` in
     mmm.css), with the venue hue on the band. Until 2026-09-02 this pane
     still carried the design before that one — a 250–390px cinematic cover
     at a 28px radius with the name set in 6vw over a veil — so the two
     profile panes were the same object drawn in two eras. */
  return (
    <div className="mmm-show mmm-public-profile" data-profile-type="venue">
      <Link className="mmm-show-back" href="/app/map">← Map</Link>

      <div className="mmm-profile-card">
        <div className="mmm-profile-band">
          {profile.heroImage && <img alt="" src={profile.heroImage} />}
          <span aria-hidden="true" className="mmm-profile-band-glare" />
        </div>

        <div className="mmm-profile-body">
          <div className="mmm-profile-head">
            <div className="mmm-profile-art">
              {profile.logoImage || profile.avatarImage ? (
                <img alt="" src={profile.logoImage || profile.avatarImage || ''} />
              ) : (
                <span>{profile.name.charAt(0)}</span>
              )}
            </div>
            <div className="mmm-profile-head-label">
              {/* `.mmm-show-eyebrow` is the hook e2e reads to tell this pane
                  from the artist's. */}
              <span className="mmm-show-eyebrow">
                {profile.verificationStatus === 'VERIFIED' ? 'VENUE · VERIFIED' : 'VENUE'}
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

          <div className="mmm-profile-actions">
            <HypeButton
              entityLabel="venue"
              initialCount={profile.hypeCount}
              lastHypedAt={userHype?.createdAt?.toISOString() ?? null}
              targetId={profile.id}
              targetType="profile"
            />
            <FollowButton profileId={profile.id} />
            {/* Remember this room. `/api/likes` has accepted VENUE since the
                model was written; the pane never offered it. */}
            <MmmLikeButton name={profile.name} targetId={profile.id} targetType="VENUE" />
          </div>

          {/* The public stat catalogue's three venue figures. Capacity moved to
              Venue Info, where a coordinator looks for it. */}
          <ProfileCounters
            counters={[
              { label: 'Hypes', value: profile.hypeCount },
              { label: 'Followers', value: profile._count.followers },
              { label: 'Tickets sold', value: ticketsSold },
            ]}
          />
        </div>
      </div>

      <ProfileTabs active={activeTab} label="Venue sections" tabs={VENUE_TABS} />

      {activeTab === 'calendar' && (
        <ProfilePanel
          tabId="calendar"
          empty="Nothing on the calendar yet."
          isEmpty={upcoming.length === 0}
          title="Event Calendar"
        >
          <ul className="mmm-profile-rows">
            {upcoming.map((show) => (
              <ProfileRow
                key={show.id}
                date={show.startsAt}
                href={`/app/shows/${show.slug}`}
                meta={[show.headlinerProfile?.name, formatShowClock(show.startsAt), formatTicketPrice(show)].filter(Boolean).join(' · ')}
                title={show.title}
                trail={showRowTrail(show, now)}
              />
            ))}
          </ul>
        </ProfilePanel>
      )}

      {activeTab === 'info' && (
        /* The room's spec plate: what a coordinator needs before a date is
           agreed. The address links back to the map — this is a map-first
           app, and the address used to be plain text on a page reached FROM
           the map. */
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
            {address && (
              <div>
                <dt>Address</dt>
                <dd>{address} · <Link href="/app/map?layer=venues">Map</Link></dd>
              </div>
            )}
            {profile.hoursText && <div><dt>Hours</dt><dd>{profile.hoursText}</dd></div>}
            <div>
              <dt>Identity</dt>
              <dd>{profile.verificationStatus === 'VERIFIED' ? 'Verified by iHYPE' : 'Not yet verified by iHYPE'}</dd>
            </div>
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
        /* Contact is also the coordination sheet (owner, 2026-09-02): the
           venue's own words first, then the terms every date here is booked
           under — where booking happens, the split the charter fixes, the
           ticket terms, the per-show lineup agreement. Every line points at
           something the product already holds; nothing here is a new document. */
        <ProfilePanel empty="" isEmpty={false} tabId="contact" title="Contact">
          {unwrap(profile.contactInfo)
            ? <RichContent value={profile.contactInfo} />
            : <p className="profile-standfirst">{profile.name} has not added contact details yet.</p>}
          <dl className="profile-facts profile-facts-coordination">
            <div>
              <dt>Booking</dt>
              <dd>Fans ask below; the venue books from its <Link href="/app/me/booking">demand radar</Link>.</dd>
            </div>
            <div>
              <dt>Split</dt>
              <dd>70% artist · 20% venue · 10% promoters, fixed by the <Link href="/info?tab=charter">charter</Link>.</dd>
            </div>
            <div>
              <dt>Lineup</dt>
              <dd>A multi-act bill splits the artist share by a lineup agreement every act accepts, on the show&apos;s own page.</dd>
            </div>
            <div>
              <dt>Tickets</dt>
              <dd>All sales are final; a cancelled show refunds every ticket. <Link href="/ticket-policy">Ticket policy</Link>.</dd>
            </div>
          </dl>
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
