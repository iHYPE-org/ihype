'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import type { MapSheetTarget } from '@/components/mmm/MmmMap';

const SPLIT_LINE = '70% artist · 20% venue · 10% promoters · $0 iHYPE fee';

type SheetContent = {
  eyebrow: string;
  title: string;
  subtitle: string;
  about: string;
  verified: boolean;
  initial: string;
  venueShape: boolean;
  stats: Array<{ value: string; label: string }>;
  listTitle: string;
  list: Array<{ a: string; b: string; c: string }>;
  primary: { label: string; href: string } | null;
  secondary: { label: string; href: string } | null;
};

/**
 * The pin detail sheet. Slides up from the bottom over a scrim.
 *
 * The charter split line is unconditional and sits directly above the CTAs, as
 * drawn: the whole point of the sheet is that you see where the money goes
 * before you press the button that spends it.
 *
 * Every figure here comes from the map payload, which comes from the database.
 * A stat with nothing behind it is omitted rather than shown as a zero — the
 * same rule the shell's badge counts follow.
 */
export function MmmSheet({ onClose, target }: { onClose: () => void; target: MapSheetTarget }) {
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    restoreRef.current = document.activeElement as HTMLElement | null;
    sheetRef.current?.querySelector<HTMLElement>('a, button')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      restoreRef.current?.focus?.();
    };
  }, [onClose]);

  const content = describe(target);

  return (
    <>
      <button aria-label="Close details" className="mmm-sheet-scrim" onClick={onClose} type="button" />
      <div aria-labelledby="mmm-sheet-title" aria-modal="true" className="mmm-sheet" ref={sheetRef} role="dialog">
        <div aria-hidden="true" className="mmm-sheet-handle" />
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div aria-hidden="true" className={`mmm-sheet-avatar${content.venueShape ? ' mmm-sheet-avatar-venue' : ''}`}>
            {content.initial}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="mmm-eyebrow mmm-eyebrow-accent" style={{ marginBottom: 5, fontSize: '0.56rem', letterSpacing: '0.14em' }}>
              {content.eyebrow}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <h2 className="mmm-sheet-title" id="mmm-sheet-title">{content.title}</h2>
              {content.verified && <span aria-label="Verified" className="mmm-verified" role="img">✓</span>}
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--ink-2)', marginTop: 4, lineHeight: 1.5 }}>
              {content.subtitle}
            </div>
          </div>
        </div>

        {content.about && (
          <p style={{ fontSize: '0.83rem', color: 'var(--ink-3)', marginTop: 11, lineHeight: 1.6 }}>{content.about}</p>
        )}

        {content.stats.length > 0 && (
          <div className="mmm-sheet-stats">
            {content.stats.map((stat) => (
              <div key={stat.label}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.05rem', color: 'var(--ink)' }}>
                  {stat.value}
                </div>
                <div className="mmm-stat-label" style={{ marginTop: 2, fontSize: '0.56rem' }}>{stat.label}</div>
              </div>
            ))}
          </div>
        )}

        {content.list.length > 0 && (
          <>
            <div className="mmm-eyebrow" style={{ margin: '13px 0 7px', fontSize: '0.55rem', letterSpacing: '0.11em' }}>
              {content.listTitle}
            </div>
            <div>
              {content.list.map((row) => (
                <div
                  key={`${row.a}-${row.b}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--hair-70)' }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.84rem', color: 'var(--ink)' }}>{row.a}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--ink-3)' }}>{row.b}</div>
                  </div>
                  <div className="mmm-row-meta">{row.c}</div>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="mmm-eyebrow" style={{ margin: '11px 0 0', fontSize: '0.6rem', letterSpacing: 0, textTransform: 'none' }}>
          {SPLIT_LINE}
        </div>

        <div className="mmm-sheet-actions">
          {content.primary && (
            <Link className="mmm-sheet-cta" href={content.primary.href} style={{ display: 'block' }}>
              {content.primary.label}
            </Link>
          )}
          {content.secondary && (
            <Link className="mmm-sheet-cta-2" href={content.secondary.href}>{content.secondary.label}</Link>
          )}
          <button className="mmm-sheet-dismiss" onClick={onClose} type="button">
            <span aria-hidden="true">✕</span>
            <span className="sr-only">Close</span>
          </button>
        </div>
      </div>
    </>
  );
}

function describe(target: MapSheetTarget): SheetContent {
  if (target.kind === 'event') {
    const event = target.data;
    const fill = event.capacity > 0 ? `${Math.round((event.sold / event.capacity) * 100)}%` : '—';
    const when = new Intl.DateTimeFormat('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC',
    }).format(new Date(event.startsAt));
    return {
      eyebrow: `Event page${event.genre ? ` · ${event.genre}` : ''}`,
      title: event.title,
      subtitle: [event.venueName, when].filter(Boolean).join(' · '),
      about: 'Presented through iHYPE — face-value pricing, every split locked by charter before a single ticket sells.',
      verified: false,
      initial: event.title.charAt(0) || '?',
      venueShape: false,
      stats: [
        { value: event.price === null ? 'Free' : `$${event.price}`, label: 'Face value' },
        ...(event.capacity > 0 ? [{ value: `${event.sold}/${event.capacity}`, label: 'Sold' }, { value: fill, label: 'Full' }] : []),
      ],
      listTitle: '',
      list: [],
      primary: {
        label: event.price === null ? 'Open this show' : `Get ticket — $${event.price}.00`,
        href: `/shows/${event.slug}`,
      },
      secondary: event.venueSlug ? { label: 'Venue →', href: `/venues/${event.venueSlug}` } : null,
    };
  }

  if (target.kind === 'venue') {
    const venue = target.data;
    return {
      eyebrow: `Venue page${venue.city ? ` · ${venue.city}` : ''}`,
      title: venue.name,
      subtitle: [
        venue.capacity ? `Capacity ${venue.capacity}` : null,
        `${venue.upcomingCount} upcoming show${venue.upcomingCount === 1 ? '' : 's'}`,
      ].filter(Boolean).join(' · '),
      about: venue.addressLine1 ?? '',
      verified: venue.verified,
      initial: venue.name.charAt(0) || '?',
      venueShape: true,
      stats: [
        ...(venue.capacity ? [{ value: String(venue.capacity), label: 'Capacity' }] : []),
        { value: String(venue.upcomingCount), label: 'Upcoming' },
        { value: '20%', label: 'Gate share' },
      ],
      listTitle: venue.genres.length ? 'Books' : '',
      list: venue.genres.map((entry) => ({ a: entry, b: '', c: '' })),
      primary: { label: 'Open venue page', href: `/venues/${venue.slug}` },
      secondary: null,
    };
  }

  if (target.kind === 'artistCity') {
    const city = target.data;
    return {
      eyebrow: `Artists · ${city.city}`,
      title: city.city,
      subtitle: `${city.count} artist${city.count === 1 ? '' : 's'} on iHYPE here`,
      // Stated rather than hidden: the bubble sits on the city's venues because
      // artists never publish an exact location. See /api/map/artists.
      about: 'Artist locations are shown by city — an artist page never publishes a precise address.',
      verified: false,
      initial: city.city.charAt(0) || '?',
      venueShape: false,
      stats: [{ value: String(city.count), label: 'Artists' }, { value: '70%', label: 'Ticket share' }],
      listTitle: 'Most hyped here',
      list: city.artists.map((artist) => ({
        a: artist.name,
        b: artist.genres.join(' · '),
        c: artist.hypeCount.toLocaleString(),
      })),
      primary: city.artists[0] ? { label: `Open ${city.artists[0].name}`, href: `/artists/${city.artists[0].slug}` } : null,
      secondary: { label: 'Discover →', href: '/app/music/discover' },
    };
  }

  const cluster = target.data;
  return {
    eyebrow: `${cluster.label} · ${cluster.count} listing${cluster.count === 1 ? '' : 's'}`,
    title: cluster.label,
    subtitle: 'Zoom in to see each one.',
    about: '',
    verified: false,
    initial: cluster.label.charAt(0) || '?',
    venueShape: false,
    stats: [{ value: String(cluster.count), label: 'Listings' }],
    listTitle: '',
    list: [],
    primary: null,
    secondary: null,
  };
}
