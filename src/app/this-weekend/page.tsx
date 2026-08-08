import Link from 'next/link';
import { auth } from '@/lib/auth';
import { detectRequestLocation } from '@/lib/request-location';
import { getWeekendShows } from '@/lib/weekendShows';
import { NearbyShowsWidget } from '@/components/NearbyShowsWidget';
import type { Metadata } from 'next';
import { getServerT } from '@/lib/i18n/server';

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
  const t = await getServerT();
  const [session, location] = await Promise.all([auth(), detectRequestLocation()]);
  const feed = await getWeekendShows(session?.user?.id ?? null, location);

  return (
    <div className="weekend-page">
      <style>{WEEKEND_CSS}</style>

      <header className="weekend-head">
        <span className="weekend-eyebrow">{t('thisWeekendPage.eyebrow', 'THIS WEEKEND')} · {feed.rangeLabel.toUpperCase()}</span>
        <h1 className="weekend-title">
          {feed.cityLabel ? <>{t('thisWeekendPage.whatsOnIn', "What's on in")}<br />{feed.cityLabel}</> : <>{t('thisWeekendPage.whatsOn', "What's on")}<br />{t('thisWeekendPage.thisWeekend', 'this weekend')}</>}
        </h1>
      </header>

      <NearbyShowsWidget />

      {feed.shows.length === 0 ? (
        <div className="weekend-empty">
          <p>{t('thisWeekendPage.emptyState', 'No shows on the calendar for this weekend yet.')}</p>
          <Link href="/discover" className="weekend-cta">{t('thisWeekendPage.discoverArtists', 'Discover artists')}</Link>
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
                    {s.youHyped && <span className="weekend-tag weekend-tag-hyped">{t('thisWeekendPage.youHyped', 'You hyped')} {s.headlinerName ?? t('thisWeekendPage.them', 'them')}</span>}
                    {s.local && !s.youHyped && <span className="weekend-tag weekend-tag-local">{t('thisWeekendPage.nearYou', 'Near you')}</span>}
                    {s.goingCount > 0 && <span className="weekend-tag">{s.goingCount} {t('thisWeekendPage.going', 'going')}</span>}
                    {s.hypeCount > 0 && <span className="weekend-tag">{s.hypeCount} {t('thisWeekendPage.hype', 'HYPE')}</span>}
                  </div>
                </div>
                <div className="weekend-card-cta">{s.isTicketed ? t('thisWeekendPage.getTicket', 'Get ticket') : t('thisWeekendPage.rsvp', 'RSVP')}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {!session?.user?.id && feed.shows.length > 0 && (
        <p className="weekend-foot">
          <Link href="/register">{t('thisWeekendPage.signUp', 'Sign up')}</Link> {t('thisWeekendPage.signUpSuffix', 'to hype artists and get shows tailored to your taste.')}
        </p>
      )}
    </div>
  );
}

const WEEKEND_CSS = `
.weekend-page { max-width: 720px; margin: 0 auto; padding: 32px 16px 64px; }
.weekend-eyebrow { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.16em; color: var(--role-venue); }
.weekend-title { font-family: var(--font-display); font-weight: 800; font-size: 36px; line-height: 1.0; letter-spacing: -0.03em; color: var(--ink); margin: 10px 0 24px; }
.weekend-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.weekend-card { background: var(--bg-2); border: 1px solid var(--line); border-radius: 16px; overflow: hidden; }
.weekend-card-hyped { border-color: rgba(var(--accent-rgb),0.45); box-shadow: 0 0 40px rgba(var(--accent-rgb),0.08); }
.weekend-card-link { display: flex; align-items: center; gap: 14px; padding: 14px 16px; text-decoration: none; }
.weekend-card-when { flex-shrink: 0; width: 64px; font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.04em; color: var(--role-venue); text-transform: uppercase; line-height: 1.4; }
.weekend-card-body { flex: 1; min-width: 0; }
.weekend-card-title { font-family: var(--font-body); font-weight: 600; font-size: 16px; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.weekend-card-meta { font-family: var(--font-body); font-size: 13px; color: var(--ink-a50); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.weekend-card-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.weekend-tag { font-family: 'JetBrains Mono', monospace; font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-a55); background: var(--hair-40); border-radius: 4px; padding: 3px 7px; }
.weekend-tag-hyped { color: var(--accent); background: rgba(var(--accent-rgb),0.12); }
.weekend-tag-local { color: var(--role-venue); background: rgba(var(--role-venue-rgb),0.12); }
.weekend-card-cta { flex-shrink: 0; font-family: var(--font-body); font-weight: 600; font-size: 13px; color: var(--ink-on-accent); background: var(--accent-grad-warm); border-radius: 9999px; padding: 9px 16px; }
.weekend-empty { text-align: center; padding: 32px; background: var(--bg-2); border: 1px solid var(--line); border-radius: 16px; }
.weekend-empty p { font-family: var(--font-body); color: var(--ink-a60); margin: 0 0 14px; }
.weekend-cta { display: inline-block; font-family: var(--font-body); font-weight: 600; font-size: 15px; padding: 12px 22px; border-radius: 9999px; background: var(--accent-grad-warm); color: var(--ink-on-accent); text-decoration: none; }
.weekend-foot { font-family: var(--font-body); font-size: 14px; color: var(--ink-a50); text-align: center; margin-top: 24px; }
.weekend-foot a { color: var(--accent); }
`;
