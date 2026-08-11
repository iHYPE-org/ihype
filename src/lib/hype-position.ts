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

/** Same trackDur > planDur > 3600-fallback formula the retired RadioHome used to render show length. */
export function computeShowDurationSecs(show: {
  radioTracks: { durationSecs: number | null }[];
  productionPlan: unknown;
}): number {
  const trackDur = show.radioTracks.reduce((sum, t) => sum + (t.durationSecs ?? 0), 0);
  if (trackDur > 0) return trackDur;
  const plan = parseShowProductionPlan(show.productionPlan);
  const planDur = plan ? sumProductionPlanDurationSecs(plan) : 0;
  if (planDur > 0) return planDur;
  return 3600;
}
