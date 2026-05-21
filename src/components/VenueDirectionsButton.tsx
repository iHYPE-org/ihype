'use client';

import { useMemo, useState } from 'react';

type VenueDirectionsButtonProps = {
  destinationAddress?: string | null;
  destinationLatitude?: number | null;
  destinationLongitude?: number | null;
  className?: string;
};

type BrowserOrigin = {
  latitude: number;
  longitude: number;
};

function hasCoordinatePair(latitude?: number | null, longitude?: number | null) {
  return Number.isFinite(latitude) && Number.isFinite(longitude);
}

function buildDirectionsUrl(destination: string, origin?: BrowserOrigin) {
  const url = new URL('https://www.google.com/maps/dir/');
  url.searchParams.set('api', '1');
  url.searchParams.set('destination', destination);
  url.searchParams.set('travelmode', 'driving');

  if (origin) {
    url.searchParams.set('origin', `${origin.latitude},${origin.longitude}`);
  }

  return url.toString();
}

export function VenueDirectionsButton({
  destinationAddress,
  destinationLatitude,
  destinationLongitude,
  className = 'button small secondary'
}: VenueDirectionsButtonProps) {
  const [status, setStatus] = useState<'idle' | 'locating' | 'fallback'>('idle');
  const destination = useMemo(() => {
    if (hasCoordinatePair(destinationLatitude, destinationLongitude)) {
      return `${destinationLatitude},${destinationLongitude}`;
    }

    const trimmedAddress = destinationAddress?.trim();
    return trimmedAddress || null;
  }, [destinationAddress, destinationLatitude, destinationLongitude]);

  if (!destination) {
    return null;
  }

  function openMaps(origin?: BrowserOrigin) {
    window.location.assign(buildDirectionsUrl(destination!, origin));
  }

  function handleClick() {
    setStatus('locating');

    if (!navigator.geolocation) {
      setStatus('fallback');
      openMaps();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        openMaps({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
      },
      () => {
        setStatus('fallback');
        openMaps();
      },
      {
        enableHighAccuracy: true,
        maximumAge: 60_000,
        timeout: 7_000
      }
    );
  }

  return (
    <button className={className} onClick={handleClick} type="button">
      {status === 'locating' ? 'Opening maps...' : status === 'fallback' ? 'Open maps' : 'Get directions'}
    </button>
  );
}
