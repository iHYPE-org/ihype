import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { getVenueBookingRecommendations } from '@/lib/venueBooking';
import { SendBookingRequestButton } from '@/components/SendBookingRequestButton';
import { VenueRequestInbox } from '@/components/VenueRequestInbox';
import { getServerT } from '@/lib/i18n/server';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Book Artists · iHYPE',
  description: 'Artists to book at your venue: what fans asked for first, then genre, locality and momentum.',
  robots: { index: false, follow: false },
};

export default async function BookingPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/app/me/booking');
  }

  const feed = await getVenueBookingRecommendations(session.user.id);
  const t = await getServerT();

  return (
    <div className="booking-page">
      <style>{BOOKING_CSS}</style>

      <header className="booking-head">
        <span className="booking-eyebrow">{t('meBookingPage.eyebrow', 'BOOK THESE ARTISTS')}{feed.venueCity ? ` · ${feed.venueCity.toUpperCase()}` : ''}</span>
        <h1 className="booking-title">{t('meBookingPage.title', 'Your demand radar')}</h1>
        <p className="booking-sub">
          {t('meBookingPage.subPrefix', 'Artists to book at')} {feed.venueName ?? t('meBookingPage.yourVenue', 'your venue')} {t('meBookingPage.subSuffix', '— what fans asked you for first, weighed by how recently, how many, and how close they are; then genre, locality and hype momentum. Acts you’ve already booked are filtered out.')}
        </p>
        {feed.hasVenue && (
          <p className="booking-sub" style={{ marginTop: -14 }}>
            {/* The analysis is only as good as its input, so say how much there was. */}
            {feed.requestCount === 0
              ? t('meBookingPage.noRequestsYet', 'No fan requests yet — when fans ask you to book someone, they rank first here.')
              : `${feed.requestCount} ${feed.requestCount === 1 ? t('meBookingPage.requestAnalysed', 'fan request analysed') : t('meBookingPage.requestsAnalysed', 'fan requests analysed')}`}
          </p>
        )}
      </header>

      {!feed.hasVenue ? (
        <div className="booking-empty">
          <p>{t('meBookingPage.venueOnlyMessage', 'This recommender is for venue accounts. Set up a venue page to see artists to book.')}</p>
          <Link href="/app/me/profiles" className="booking-cta">{t('meBookingPage.setUpVenueCta', 'Set up your venue')}</Link>
        </div>
      ) : feed.candidates.length === 0 ? (
        <div className="booking-empty">
          <p>{t('meBookingPage.noMatchesMessage', 'No new artist matches right now — check back as more artists join your scene.')}</p>
          <Link href="/app/music/discover" className="booking-cta">{t('meBookingPage.browseArtistsCta', 'Browse artists')}</Link>
        </div>
      ) : (
        <ul className="booking-list">
          {feed.candidates.map((c) => (
            <li key={c.profileId ?? `name:${c.name.toLowerCase()}`} className={`booking-card${c.local ? ' booking-card-local' : ''}${c.demand ? ' booking-card-demand' : ''}`}>
              <span className="booking-avatar" style={c.avatarUrl ? { backgroundImage: `url(${c.avatarUrl})` } : undefined}>
                {!c.avatarUrl && c.name.slice(0, 1).toUpperCase()}
              </span>
              <div className="booking-card-body">
                {/* An act fans named that has no iHYPE profile: nothing to link
                    to and nobody to message through the app, but the demand is
                    real and this is the one screen built to show it. */}
                {c.slug ? (
                  <Link href={`/app/artists/${c.slug}`} className="booking-card-name">{c.name}</Link>
                ) : (
                  <span className="booking-card-name">{c.name}</span>
                )}
                <div className="booking-card-meta">
                  {c.slug
                    ? `${c.genres.length > 0 ? c.genres.join(' · ') : t('meBookingPage.noGenresListed', 'No genres listed')}${c.city ? ` · ${c.city}` : ''}`
                    : t('meBookingPage.notOnIhype', 'Not on iHYPE yet — named by fans')}
                </div>
                <div className="booking-card-tags">
                  <span className="booking-reason">{c.reason}</span>
                  {c.hypeCount > 0 && <span className="booking-hype">{c.hypeCount} {t('meBookingPage.hypeUnit', 'HYPE')}</span>}
                </div>
                {c.profileId && (
                  <SendBookingRequestButton
                    toProfileId={c.profileId}
                    defaultMessage={`${t('meBookingPage.messageGreeting', 'Hi')} ${c.name}, ${t('meBookingPage.messageBody', "we'd love to have you play a show at")} ${feed.venueName ?? t('meBookingPage.ourVenue', 'our venue')}${feed.venueCity ? ` ${t('meBookingPage.inCity', 'in')} ${feed.venueCity}` : ''}. ${c.reason} — ${t('meBookingPage.messageClosing', "let us know if you're interested!")}`}
                  />
                )}
              </div>
              {c.slug && <Link href={`/app/artists/${c.slug}`} className="booking-card-cta">{t('meBookingPage.viewCta', 'View')}</Link>}
            </li>
          ))}
        </ul>
      )}

      {feed.hasVenue && (
        /* The raw requests behind the ranking, with Approve/Deny. This inbox
           existed and was mounted nowhere, so a venue could receive requests
           and never see one; the radar above is the analysis, this is the
           evidence. Approving or denying removes the request from PENDING and
           so from the ranking on the next load. */
        <section className="booking-requests">
          <span className="booking-eyebrow">{t('meBookingPage.requestsEyebrow', 'REQUESTS FROM FANS')}</span>
          <h2 className="booking-requests-title">{t('meBookingPage.requestsTitle', 'Who fans asked you to book')}</h2>
          <VenueRequestInbox />
        </section>
      )}
    </div>
  );
}

