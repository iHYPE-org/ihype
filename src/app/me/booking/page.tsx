import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { getVenueBookingRecommendations } from '@/lib/venueBooking';
import { SendBookingRequestButton } from '@/components/SendBookingRequestButton';
import { getServerT } from '@/lib/i18n/server';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Book Artists · iHYPE',
  description: 'Rising artists to book at your venue, matched by genre, locality, and momentum.',
  robots: { index: false, follow: false },
};

export default async function BookingPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/me/booking');
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
          {t('meBookingPage.subPrefix', 'Rising artists matched to')} {feed.venueName ?? t('meBookingPage.yourVenue', 'your venue')} {t('meBookingPage.subSuffix', 'by genre, locality, and hype momentum. Acts you’ve already booked are filtered out.')}
        </p>
      </header>

      {!feed.hasVenue ? (
        <div className="booking-empty">
          <p>{t('meBookingPage.venueOnlyMessage', 'This recommender is for venue accounts. Set up a venue page to see artists to book.')}</p>
          <Link href="/pages" className="booking-cta">{t('meBookingPage.setUpVenueCta', 'Set up your venue')}</Link>
        </div>
      ) : feed.candidates.length === 0 ? (
        <div className="booking-empty">
          <p>{t('meBookingPage.noMatchesMessage', 'No new artist matches right now — check back as more artists join your scene.')}</p>
          <Link href="/discover" className="booking-cta">{t('meBookingPage.browseArtistsCta', 'Browse artists')}</Link>
        </div>
      ) : (
        <ul className="booking-list">
          {feed.candidates.map((c) => (
            <li key={c.slug} className={`booking-card${c.local ? ' booking-card-local' : ''}`}>
              <span className="booking-avatar" style={c.avatarUrl ? { backgroundImage: `url(${c.avatarUrl})` } : undefined}>
                {!c.avatarUrl && c.name.slice(0, 1).toUpperCase()}
              </span>
              <div className="booking-card-body">
                <Link href={`/artists/${c.slug}`} className="booking-card-name">{c.name}</Link>
                <div className="booking-card-meta">
                  {c.genres.length > 0 ? c.genres.join(' · ') : t('meBookingPage.noGenresListed', 'No genres listed')}{c.city ? ` · ${c.city}` : ''}
                </div>
                <div className="booking-card-tags">
                  <span className="booking-reason">{c.reason}</span>
                  {c.hypeCount > 0 && <span className="booking-hype">{c.hypeCount} {t('meBookingPage.hypeUnit', 'HYPE')}</span>}
                </div>
                <SendBookingRequestButton
                  toProfileId={c.profileId}
                  defaultMessage={`${t('meBookingPage.messageGreeting', 'Hi')} ${c.name}, ${t('meBookingPage.messageBody', "we'd love to have you play a show at")} ${feed.venueName ?? t('meBookingPage.ourVenue', 'our venue')}${feed.venueCity ? ` ${t('meBookingPage.inCity', 'in')} ${feed.venueCity}` : ''}. ${c.reason} — ${t('meBookingPage.messageClosing', "let us know if you're interested!")}`}
                />
              </div>
              <Link href={`/artists/${c.slug}`} className="booking-card-cta">{t('meBookingPage.viewCta', 'View')}</Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const BOOKING_CSS = `
.booking-page { max-width: 720px; margin: 0 auto; padding: 32px 16px 64px; }
.booking-eyebrow { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.16em; color: var(--role-venue); }
.booking-title { font-family: var(--font-display); font-weight: 800; font-size: 34px; line-height: 1.0; letter-spacing: -0.03em; color: var(--ink); margin: 10px 0 10px; }
.booking-sub { font-family: var(--font-body); font-size: 15px; line-height: 1.6; color: var(--ink-a60); max-width: 56ch; margin: 0 0 24px; }
.booking-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.booking-card { display: flex; align-items: center; gap: 14px; padding: 14px 16px; background: var(--bg-2); border: 1px solid var(--line); border-radius: 16px; }
.booking-card-local { border-color: rgba(var(--role-venue-rgb),0.4); }
.booking-avatar { flex-shrink: 0; width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, var(--role-venue), var(--role-fan)); background-size: cover; background-position: center; display: flex; align-items: center; justify-content: center; font-family: var(--font-display); font-weight: 800; font-size: 18px; color: var(--bg); }
.booking-card-body { flex: 1; min-width: 0; }
.booking-card-name { font-family: var(--font-body); font-weight: 600; font-size: 16px; color: var(--ink); text-decoration: none; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.booking-card-name:hover { color: var(--role-venue); }
.booking-card-meta { font-family: var(--font-body); font-size: 13px; color: var(--ink-a50); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.booking-card-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.booking-reason { font-family: 'JetBrains Mono', monospace; font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--role-venue); background: rgba(var(--role-venue-rgb),0.12); border-radius: 4px; padding: 3px 7px; }
.booking-hype { font-family: 'JetBrains Mono', monospace; font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-a55); background: var(--hair-40); border-radius: 4px; padding: 3px 7px; }
.booking-card-cta { flex-shrink: 0; font-family: var(--font-body); font-weight: 600; font-size: 13px; color: var(--ink-on-accent); background: var(--accent-grad-warm); border-radius: 9999px; padding: 9px 16px; text-decoration: none; }
.booking-empty { text-align: center; padding: 32px; background: var(--bg-2); border: 1px solid var(--line); border-radius: 16px; }
.booking-empty p { font-family: var(--font-body); color: var(--ink-a60); margin: 0 0 14px; }
.booking-cta { display: inline-block; font-family: var(--font-body); font-weight: 600; font-size: 15px; padding: 12px 22px; border-radius: 9999px; background: var(--accent-grad-warm); color: var(--ink-on-accent); text-decoration: none; }
`;
