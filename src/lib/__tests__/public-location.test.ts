import { describe, expect, it } from 'vitest';
import { coarsenFanCoordinates, isPublicVenueCoordinate, sanitizePublicLocation, sanitizeStoredProfileLocation } from '../public-location';

describe('public location privacy', () => {
  it('allows a discoverable venue to publish its uploaded physical location', () => {
    const venue = sanitizePublicLocation({
      type: 'VENUE' as const,
      discoverable: true,
      addressLine1: '123 Local Music Ave',
      city: 'Detroit',
      stateRegion: 'Michigan',
      country: 'US',
      hometown: null,
      latitude: 42.331,
      longitude: -83.046,
    });

    expect(venue.locationPrecision).toBe('exact-venue');
    expect(venue.latitude).toBe(42.331);
    expect(isPublicVenueCoordinate(venue)).toBe(true);
  });

  it.each(['ARTIST'] as const)('never publishes exact %s coordinates', (type) => {
    const profile = sanitizePublicLocation({
      type,
      discoverable: true,
      addressLine1: 'private',
      city: 'Detroit',
      stateRegion: 'Wayne County',
      country: 'US',
      hometown: 'Detroit',
      latitude: 42.331,
      longitude: -83.046,
    });

    expect(profile.locationPrecision).toBe('broad');
    expect(profile.addressLine1).toBeNull();
    expect(profile.latitude).toBeNull();
    expect(profile.longitude).toBeNull();
  });

  it('removes every public location field from fan profiles', () => {
    const fan = sanitizePublicLocation({
      type: 'LISTENER' as const,
      addressLine1: 'private',
      city: 'Detroit',
      stateRegion: 'Michigan',
      country: 'US',
      hometown: 'Detroit',
      latitude: 42.331,
      longitude: -83.046,
    });

    expect(fan.locationPrecision).toBe('none');
    expect(fan).toMatchObject({
      addressLine1: null,
      city: null,
      stateRegion: null,
      country: null,
      hometown: null,
      latitude: null,
      longitude: null,
    });
  });

  it('reduces a device GPS fix to a county-scale search cell', () => {
    expect(coarsenFanCoordinates(42.331427, -83.045754)).toEqual({
      latitude: 42.25,
      longitude: -83,
      precision: 'county',
    });
  });

  it('rejects invalid device coordinates', () => {
    expect(coarsenFanCoordinates(Number.NaN, -83)).toBeNull();
    expect(coarsenFanCoordinates(91, -83)).toBeNull();
  });

  it('stores exact addresses only for venues while retaining broad creator scene labels', () => {
    expect(sanitizeStoredProfileLocation({ type: 'ARTIST', addressLine1: 'private', postalCode: '48201', city: 'Detroit', stateRegion: 'Wayne County', latitude: 42.3, longitude: -83 }))
      .toEqual({ type: 'ARTIST', addressLine1: null, postalCode: null, city: 'Detroit', stateRegion: 'Wayne County', latitude: null, longitude: null });
    expect(sanitizeStoredProfileLocation({ type: 'VENUE', addressLine1: '123 Music Ave', postalCode: '48201', city: 'Detroit' }).addressLine1)
      .toBe('123 Music Ave');
  });

  it('never persists fan location fields', () => {
    expect(sanitizeStoredProfileLocation({ type: 'LISTENER', city: 'Detroit', stateRegion: 'Michigan', latitude: 42.3, longitude: -83 }))
      .toMatchObject({ city: null, stateRegion: null, latitude: null, longitude: null });
  });
});
