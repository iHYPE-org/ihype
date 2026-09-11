import Link from 'next/link';
import { NewsletterSignup } from '@/components/NewsletterSignup';
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
import { getServerT } from '@/lib/i18n/server';
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

  const missing = <MmmMissing kind="venue" />;
  // Returned, not thrown — see `MmmMissing`.
  if (!profile || profile.type !== 'VENUE') return missing;
  if (shouldHideDemoContent() && isDemoUser(profile.owner)) return missing;

  const t = await getServerT();
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
      <Link className="mmm-show-back" href="/app/map">← {t('venuePane.backMap', 'Map')}</Link>

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
                {profile.verificationStatus === 'VERIFIED' ? t('venuePane.eyebrowVerified', 'VENUE · VERIFIED') : t('venuePane.eyebrow', 'VENUE')}
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
              { label: t('profilePane.counterHypes', 'Hypes'), value: profile.hypeCount },
              { label: t('profilePane.counterFollowers', 'Followers'), value: profile._count.followers },
              { label: t('venuePane.counterTicketsSold', 'Tickets sold'), value: ticketsSold },
            ]}
          />
        </div>
      </div>

      <ProfileTabs active={activeTab} label={t('venuePane.sectionsAria', 'Venue sections')} tabs={VENUE_TABS} />

      {activeTab === 'calendar' && (
        <ProfilePanel
          tabId="calendar"
          empty={t('venuePane.calendarEmpty', 'Nothing on the calendar yet.')}
          isEmpty={upcoming.length === 0}
          title={t('mmmStrip.eventCalendar', 'Event Calendar')}
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
          empty={t('venuePane.infoEmpty', '{name} has not added room details yet.').replace('{name}', profile.name)}
          isEmpty={
            !profile.capacity && !profile.roomType && !profile.addressLine1
            && !profile.hoursText && !profile.bio && !profile.headline
          }
          title={t('mmmStrip.venueInfo', 'Venue Info')}
        >
          {profile.headline && <p className="profile-standfirst">{profile.headline}</p>}
          <dl className="profile-facts">
            {profile.capacity && (
              <div><dt>{t('venuePane.factCapacity', 'Capacity')}</dt><dd>{profile.capacity.toLocaleString()}</dd></div>
            )}
            {profile.roomType && <div><dt>{t('venuePane.factRoom', 'Room')}</dt><dd>{profile.roomType}</dd></div>}
            {address && (
              <div>
                <dt>{t('venuePane.factAddress', 'Address')}</dt>
                <dd>{address} · <Link href="/app/map?layer=venues">{t('venuePane.backMap', 'Map')}</Link></dd>
              </div>
            )}
            {profile.hoursText && <div><dt>{t('venuePane.factHours', 'Hours')}</dt><dd>{profile.hoursText}</dd></div>}
            <div>
              <dt>{t('profilePane.factIdentity', 'Identity')}</dt>
              <dd>{profile.verificationStatus === 'VERIFIED' ? t('profilePane.verifiedByIhype', 'Verified by iHYPE') : t('profilePane.notVerifiedByIhype', 'Not yet verified by iHYPE')}</dd>
            </div>
          </dl>
          <RichContent value={profile.bio} />
        </ProfilePanel>
      )}

      {activeTab === 'rules' && (
        <ProfilePanel
          tabId="rules"
          empty={t('venuePane.rulesEmpty', '{name} has not published house rules yet. Ask them through Contact.').replace('{name}', profile.name)}
          isEmpty={!unwrap(profile.requestContent)}
          title={t('mmmStrip.rulesFaqs', 'Rules & FAQs')}
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
        <ProfilePanel empty="" isEmpty={false} tabId="contact" title={t('mmmStrip.contact', 'Contact')}>
          {unwrap(profile.contactInfo)
            ? <RichContent value={profile.contactInfo} />
            : <p className="profile-standfirst">{t('venuePane.contactEmpty', '{name} has not added contact details yet.').replace('{name}', profile.name)}</p>}
          <dl className="profile-facts profile-facts-coordination">
            <div>
              <dt>{t('profilePane.factBooking', 'Booking')}</dt>
              <dd>{t('venuePane.factBookingBody', 'Fans ask below; the venue books from its')} <Link href="/app/me/booking">{t('profilePane.demandRadar', 'demand radar')}</Link>.</dd>
            </div>
            <div>
              <dt>{t('profilePane.factSplit', 'Split')}</dt>
              <dd>{t('profilePane.factSplitBody', '70% artist · 20% venue · 10% promoters, fixed by the')} <Link href="/info?tab=charter">{t('profilePane.charter', 'charter')}</Link>.</dd>
            </div>
            <div>
              <dt>{t('venuePane.factLineup', 'Lineup')}</dt>
              <dd>{t('venuePane.factLineupBody', 'A multi-act bill splits the artist share by a lineup agreement every act accepts, on the show’s own page.')}</dd>
            </div>
            <div>
              <dt>{t('profilePane.factTickets', 'Tickets')}</dt>
              <dd>{t('profilePane.factTicketsBody', 'All sales are final; a cancelled show refunds every ticket.')} <Link href="/ticket-policy">{t('profilePane.ticketPolicy', 'Ticket policy')}</Link>.</dd>
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
        <ProfilePanel empty="" isEmpty={false} tabId="contact" title={t('venuePane.askTitle', 'Ask them to book someone')}>
          {isOwner ? (
            <p className="profile-standfirst">
              {t('venuePane.askOwnerBody', 'Fans use this form to ask you to book an act. Their requests rank on your')}{' '}
              <Link href="/app/me/booking">{t('profilePane.demandRadar', 'demand radar')}</Link>{t('venuePane.askOwnerBodyTail', ', weighed by how recently, how many, and how close they are.')}
            </p>
          ) : (
            <>
              <p className="profile-standfirst">
                {t('venuePane.askBody', 'Want to see someone play here? Name the act and {name} sees the request, ranked with everyone else who asked.').replace('{name}', profile.name)}
              </p>
              <VenueRequestForm venueProfileId={profile.id} />
            </>
          )}
          {/* Updates by email, for someone with no account. Same reasoning as
              the artist pane: the double opt-in is the route's, and a confirmed
              row is now a real recipient of this venue's fan mail rather than a
              subscription nothing ever sent to. Shown to the owner too — that
              is how they see what a visitor is offered. */}
          <div className="profile-newsletter">
            <h3 className="profile-panel-subhead">{t('profilePane.newsletterHead', 'Get updates by email')}</h3>
            <NewsletterSignup fixedProfile={{ id: profile.id, name: profile.name, type: profile.type }} />
          </div>
        </ProfilePanel>
      )}

    </div>
  );
}
