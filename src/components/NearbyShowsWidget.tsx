'use client';

import { useState } from 'react';
import Link from 'next/link';

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
 * Opt-in supplement to the IP-city-based weekend feed above it: uses the
 * browser's actual geolocation (not just the visitor's IP-derived city) and
 * calls GET /api/shows/nearby, which does a real Haversine radius search
 * against venue lat/lng — more precise than the exact-city-string match the
 * rest of this page relies on. Fails silently on denial/error since the
 * IP-based list already covers the no-permission case.
 */
export function NearbyShowsWidget() {
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
      <div className="weekend-empty" style={{ marginBottom: 24 }}>
        <p>Turn on precise location for shows within 50km of exactly where you are right now.</p>
        <button type="button" onClick={handleClick} className="weekend-cta" style={{ border: 'none', cursor: 'pointer' }}>
          Use my location
        </button>
      </div>
    );
  }

  if (status === 'loading') {
    return <p className="weekend-foot">Finding shows near you…</p>;
  }

  if (status === 'denied' || status === 'error') {
    return null;
  }

  if (shows.length === 0) {
    return <p className="weekend-foot">No ticketed shows within 50km right now.</p>;
  }

  return (
    <section style={{ marginBottom: 24 }}>
      <span className="weekend-eyebrow">NEAR YOU · WITHIN 50KM</span>
      <ul className="weekend-list" style={{ marginTop: 10 }}>
        {shows.map((s) => (
          <li key={s.id} className="weekend-card">
            <Link href={`/shows/${s.slug}`} className="weekend-card-link">
              <div className="weekend-card-when">{fmtWhen(s.startsAt)}</div>
              <div className="weekend-card-body">
                <div className="weekend-card-title">{s.title}</div>
                <div className="weekend-card-meta">
                  {s.venueName ?? 'Venue TBA'}{s.venueCity ? ` · ${s.venueCity}` : ''}
                </div>
                <div className="weekend-card-tags">
                  <span className="weekend-tag weekend-tag-local">Near you</span>
                  {s.hypeCount > 0 && <span className="weekend-tag">{s.hypeCount} HYPE</span>}
                </div>
              </div>
              <div className="weekend-card-cta">View</div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
