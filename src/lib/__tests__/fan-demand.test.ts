import { describe, expect, it } from 'vitest';
import {
  HALF_LIFE_DAYS, describeDemand, haversineKm, proximityWeight, recencyWeight, scoreFanDemand,
  type DemandRequest, type DemandVenue,
} from '@/lib/fan-demand';

const NOW = new Date('2026-09-01T12:00:00.000Z');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000);

// Portland, ME and its neighbours.
const PORTLAND: DemandVenue = { city: 'Portland', stateRegion: 'ME', latitude: 43.6591, longitude: -70.2568 };
const req = (over: Partial<DemandRequest> = {}): DemandRequest => ({
  artistProfileId: 'artist_a',
  artistName: 'The Act',
  requesterId: 'fan_1',
  createdAt: NOW,
  requesterCity: null,
  requesterStateRegion: null,
  requesterLatitude: null,
  requesterLongitude: null,
  ...over,
});

describe('recencyWeight (time)', () => {
  it('is 1 now and halves every half-life, never reaching 0', () => {
    expect(recencyWeight(NOW, NOW)).toBe(1);
    expect(recencyWeight(daysAgo(HALF_LIFE_DAYS), NOW)).toBeCloseTo(0.5, 6);
    expect(recencyWeight(daysAgo(HALF_LIFE_DAYS * 2), NOW)).toBeCloseTo(0.25, 6);
    expect(recencyWeight(daysAgo(365), NOW)).toBeGreaterThan(0);
  });
  it('does not reward a clock-skewed future timestamp', () => {
    expect(recencyWeight(daysAgo(-3), NOW)).toBe(1);
  });
});

describe('proximityWeight (location of fan)', () => {
  it('prefers coordinates: South Portland is nearby, Boston is regional, Austin is far', () => {
    expect(proximityWeight(req({ requesterLatitude: 43.6415, requesterLongitude: -70.2409 }), PORTLAND)).toEqual({ weight: 1, nearby: true });
    expect(proximityWeight(req({ requesterLatitude: 42.3601, requesterLongitude: -71.0589 }), PORTLAND)).toEqual({ weight: 0.6, nearby: false });
    expect(proximityWeight(req({ requesterLatitude: 30.2672, requesterLongitude: -97.7431 }), PORTLAND)).toEqual({ weight: 0.25, nearby: false });
  });
  it('falls back to city, then state, when either side has no coordinates', () => {
    expect(proximityWeight(req({ requesterCity: 'portland' }), PORTLAND)).toEqual({ weight: 1, nearby: true });
    expect(proximityWeight(req({ requesterCity: 'Bangor', requesterStateRegion: 'me' }), PORTLAND)).toEqual({ weight: 0.6, nearby: false });
    expect(proximityWeight(req({ requesterCity: 'Austin', requesterStateRegion: 'TX' }), PORTLAND)).toEqual({ weight: 0.25, nearby: false });
  });
  it('treats an unknown location as absence of evidence, not as distance', () => {
    const unknown = proximityWeight(req(), PORTLAND);
    expect(unknown.nearby).toBe(false);
    expect(unknown.weight).toBeGreaterThan(0.25);
    expect(unknown.weight).toBeLessThan(0.6);
  });
  it('haversine: Portland to Boston is about 160 km', () => {
    expect(haversineKm(43.6591, -70.2568, 42.3601, -71.0589)).toBeGreaterThan(150);
    expect(haversineKm(43.6591, -70.2568, 42.3601, -71.0589)).toBeLessThan(170);
  });
});

describe('scoreFanDemand (frequency)', () => {
  it('counts distinct fans, so one fan asking five times is one fan', () => {
    const [entry] = scoreFanDemand(
      [1, 2, 3, 4, 5].map((n) => req({ createdAt: daysAgo(n), requesterCity: 'Portland' })),
      PORTLAND, NOW,
    );
    expect(entry.fans).toBe(1);
    expect(entry.requests).toBe(5);
    // Only the strongest request counts: recency at 1 day, nearby → just under 1.
    expect(entry.weight).toBeLessThanOrEqual(1);
    expect(entry.weight).toBeGreaterThan(0.9);
  });

  it('ranks three fresh local fans above one stale distant one, whatever the hype', () => {
    const entries = scoreFanDemand([
      req({ artistProfileId: 'local_act', requesterId: 'f1', requesterCity: 'Portland', createdAt: daysAgo(2) }),
      req({ artistProfileId: 'local_act', requesterId: 'f2', requesterCity: 'Portland', createdAt: daysAgo(3) }),
      req({ artistProfileId: 'local_act', requesterId: 'f3', requesterCity: 'Portland', createdAt: daysAgo(4) }),
      req({ artistProfileId: 'far_act', requesterId: 'f9', requesterCity: 'Austin', requesterStateRegion: 'TX', createdAt: daysAgo(120) }),
    ], PORTLAND, NOW);
    expect(entries.map((e) => e.artistProfileId)).toEqual(['local_act', 'far_act']);
    expect(entries[0].nearby).toBe(3);
    expect(entries[1].nearby).toBe(0);
  });

  it('groups a name-only act case-insensitively and keeps it, because it is still demand', () => {
    const entries = scoreFanDemand([
      req({ artistProfileId: null, artistName: 'Ghost Band', requesterId: 'f1' }),
      req({ artistProfileId: null, artistName: 'ghost band ', requesterId: 'f2' }),
    ], PORTLAND, NOW);
    expect(entries).toHaveLength(1);
    expect(entries[0].key).toBe('name:ghost band');
    expect(entries[0].fans).toBe(2);
  });

  it('a fan who asked from two places counts as nearby if either was', () => {
    const [entry] = scoreFanDemand([
      req({ requesterId: 'f1', requesterCity: 'Austin', requesterStateRegion: 'TX', createdAt: daysAgo(1) }),
      req({ requesterId: 'f1', requesterCity: 'Portland', createdAt: daysAgo(40) }),
    ], PORTLAND, NOW);
    expect(entry.fans).toBe(1);
    expect(entry.nearby).toBe(1);
  });

  it('returns nothing for nothing', () => {
    expect(scoreFanDemand([], PORTLAND, NOW)).toEqual([]);
  });
});

describe('describeDemand', () => {
  it('reads frequency, proximity, then time', () => {
    expect(describeDemand({ fans: 3, nearby: 2, latestAt: daysAgo(2) }, NOW)).toBe('3 fans asked · 2 nearby · this week');
    expect(describeDemand({ fans: 1, nearby: 0, latestAt: daysAgo(20) }, NOW)).toBe('1 fan asked · this month');
    expect(describeDemand({ fans: 2, nearby: 0, latestAt: daysAgo(90) }, NOW)).toBe('2 fans asked · earlier');
  });
});