const BOOKING_CSS = `
.booking-page { max-width: 720px; margin: 0 auto; padding: 32px 16px 64px; }
.booking-eyebrow { font-family: 'JetBrains Mono', monospace; font-size: 0.6875rem; letter-spacing: 0.16em; color: var(--role-venue); }
.booking-title { font-family: 'Bricolage Grotesque', sans-serif; font-weight: 800; font-size: 2.125rem; line-height: 1.0; letter-spacing: -0.03em; color: var(--ink); margin: 10px 0 10px; }
.booking-sub { font-family: 'Work Sans', sans-serif; font-size: 0.9375rem; line-height: 1.6; color: var(--ink-a65); max-width: 56ch; margin: 0 0 24px; }
.booking-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.booking-card { display: flex; align-items: center; gap: 14px; padding: 14px 16px; background: var(--bg-2); border: 1px solid var(--line); border-radius: 16px; }
.booking-card-local { border-color: rgba(var(--role-venue-rgb),0.4); }
.booking-card-demand { border-color: rgba(var(--role-fan-rgb),0.5); }
.booking-requests { margin-top: 40px; }
.booking-requests-title { margin: 8px 0 16px; }
.booking-avatar { flex-shrink: 0; width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, var(--role-venue), var(--role-fan)); background-size: cover; background-position: center; display: flex; align-items: center; justify-content: center; font-family: 'Bricolage Grotesque', sans-serif; font-weight: 800; font-size: 1.125rem; color: var(--bg); }
.booking-card-body { flex: 1; min-width: 0; }
.booking-card-name { font-family: 'Work Sans', sans-serif; font-weight: 600; font-size: 1rem; color: var(--ink); text-decoration: none; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.booking-card-name:hover { color: var(--role-venue); }
.booking-card-meta { font-family: 'Work Sans', sans-serif; font-size: 0.9375rem; color: var(--ink-a65); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.booking-card-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.booking-reason { font-family: 'JetBrains Mono', monospace; font-size: 0.9375rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--role-venue); background: rgba(var(--role-venue-rgb),0.12); border-radius: 4px; padding: 3px 7px; }
.booking-hype { font-family: 'JetBrains Mono', monospace; font-size: 0.9375rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-a65); background: var(--hair-40); border-radius: 4px; padding: 3px 7px; }
.booking-card-cta { flex-shrink: 0; font-family: 'Work Sans', sans-serif; font-weight: 600; font-size: 0.9375rem; color: var(--ink-on-accent); background: var(--accent-grad-warm); border-radius: 9999px; padding: 9px 16px; text-decoration: none; }
.booking-empty { text-align: center; padding: 32px; background: var(--bg-2); border: 1px solid var(--line); border-radius: 16px; }
.booking-empty p { font-family: 'Work Sans', sans-serif; color: var(--ink-a65); margin: 0 0 14px; }
.booking-cta { display: inline-block; font-family: 'Work Sans', sans-serif; font-weight: 600; font-size: 0.9375rem; padding: 12px 22px; border-radius: 9999px; background: var(--accent-grad-warm); color: var(--ink-on-accent); text-decoration: none; }
`;
