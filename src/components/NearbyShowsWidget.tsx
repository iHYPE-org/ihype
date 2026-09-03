'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/components/I18nProvider';

type NearbyShow = {
  id: string;
  slug: string;
  title: string;
  startsAt: string;
  hypeCount: number;
  venueName: string | null;
  venueCity: string | null;
};

type Status = 'idle' | 'loading' | 'denied' | 'error' | 'done';

function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' });
}

/**
 * Shows within 50km of exactly where the visitor is, on the LOGGED-OUT front
 * door — which is the only place this can go and the reason it is worth having.
 * The signed-in answer to "what is on near me" is the map, and the map is
 * behind auth, so a visitor who has not signed up had no way to see a single
 * local show. It also must NOT go on the map: "Near me" was deliberately
 * retired there (the map always starts where you are), and mounting this on it
 * would put that button back.
 *
 * Its old home was `/this-weekend`, deleted in the MMM cutover — which took the
 * `.weekend-*` stylesheet with it, so the markup here was styled by rules that
 * no longer exist. It paints from its own classes now.
 *
 * Originally: opt-in supplement to the IP-city-based weekend feed above it: uses the
 * browser's actual geolocation (not just the visitor's IP-derived city) and
 * calls GET /api/shows/nearby, which does a real Haversine radius search
 * against venue lat/lng — more precise than the exact-city-string match the
 * rest of this page relies on. Fails silently on denial/error since the
 * IP-based list already covers the no-permission case.
 */
export function NearbyShowsWidget() {
  const { t } = useI18n();
  const [status, setStatus] = useState<Status>('idle');
  const [shows, setShows] = useState<NearbyShow[]>([]);

  const handleClick = () => {
    if (!('geolocation' in navigator)) {
      setStatus('error');
      return;
    }
    setStatus('loading');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(`/api/shows/nearby?lat=${latitude}&lng=${longitude}&radius=50`);
          if (!res.ok) {
            setStatus('error');
            return;
          }
          const data = await res.json();
          setShows(Array.isArray(data.shows) ? data.shows : []);
          setStatus('done');
        } catch {
          setStatus('error');
        }
      },
      () => setStatus('denied'),
      { timeout: 8000 },
    );
  };

  if (status === 'idle') {
    return (
      <div className="nearby-shows nearby-shows-prompt">
        <p>{t('nearbyShowsWidget.prompt', 'Turn on precise location for shows within 50km of exactly where you are right now.')}</p>
        <button type="button" onClick={handleClick} className="nearby-shows-cta">
          {t('nearbyShowsWidget.useMyLocation', 'Use my location')}
        </button>
      </div>
    );
  }

  if (status === 'loading') {
    return <p className="nearby-shows-note">{t('nearbyShowsWidget.finding', 'Finding shows near you…')}</p>;
  }

  if (status === 'denied' || status === 'error') {
    return null;
  }

  if (shows.length === 0) {
    return <p className="nearby-shows-note">{t('nearbyShowsWidget.empty', 'No ticketed shows within 50km right now.')}</p>;
  }

  return (
    <section className="nearby-shows">
      <span className="nearby-shows-eyebrow">{t('nearbyShowsWidget.eyebrow', 'NEAR YOU · WITHIN 50KM')}</span>
      <ul className="nearby-shows-list">
        {shows.map((s) => (
          <li key={s.id} className="nearby-shows-item">
            <Link href={`/shows/${s.slug}`} className="nearby-shows-link">
              <div className="nearby-shows-when">{fmtWhen(s.startsAt)}</div>
              <div className="nearby-shows-body">
                <div className="nearby-shows-title">{s.title}</div>
                <div className="nearby-shows-meta">
                  {s.venueName ?? t('nearbyShowsWidget.venueTba', 'Venue TBA')}{s.venueCity ? ` · ${s.venueCity}` : ''}
                </div>
                <div className="nearby-shows-tags">
                  <span className="nearby-shows-tag">{t('nearbyShowsWidget.nearYouTag', 'Near you')}</span>
                  {s.hypeCount > 0 && <span className="nearby-shows-tag">{s.hypeCount} {t('nearbyShowsWidget.hypeTag', 'HYPE')}</span>}
                </div>
              </div>
              <div className="nearby-shows-cta-text">{t('nearbyShowsWidget.viewCta', 'View')}</div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
