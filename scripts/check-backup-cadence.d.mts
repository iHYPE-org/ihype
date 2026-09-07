/**
 * Type surface of check-backup-cadence.mjs for backup-cadence.test.ts — the
 * script stays plain ESM so node can run it from the nightly and by hand.
 */
export const SCHEDULED_HOURS: number[];
export const RPO_TARGET_HOURS: number;
export const RPO_CEILING_HOURS: number;
export const SILENCE_CEILING_HOURS: number;

export function delayAgainstSlot(when: Date, scheduledHours?: number[]): number;

export interface CadenceGap {
  hours: number;
  from: Date;
  to: Date;
}

export interface CadenceSpread {
  min: number;
  median: number;
  max: number;
}

/**
 * `measurable: false` carries only `reason` and `runs` — an unmeasurable run
 * and a healthy one must never read the same way, so the fields that would
 * imply a verdict are absent rather than zeroed.
 */
export interface CadenceSummary {
  measurable: boolean;
  reason?: string;
  runs: number;
  first?: Date;
  last?: Date;
  sinceLastHours?: number;
  delays?: CadenceSpread;
  gaps?: CadenceSpread | null;
  worstGap?: CadenceGap | null;
  overTargetCount?: number;
  gapCount?: number;
  target?: number;
  ceiling?: number;
  stalled?: boolean;
  breached?: boolean;
  verdict?: 'ok' | 'over-target' | 'breached' | 'stalled';
}

export function summariseCadence(
  runTimes: Date[],
  now: Date,
  options?: {
    targetHours?: number;
    ceilingHours?: number;
    silenceHours?: number;
    scheduledHours?: number[];
  },
): CadenceSummary;

export function renderReport(summary: CadenceSummary): string;
