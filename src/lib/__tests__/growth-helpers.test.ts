import { describe, it, expect } from 'vitest';
import {
  tallyTop, firstName, initialsOf,
  bookingTasteScore as venueTaste, bookingGeoScore as venueGeo,
} from '@/lib/growth-util';

describe('tallyTop (scene wrapped)', () => {
  it('returns null for an empty list', () => {
    expect(tallyTop([])).toBeNull();
  });

  it('returns the most frequent item', () => {
    expect(tallyTop(['house', 'techno', 'house'])).toBe('house');
  });

  it('keeps the first item on a tie (stable)', () => {
    expect(tallyTop(['a', 'b'])).toBe('a');
  });
});

describe('firstName / initialsOf (early believers)', () => {
  it('uses the first token of a display name', () => {
    expect(firstName('Nyla Park', 'nylap')).toBe('Nyla');
  });

  it('falls back to username when no name is set', () => {
    expect(firstName(null, 'nylap')).toBe('nylap');
    expect(firstName('   ', 'nylap')).toBe('nylap');
  });

  it('builds two-letter initials from a full name', () => {
    expect(initialsOf('Nyla Park', 'nylap')).toBe('NP');
  });

  it('falls back to the first two characters for a single token', () => {
    expect(initialsOf('Nyla', 'nylap')).toBe('NY');
    expect(initialsOf(null, 'sk')).toBe('SK');
  });
});

describe('venue booking scorers', () => {
  it('genre taste is 0 with no overlap and 1 with full overlap', () => {
    expect(venueTaste(['house'], ['ambient'])).toBe(0);
    expect(venueTaste(['house', 'techno'], ['house', 'techno'])).toBe(1);
  });

  it('genre taste is 0 when either side has no genres', () => {
    expect(venueTaste([], ['house'])).toBe(0);
    expect(venueTaste(['house'], [])).toBe(0);
  });

  it('geo prefers same city, then same state, then neither', () => {
    expect(venueGeo('Portland', 'ME', 'Portland', 'ME')).toBe(1);
    expect(venueGeo('Portland', 'ME', 'Bangor', 'ME')).toBe(0.6);
    expect(venueGeo('Portland', 'ME', 'Los Angeles', 'CA')).toBe(0.1);
  });
});
