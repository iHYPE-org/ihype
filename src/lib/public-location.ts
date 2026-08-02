type PublicLocationInput = {
  type: 'ARTIST' | 'DJ' | 'VENUE' | 'LISTENER';
  discoverable?: boolean;
  addressLine1?: string | null;
  city?: string | null;
  stateRegion?: string | null;
  country?: string | null;
  hometown?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

// Nearby discovery never needs a fan's device-level GPS fix. A quarter-degree
// grid is roughly county scale in the continental US: precise enough to find
// nearby public venues, coarse enough that the request does not disclose a
// home, street, or block. The API repeats this transform as a trust boundary
// even when a caller bypasses the browser helper.
export const FAN_LOCATION_GRID_DEGREES = 0.25;

export function coarsenFanCoordinates(latitude: number, longitude: number) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return null;
  }
  const snap = (value: number) => Number((Math.round(value / FAN_LOCATION_GRID_DEGREES) * FAN_LOCATION_GRID_DEGREES).toFixed(2));
  return {
    latitude: Math.max(-90, Math.min(90, snap(latitude))),
    longitude: Math.max(-180, Math.min(180, snap(longitude))),
    precision: 'county' as const,
  };
}

/**
 * Enforces iHYPE's public location boundary in one place:
 * - venues may publish their uploaded physical location when discoverable;
 * - artist/DJ profiles retain only their self-authored broad location labels;
 * - fan/listener profiles never publish location.
 */
export function sanitizePublicLocation<T extends PublicLocationInput>(profile: T): T & { locationPrecision: 'exact-venue' | 'broad' | 'none' } {
  if (profile.type === 'LISTENER') {
    return {
      ...profile,
      addressLine1: null,
      city: null,
      stateRegion: null,
      country: null,
      hometown: null,
      latitude: null,
      longitude: null,
      locationPrecision: 'none',
    };
  }

  if (profile.type === 'VENUE' && profile.discoverable !== false) {
    return { ...profile, locationPrecision: 'exact-venue' };
  }

  return {
    ...profile,
    addressLine1: null,
    latitude: null,
    longitude: null,
    locationPrecision: 'broad',
  };
}

export function isPublicVenueCoordinate(profile: {
  type: string;
  discoverable: boolean;
  latitude: number | null;
  longitude: number | null;
}) {
  return profile.type === 'VENUE'
    && profile.discoverable
    && profile.latitude !== null
    && profile.longitude !== null
    && Number.isFinite(profile.latitude)
    && Number.isFinite(profile.longitude);
}

export function sanitizeStoredProfileLocation<T extends {
  type: string;
  addressLine1?: string | null;
  postalCode?: string | null;
  city?: string | null;
  stateRegion?: string | null;
  country?: string | null;
  hometown?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}>(profile: T): T {
  if (profile.type === 'VENUE') return profile;
  if (profile.type === 'LISTENER') {
    return {
      ...profile,
      addressLine1: null,
      postalCode: null,
      city: null,
      stateRegion: null,
      country: null,
      hometown: null,
      latitude: null,
      longitude: null,
    };
  }
  return {
    ...profile,
    addressLine1: null,
    postalCode: null,
    latitude: null,
    longitude: null,
  };
}
