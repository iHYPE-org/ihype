import { describe, expect, it } from 'vitest';
import {
  AD_SPOT_TOLERANCE_SECS,
  MAX_AD_SPOT_SECS,
  MIN_AD_SPOT_SECS,
  checkAdSpotDuration,
} from '@/lib/ad-spot';

describe('checkAdSpotDuration', () => {
  it('accepts the advertised 15–30 second window', () => {
    for (const secs of [MIN_AD_SPOT_SECS, 20, 25, MAX_AD_SPOT_SECS]) {
      expect(checkAdSpotDuration(secs).ok).toBe(true);
    }
  });

  it('absorbs encoder rounding at both ends', () => {
    // A spot cut to exactly 30s routinely measures 30.1 — rejecting that is
    // rejecting a correct advert on a measurement artefact.
    expect(checkAdSpotDuration(MAX_AD_SPOT_SECS + AD_SPOT_TOLERANCE_SECS).ok).toBe(true);
    expect(checkAdSpotDuration(MIN_AD_SPOT_SECS - AD_SPOT_TOLERANCE_SECS).ok).toBe(true);
  });

  it('rejects a spot that is actually too long', () => {
    const result = checkAdSpotDuration(90);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toBe('too_long');
  });

  it('rejects a spot that is actually too short', () => {
    const result = checkAdSpotDuration(4);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toBe('too_short');
  });

  it('rejects an unreadable duration rather than waving it through', () => {
    // "We could not measure it, so allow it" is the exact path a ten-minute
    // file would take.
    for (const bad of [null, undefined, 0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = checkAdSpotDuration(bad as number);
      expect(result.ok).toBe(false);
    }
    expect(checkAdSpotDuration(null).ok === false && checkAdSpotDuration(null)).toMatchObject({ reason: 'unknown' });
  });

  it('tells the advertiser the measured length, not just that it failed', () => {
    const result = checkAdSpotDuration(90);
    expect(result.ok === false && result.message).toContain('90');
  });
});
