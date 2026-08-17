import { describe, expect, it } from 'vitest';
import { mmmMeBackTarget } from '@/lib/mmm-me-back';

describe('MMM Me subpage backstop', () => {
  it('adds a Me return path to nested tools that do not own one', () => {
    for (const path of [
      '/app/me/profiles',
      '/app/me/advertising/new',
      '/app/me/booking',
      '/app/me/events/new',
      '/app/me/payouts',
      '/app/me/tickets/TICKET-1',
      '/app/me/artists/example/dashboard',
      '/app/me/artists/example/analytics',
      '/app/me/artists/example/believers',
      '/app/me/artists/example/epk',
      '/app/me/artists/example/onboarding',
      '/app/me/venues/example/dashboard',
      '/app/me/venues/example/analytics',
      '/app/me/venues/example/onboarding',
      '/app/me/shows/example/scan',
      '/app/me/shows/example/cancel',
    ]) expect(mmmMeBackTarget(path), path).toBe('/app/me');
  });

  it('does not duplicate a route-specific back control', () => {
    for (const path of [
      '/app/me',
      '/app/me/settings',
      '/app/me/accessibility',
      '/app/me/advertising',
      '/app/me/info/privacy',
      '/app/me/support/tickets',
      '/app/me/support/tickets/1',
      '/app/me/venues/example/calendar',
      '/app/me/venues/example/booking-inbox',
      '/app/me/shows/example/lineup',
    ]) expect(mmmMeBackTarget(path), path).toBeNull();
  });
});
