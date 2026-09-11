import { parseShowProductionPlan, sumProductionPlanDurationSecs } from '@/lib/show-composer';

export const HYPE_TIMELINE_BUCKET_COUNT = 10;

/**
 * Which tenth of a show's runtime a hype landed in (0 = first 10%, 9 = final
 * 10%) — a finer "hype timeline" than a plain early/mid/late split, so an
 * artist can see roughly where in the show the crowd actually goes off.
 * Null if duration is unknown.
 */
export function bucketHypePositionIndex(
  positionSeconds: number,
  durationSeconds: number,
  bucketCount: number = HYPE_TIMELINE_BUCKET_COUNT
): number | null {
  if (durationSeconds <= 0 || bucketCount <= 0) return null;
  const pct = Math.min(Math.max(positionSeconds / durationSeconds, 0), 0.999999);
  return Math.floor(pct * bucketCount);
}

/**
 * Show length: the production plan's own total, else a one-hour fallback.
 *
 * A `RadioShowTrack` sum used to come first and won whenever it was non-zero.
 * That model went with the radio-show feature (2026-09-11); the plan is the
 * only stored duration a show can still carry.
 */
export function computeShowDurationSecs(show: {
  productionPlan: unknown;
}): number {
  const plan = parseShowProductionPlan(show.productionPlan);
  const planDur = plan ? sumProductionPlanDurationSecs(plan) : 0;
  if (planDur > 0) return planDur;
  return 3600;
}
