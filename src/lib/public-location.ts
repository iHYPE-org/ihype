type PublicLocationInput = {
  type: 'ARTIST' | 'VENUE' | 'LISTENER';
  discoverable?: boolean;
  addressLine1?: string | null;
  city?: string | null;
  stateRegion?: string | null;
  country?: string | null;
  hometown?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

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
