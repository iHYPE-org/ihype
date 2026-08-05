/**
 * What counts as a sellable radio spot.
 *
 * Advertisers buy a 15–30 second spot. Nothing enforced that: the upload route
 * capped file SIZE (10 MB) and computed a duration, and the campaign route
 * stored whatever duration it was handed. A ten-minute file was a valid
 * "advert", and now that spots air on the always-on station between two songs
 * (`src/lib/station-breaks.ts`) that is the difference between a break and an
 * interruption.
 *
 * Kept pure and dependency-free so the upload route, the campaign route and
 * any client-side form can all apply the same rule rather than three
 * approximations of it.
 */

export const MIN_AD_SPOT_SECS = 15;
export const MAX_AD_SPOT_SECS = 30;

/**
 * One second of slack at each end.
 *
 * Encoders round, and `parseAudioDuration` reads container metadata rather
 * than decoding, so a spot cut to exactly thirty seconds routinely measures
 * 30.1. Rejecting that would be rejecting a correct advert on a rounding
 * error, which reads to the advertiser as a broken product. The grace is
 * deliberately small — it absorbs measurement noise, not a different length of
 * advert.
 */
export const AD_SPOT_TOLERANCE_SECS = 1;

export type AdSpotDurationResult =
  | { ok: true }
  | { ok: false; reason: 'unknown' | 'too_short' | 'too_long'; message: string };

/**
 * `durationSecs` is what the server measured, never what the client claimed.
 *
 * An unmeasurable duration is REJECTED rather than waved through. The
 * permissive reading — "we could not read it, so allow it" — is exactly the
 * path an over-long file would take, and this rule has money on both sides of
 * it: the advertiser pays for a spot, and every listener hears it.
 */
export function checkAdSpotDuration(durationSecs: number | null | undefined): AdSpotDurationResult {
  if (typeof durationSecs !== 'number' || !Number.isFinite(durationSecs) || durationSecs <= 0) {
    return {
      ok: false,
      reason: 'unknown',
      message: `We could not read a duration from that file. A spot must be ${MIN_AD_SPOT_SECS}–${MAX_AD_SPOT_SECS} seconds — try exporting it again as MP3.`,
    };
  }
  if (durationSecs < MIN_AD_SPOT_SECS - AD_SPOT_TOLERANCE_SECS) {
    return {
      ok: false,
      reason: 'too_short',
      message: `That spot is ${Math.round(durationSecs)}s. Spots must be at least ${MIN_AD_SPOT_SECS} seconds.`,
    };
  }
  if (durationSecs > MAX_AD_SPOT_SECS + AD_SPOT_TOLERANCE_SECS) {
    return {
      ok: false,
      reason: 'too_long',
      message: `That spot is ${Math.round(durationSecs)}s. Spots must be ${MAX_AD_SPOT_SECS} seconds or less.`,
    };
  }
  return { ok: true };
}
