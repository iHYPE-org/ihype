import { describe, expect, it } from 'vitest';
import { buildGuide, guideHiddenKey, guideProgress, type GuideSummary } from '@/lib/getting-started';

const base: GuideSummary = {
  role: 'ARTIST',
  profile: { id: 'p1', slug: 'the-band', name: 'The Band' },
  hasPhoto: false,
  hasBio: false,
  trackCount: 0,
  hasVenueDetails: false,
  payoutsReady: false,
  payoutMethodSet: false,
  showCount: 0,
  onboarded: false,
};

describe('buildGuide', () => {
  it('gives a fan four tips with no ticks, and no wizard', () => {
    const guide = buildGuide({ ...base, role: 'FAN', profile: null });
    expect(guide.role).toBe('FAN');
    expect(guide.wizardHref).toBeNull();
    expect(guide.steps.map((s) => s.id)).toEqual(['fan-listen', 'fan-map', 'fan-hype', 'fan-tickets']);
    expect(guide.steps.every((s) => s.done === null)).toBe(true);
    expect(guideProgress(guide)).toEqual({ done: 0, total: 0 });
  });

  it('links an artist straight into the editor section for each step', () => {
    const guide = buildGuide(base);
    expect(guide.steps.map((s) => [s.id, s.href])).toEqual([
      ['artist-about', '/app/me/profiles?profile=p1&editor=about'],
      ['artist-track', '/app/me/profiles?profile=p1&editor=media'],
      ['artist-payouts', '/app/me/payouts?tab=settings'],
      ['artist-show', '/app/me/events/new'],
    ]);
    expect(guide.wizardHref).toBe('/app/me/artists/the-band/onboarding');
  });

  it('ticks steps off from the facts, and needs BOTH photo and bio for the first', () => {
    const half = buildGuide({ ...base, hasPhoto: true });
    expect(half.steps[0].done).toBe(false);
    const guide = buildGuide({ ...base, hasPhoto: true, hasBio: true, trackCount: 2, payoutMethodSet: true, showCount: 1, onboarded: true });
    expect(guide.steps.every((s) => s.done)).toBe(true);
    expect(guideProgress(guide)).toEqual({ done: 4, total: 4 });
    expect(guide.wizardHref).toBeNull();
  });

  it('ticks an artist’s payout step on where it gets paid, never on Stripe', () => {
    expect(buildGuide({ ...base, payoutsReady: true }).steps[2].done).toBe(false);
    expect(buildGuide({ ...base, payoutMethodSet: true }).steps[2].done).toBe(true);
  });

  it('keeps the venue payout step on Stripe', () => {
    const venue = { ...base, role: 'VENUE' as const };
    expect(buildGuide({ ...venue, payoutMethodSet: true }).steps[2].done).toBe(false);
    expect(buildGuide({ ...venue, payoutsReady: true }).steps[2].done).toBe(true);
  });

  it('gives a venue its own five steps, the demand radar unmeasured', () => {
    const guide = buildGuide({ ...base, role: 'VENUE', hasVenueDetails: true });
    expect(guide.steps.map((s) => s.id)).toEqual(['venue-about', 'venue-details', 'venue-payouts', 'venue-event', 'venue-demand']);
    expect(guide.steps[1]).toMatchObject({ href: '/app/me/profiles?profile=p1&editor=eventinfo', done: true });
    expect(guide.steps[4].done).toBeNull();
    expect(guideProgress(guide)).toEqual({ done: 1, total: 4 });
    expect(guide.wizardHref).toBe('/app/me/venues/the-band/onboarding');
  });

  it('keys the hide flag by account so a shared device does not hide it for the next member', () => {
    expect(guideHiddenKey('u1')).not.toBe(guideHiddenKey('u2'));
  });
});
