'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { RequestLocation } from '@/lib/request-location';

export type ListenerVenueMapVenue = {
  id: string;
  slug: string;
  name: string;
  addressLine1: string | null;
  hoursText: string | null;
  city: string | null;
  stateRegion: string | null;
  country: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
};

type ListenerVenueMapProps = {
  venues: ListenerVenueMapVenue[];
  viewerLocation: RequestLocation | null;
};

function projectLongitude(longitude: number) {
  return ((longitude + 180) / 360) * 100;
}

function projectLatitude(latitude: number) {
  return ((90 - latitude) / 180) * 100;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function calculateDistance(
  left: Pick<ListenerVenueMapVenue, 'latitude' | 'longitude'>,
  right: Pick<RequestLocation, 'latitude' | 'longitude'>
) {
  if (
    left.latitude == null ||
    left.longitude == null ||
    right.latitude == null ||
    right.longitude == null
  ) {
    return Number.POSITIVE_INFINITY;
  }

  const earthRadiusKm = 6371;
  const latitudeDelta = toRadians(right.latitude - left.latitude);
  const longitudeDelta = toRadians(right.longitude - left.longitude);
  const latitudeA = toRadians(left.latitude);
  const latitudeB = toRadians(right.latitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatVenueAddress(venue: ListenerVenueMapVenue) {
  const addressParts = [venue.addressLine1, venue.city, venue.stateRegion, venue.postalCode]
    .map((value) => value?.trim())
    .filter(Boolean);

  if (addressParts.length) {
    return addressParts.join(', ');
  }

  return [venue.city, venue.country].filter(Boolean).join(', ') || 'Address not posted yet.';
}

function formatViewerLocation(location: RequestLocation | null) {
  if (!location) {
    return 'Location unavailable';
  }

  const parts = [location.postalCode, location.city, location.stateRegion].filter(Boolean);
  return parts.length ? parts.join(' - ') : [location.city, location.country].filter(Boolean).join(', ') || 'Location unavailable';
}

export function ListenerVenueMap({ venues, viewerLocation }: ListenerVenueMapProps) {
  const mappedVenues = useMemo(
    () =>
      venues.filter(
        (venue) => venue.latitude != null && venue.longitude != null && venue.city && venue.country
      ),
    [venues]
  );

  const orderedVenues = useMemo(() => {
    if (!viewerLocation) {
      return mappedVenues;
    }

    return [...mappedVenues].sort((left, right) => {
      const leftDistance = calculateDistance(left, viewerLocation);
      const rightDistance = calculateDistance(right, viewerLocation);
      return leftDistance - rightDistance;
    });
  }, [mappedVenues, viewerLocation]);

  const [activeVenueId, setActiveVenueId] = useState<string | null>(orderedVenues[0]?.id ?? null);

  useEffect(() => {
    if (!orderedVenues.length) {
      setActiveVenueId(null);
      return;
    }

    if (!activeVenueId || !orderedVenues.some((venue) => venue.id === activeVenueId)) {
      setActiveVenueId(orderedVenues[0]?.id ?? null);
    }
  }, [activeVenueId, orderedVenues]);

  const activeVenue = orderedVenues.find((venue) => venue.id === activeVenueId) ?? orderedVenues[0] ?? null;
  const localVenueCount =
    viewerLocation?.postalCode
      ? orderedVenues.filter((venue) => venue.postalCode === viewerLocation.postalCode).length
      : 0;
  const tooltipTop = activeVenue?.latitude != null ? projectLatitude(activeVenue.latitude) : null;
  const tooltipLeft = activeVenue?.longitude != null ? projectLongitude(activeVenue.longitude) : null;

  return (
    <section className="panel listener-location-panel">
      <div className="listener-location-header">
        <div>
          <div className="badge">Venue Map</div>
          <h2>Nearby venues by detected ZIP</h2>
          <p className="kicker">Your page uses request IP data to find your ZIP code, then maps live venue profiles around it.</p>
        </div>
        <div className="listener-location-chip">
          <span>Detected</span>
          <strong>{formatViewerLocation(viewerLocation)}</strong>
        </div>
      </div>

      <div className="listener-location-layout">
        <div className="listener-map-stage" role="img" aria-label="Venue map with your detected location and venue markers">
          <div className="activity-map-grid" />

          {viewerLocation?.latitude != null && viewerLocation?.longitude != null ? (
            <div
              className="listener-user-marker"
              style={{
                left: `${projectLongitude(viewerLocation.longitude)}%`,
                top: `${projectLatitude(viewerLocation.latitude)}%`
              }}
            >
              <span>{viewerLocation.postalCode ?? 'You'}</span>
            </div>
          ) : null}

          {orderedVenues.map((venue) => (
            <Link
              aria-label={`Open ${venue.name}`}
              className={venue.id === activeVenueId ? 'listener-venue-marker active' : 'listener-venue-marker'}
              href={`/venues/${venue.slug}`}
              key={venue.id}
              onFocus={() => setActiveVenueId(venue.id)}
              onMouseEnter={() => setActiveVenueId(venue.id)}
              style={{
                left: `${projectLongitude(venue.longitude!) }%`,
                top: `${projectLatitude(venue.latitude!)}%`
              }}
              title={`${venue.name}\n${formatVenueAddress(venue)}\n${venue.hoursText || 'Hours not posted yet.'}`}
            >
              <span>{venue.postalCode ?? venue.city}</span>
            </Link>
          ))}

          {activeVenue && tooltipTop != null && tooltipLeft != null ? (
            <div
              className={tooltipTop < 18 ? 'listener-map-tooltip bottom' : 'listener-map-tooltip'}
              style={{
                left: `${tooltipLeft}%`,
                top: `${tooltipTop}%`
              }}
            >
              <strong>{activeVenue.name}</strong>
              <p>{formatVenueAddress(activeVenue)}</p>
              <p>{activeVenue.hoursText || 'Hours not posted yet.'}</p>
            </div>
          ) : null}

          <div className="map-caption">Hover a venue pin for details, then click through to the venue page.</div>
        </div>

        <aside className="panel listener-map-detail">
          <div className="listener-map-detail-stack">
            <div className="listener-map-detail-card">
              <span className="badge">You</span>
              <h3>{formatViewerLocation(viewerLocation)}</h3>
              <p className="meta">
                {viewerLocation
                  ? localVenueCount
                    ? `${localVenueCount} venue${localVenueCount === 1 ? '' : 's'} currently match your detected ZIP.`
                    : 'No venue profiles are pinned to your exact ZIP yet.'
                  : 'The app could not resolve your ZIP from this request, so the venue map is still shown globally.'}
              </p>
            </div>

            <div className="listener-map-detail-card">
              <span className="badge">Venue</span>
              {activeVenue ? (
                <>
                  <h3>{activeVenue.name}</h3>
                  <p className="meta">{formatVenueAddress(activeVenue)}</p>
                  <p className="meta">{activeVenue.hoursText || 'Hours not posted yet.'}</p>
                  <Link className="button small secondary" href={`/venues/${activeVenue.slug}`}>
                    Open venue page
                  </Link>
                </>
              ) : (
                <p className="meta">No venue markers are available yet.</p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
