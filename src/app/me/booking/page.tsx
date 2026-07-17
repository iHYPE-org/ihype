import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { getVenueBookingRecommendations } from '@/lib/venueBooking';
import { SendBookingRequestButton } from '@/components/SendBookingRequestButton';
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

  return (
    <div className="booking-page">
      <style>{BOOKING_CSS}</style>

      <header className="booking-head">
        <span className="booking-eyebrow">BOOK THESE ARTISTS{feed.venueCity ? ` · ${feed.venueCity.toUpperCase()}` : ''}</span>
        <h1 className="booking-title">Your demand radar</h1>
        <p className="booking-sub">
          Rising artists matched to {feed.venueName ?? 'your venue'} by genre, locality, and hype momentum.
          Acts you&apos;ve already booked are filtered out.
        </p>
      </header>

      {!feed.hasVenue ? (
        <div className="booking-empty">
          <p>This recommender is for venue accounts. Set up a venue page to see artists to book.</p>
          <Link href="/pages" className="booking-cta">Set up your venue</Link>
        </div>
      ) : feed.candidates.length === 0 ? (
        <div className="booking-empty">
          <p>No new artist matches right now — check back as more artists join your scene.</p>
          <Link href="/discover" className="booking-cta">Browse artists</Link>
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
                  {c.genres.length > 0 ? c.genres.join(' · ') : 'No genres listed'}{c.city ? ` · ${c.city}` : ''}
                </div>
                <div className="booking-card-tags">
                  <span className="booking-reason">{c.reason}</span>
                  {c.hypeCount > 0 && <span className="booking-hype">{c.hypeCount} HYPE</span>}
                </div>
                <SendBookingRequestButton
                  toProfileId={c.profileId}
                  defaultMessage={`Hi ${c.name}, we'd love to have you play a show at ${feed.venueName ?? 'our venue'}${feed.venueCity ? ` in ${feed.venueCity}` : ''}. ${c.reason} — let us know if you're interested!`}
                />
              </div>
              <Link href={`/artists/${c.slug}`} className="booking-card-cta">View</Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const BOOKING_CSS = `
.booking-page { max-width: 720px; margin: 0 auto; padding: 32px 16px 64px; }
.booking-eyebrow { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.16em; color: #22e5d4; }
.booking-title { font-family: 'Syne', sans-serif; font-weight: 800; font-size: 34px; line-height: 1.0; letter-spacing: -0.03em; color: var(--ink); margin: 10px 0 10px; }
.booking-sub { font-family: 'DM Sans', sans-serif; font-size: 15px; line-height: 1.6; color: var(--ink-a60); max-width: 56ch; margin: 0 0 24px; }
.booking-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.booking-card { display: flex; align-items: center; gap: 14px; padding: 14px 16px; background: #100d09; border: 1px solid var(--line); border-radius: 16px; }
.booking-card-local { border-color: rgba(34,229,212,0.4); }
.booking-avatar { flex-shrink: 0; width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, #22e5d4, #b983ff); background-size: cover; background-position: center; display: flex; align-items: center; justify-content: center; font-family: 'Syne', sans-serif; font-weight: 800; font-size: 18px; color: #0a0805; }
.booking-card-body { flex: 1; min-width: 0; }
.booking-card-name { font-family: 'DM Sans', sans-serif; font-weight: 600; font-size: 16px; color: var(--ink); text-decoration: none; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.booking-card-name:hover { color: #22e5d4; }
.booking-card-meta { font-family: 'DM Sans', sans-serif; font-size: 13px; color: var(--ink-a50); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.booking-card-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.booking-reason { font-family: 'JetBrains Mono', monospace; font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase; color: #22e5d4; background: rgba(34,229,212,0.12); border-radius: 4px; padding: 3px 7px; }
.booking-hype { font-family: 'JetBrains Mono', monospace; font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-a55); background: var(--hair-40); border-radius: 4px; padding: 3px 7px; }
.booking-card-cta { flex-shrink: 0; font-family: 'DM Sans', sans-serif; font-weight: 600; font-size: 13px; color: #fff; background: linear-gradient(135deg, #ff5029, #ff3e6e); border-radius: 9999px; padding: 9px 16px; text-decoration: none; }
.booking-empty { text-align: center; padding: 32px; background: #100d09; border: 1px solid var(--line); border-radius: 16px; }
.booking-empty p { font-family: 'DM Sans', sans-serif; color: var(--ink-a60); margin: 0 0 14px; }
.booking-cta { display: inline-block; font-family: 'DM Sans', sans-serif; font-weight: 600; font-size: 15px; padding: 12px 22px; border-radius: 9999px; background: linear-gradient(135deg, #ff5029, #ff3e6e); color: #fff; text-decoration: none; }
`;
