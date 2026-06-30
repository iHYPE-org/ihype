import Link from 'next/link';
import { auth } from '@/lib/auth';
import { detectRequestLocation } from '@/lib/request-location';
import { getWeekendShows } from '@/lib/weekendShows';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'This Weekend · iHYPE',
  description: 'Every show happening near you this weekend — hype, RSVP, and grab tickets in one place.',
  openGraph: {
    title: 'This weekend in the scene',
    description: 'Every show happening near you this weekend on iHYPE.',
    siteName: 'iHYPE',
    type: 'website',
    images: [{ url: `/api/og?${new URLSearchParams({ title: 'This Weekend', subtitle: 'Every show near you', type: 'show' }).toString()}`, width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image', title: 'This weekend in the scene', description: 'Every show happening near you this weekend on iHYPE.' },
};

function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' });
}

export default async function ThisWeekendPage() {
  const [session, location] = await Promise.all([auth(), detectRequestLocation()]);
  const feed = await getWeekendShows(session?.user?.id ?? null, location);

  return (
    <main className="weekend-page">
      <style>{WEEKEND_CSS}</style>

      <header className="weekend-head">
        <span className="weekend-eyebrow">THIS WEEKEND · {feed.rangeLabel.toUpperCase()}</span>
        <h1 className="weekend-title">
          {feed.cityLabel ? <>What&apos;s on in<br />{feed.cityLabel}</> : <>What&apos;s on<br />this weekend</>}
        </h1>
      </header>

      {feed.shows.length === 0 ? (
        <div className="weekend-empty">
          <p>No shows on the calendar for this weekend yet.</p>
          <Link href="/discover" className="weekend-cta">Discover artists</Link>
        </div>
      ) : (
        <ul className="weekend-list">
          {feed.shows.map((s) => (
            <li key={s.slug} className={`weekend-card${s.youHyped ? ' weekend-card-hyped' : ''}`}>
              <Link href={`/shows/${s.slug}`} className="weekend-card-link">
                <div className="weekend-card-when">{fmtWhen(s.startsAt)}</div>
                <div className="weekend-card-body">
                  <div className="weekend-card-title">{s.title}</div>
                  <div className="weekend-card-meta">
                    {s.venueName ?? 'Venue TBA'}{s.venueCity ? ` · ${s.venueCity}` : ''}
                  </div>
                  <div className="weekend-card-tags">
                    {s.youHyped && <span className="weekend-tag weekend-tag-hyped">You hyped {s.headlinerName ?? 'them'}</span>}
                    {s.local && !s.youHyped && <span className="weekend-tag weekend-tag-local">Near you</span>}
                    {s.goingCount > 0 && <span className="weekend-tag">{s.goingCount} going</span>}
                    {s.hypeCount > 0 && <span className="weekend-tag">{s.hypeCount} HYPE</span>}
                  </div>
                </div>
                <div className="weekend-card-cta">{s.isTicketed ? 'Get ticket' : 'RSVP'}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {!session?.user?.id && feed.shows.length > 0 && (
        <p className="weekend-foot">
          <Link href="/register">Sign up</Link> to hype artists and get shows tailored to your taste.
        </p>
      )}
    </main>
  );
}

const WEEKEND_CSS = `
.weekend-page { max-width: 720px; margin: 0 auto; padding: 32px 16px 64px; }
.weekend-eyebrow { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.16em; color: #22e5d4; }
.weekend-title { font-family: 'Syne', sans-serif; font-weight: 800; font-size: 36px; line-height: 1.0; letter-spacing: -0.03em; color: #f0ebe5; margin: 10px 0 24px; }
.weekend-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.weekend-card { background: #100d09; border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; overflow: hidden; }
.weekend-card-hyped { border-color: rgba(255,80,41,0.45); box-shadow: 0 0 40px rgba(255,80,41,0.08); }
.weekend-card-link { display: flex; align-items: center; gap: 14px; padding: 14px 16px; text-decoration: none; }
.weekend-card-when { flex-shrink: 0; width: 64px; font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.04em; color: #22e5d4; text-transform: uppercase; line-height: 1.4; }
.weekend-card-body { flex: 1; min-width: 0; }
.weekend-card-title { font-family: 'DM Sans', sans-serif; font-weight: 600; font-size: 16px; color: #f0ebe5; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.weekend-card-meta { font-family: 'DM Sans', sans-serif; font-size: 13px; color: rgba(240,235,229,0.5); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.weekend-card-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.weekend-tag { font-family: 'JetBrains Mono', monospace; font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(240,235,229,0.55); background: rgba(255,255,255,0.04); border-radius: 4px; padding: 3px 7px; }
.weekend-tag-hyped { color: #ff5029; background: rgba(255,80,41,0.12); }
.weekend-tag-local { color: #22e5d4; background: rgba(34,229,212,0.12); }
.weekend-card-cta { flex-shrink: 0; font-family: 'DM Sans', sans-serif; font-weight: 600; font-size: 13px; color: #fff; background: linear-gradient(135deg, #ff5029, #ff3e6e); border-radius: 9999px; padding: 9px 16px; }
.weekend-empty { text-align: center; padding: 32px; background: #100d09; border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; }
.weekend-empty p { font-family: 'DM Sans', sans-serif; color: rgba(240,235,229,0.6); margin: 0 0 14px; }
.weekend-cta { display: inline-block; font-family: 'DM Sans', sans-serif; font-weight: 600; font-size: 15px; padding: 12px 22px; border-radius: 9999px; background: linear-gradient(135deg, #ff5029, #ff3e6e); color: #fff; text-decoration: none; }
.weekend-foot { font-family: 'DM Sans', sans-serif; font-size: 14px; color: rgba(240,235,229,0.5); text-align: center; margin-top: 24px; }
.weekend-foot a { color: #ff5029; }
`;
