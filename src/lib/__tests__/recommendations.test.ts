import { describe, it, expect } from 'vitest';
import { geoTier, tasteScore, finalScore, buildReason, WEIGHTS, type Signals } from '@/lib/recommendation-scoring';

describe('geoTier', () => {
  it('returns null when the viewer has no location', () => {
    expect(geoTier(null, null, null, 'ME', 'US', 'Portland')).toBeNull();
  });

  it('returns null when the profile has no location', () => {
    expect(geoTier('ME', 'US', 'Portland', null, null, null)).toBeNull();
  });

  it('scores a same-city, same-state match highest', () => {
    expect(geoTier('ME', 'US', 'Portland', 'ME', 'US', 'Portland')).toBe(1);
  });

  it('scores a same-state (different city) match below city', () => {
    expect(geoTier('ME', 'US', 'Portland', 'ME', 'US', 'Bangor')).toBe(0.8);
  });

  it('scores a same-country match below state', () => {
    expect(geoTier('ME', 'US', 'Portland', 'CA', 'US', 'Los Angeles')).toBe(0.45);
  });

  it('is case-insensitive on city/state', () => {
    expect(geoTier('me', 'us', 'portland', 'ME', 'US', 'PORTLAND')).toBe(1);
  });
});

describe('tasteScore', () => {
  it('returns null when the viewer has no genres (cold start)', () => {
    expect(tasteScore([], ['house'])).toBeNull();
  });

  it('returns 0 when the profile has no genres', () => {
    expect(tasteScore(['house'], [])).toBe(0);
  });

  it('returns 1 for a full overlap', () => {
    expect(tasteScore(['house', 'techno'], ['house', 'techno'])).toBe(1);
  });

  it('is case-insensitive', () => {
    expect(tasteScore(['House'], ['house'])).toBe(1);
  });

  it('scales with partial overlap', () => {
    expect(tasteScore(['house', 'techno'], ['house', 'ambient'])).toBeCloseTo(0.5);
  });
});

describe('finalScore', () => {
  it('excludes null signals from the weighted average but keeps social/momentum', () => {
    // taste=1, social=0, momentum=0 present; geo/collab/comparable null.
    const s: Signals = { taste: 1, geo: null, social: 0, momentum: 0, collab: null, comparable: null };
    const expected = (1 * WEIGHTS.taste) / (WEIGHTS.taste + WEIGHTS.social + WEIGHTS.momentum);
    expect(finalScore(s)).toBeCloseTo(expected);
  });

  it('returns 0 when all present signals are 0', () => {
    const s: Signals = { taste: null, geo: null, social: 0, momentum: 0, collab: null, comparable: null };
    expect(finalScore(s)).toBe(0);
  });

  it('ranks a strong taste match above a weak one', () => {
    const strong: Signals = { taste: 1, geo: null, social: 0.2, momentum: 0.1, collab: null, comparable: null };
    const weak: Signals = { taste: 0.1, geo: null, social: 0.2, momentum: 0.1, collab: null, comparable: null };
    expect(finalScore(strong)).toBeGreaterThan(finalScore(weak));
  });
});

describe('buildReason', () => {
  const genreToArtist = new Map([['house', { name: 'Nyla Park', slug: 'nyla-park' }]]);

  it('names the hyped artist when taste is the dominant signal', () => {
    const s: Signals = { taste: 1, geo: null, social: 0.1, momentum: 0.1, collab: null, comparable: null };
    const r = buildReason(s, ['house'], genreToArtist, 'Portland');
    expect(r.kind).toBe('taste');
    expect(r.text).toBe('Because you hyped Nyla Park');
    expect(r.artistSlug).toBe('nyla-park');
  });

  it('falls back to genre text when no hyped artist maps to the genre', () => {
    const s: Signals = { taste: 1, geo: null, social: 0.1, momentum: 0, collab: null, comparable: null };
    const r = buildReason(s, ['Ambient'], genreToArtist, null);
    expect(r.text).toBe('Matches your taste in Ambient');
    expect(r.artistSlug).toBeUndefined();
  });

  it('uses the city when geo dominates', () => {
    const s: Signals = { taste: null, geo: 1, social: 0.05, momentum: 0, collab: null, comparable: null };
    const r = buildReason(s, [], genreToArtist, 'Portland');
    expect(r).toMatchObject({ kind: 'geo', text: 'Popular in Portland' });
  });

  it('reports collaborative filtering when collab dominates', () => {
    const s: Signals = { taste: 0.1, geo: null, social: 0.1, momentum: 0, collab: 1, comparable: null };
    expect(buildReason(s, ['x'], genreToArtist, null).kind).toBe('collab');
  });

  it('defaults to a social reason when nothing else is present', () => {
    const s: Signals = { taste: null, geo: null, social: 0, momentum: 0, collab: null, comparable: null };
    expect(buildReason(s, [], genreToArtist, null).kind).toBe('social');
  });
});
