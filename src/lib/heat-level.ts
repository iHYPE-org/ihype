/**
 * Hype count → heat level.
 *
 * Design System 8 draws demand as a 7px dot in four steps (fire / hot / warm /
 * cold) on every card that carries a hype count — the discover grid, the
 * recruiting kits' city bars, the map's cluster pins. Each of those surfaces
 * was deriving its own threshold, or inventing a different signal entirely:
 * `EventsHome` rendered "+N% this week" from `hypeCount >= 50` and nothing
 * else used that number, so two cards for the same show could disagree about
 * whether it was hot.
 *
 * One function, so they cannot. The thresholds below are a first calibration
 * against real hype counts and are meant to be re-tuned once alpha produces a
 * distribution worth fitting to — but they must be re-tuned HERE, not per
 * surface.
 */
export type HeatLevel = 'fire' | 'hot' | 'warm' | 'cold';

export const HEAT_THRESHOLDS = { fire: 200, hot: 50, warm: 10 } as const;

/** The `--heat-*` token for a level. Never a literal — both themes swap. */
export const HEAT_TOKEN: Record<HeatLevel, string> = {
  fire: 'var(--heat-fire)',
  hot: 'var(--heat-hot)',
  warm: 'var(--heat-warm)',
  cold: 'var(--heat-cold)',
};

/**
 * The dot is `role="img"` with a label, so a screen reader gets the meaning
 * rather than a bare bullet. These are the design's own words.
 */
export const HEAT_LABEL: Record<HeatLevel, string> = {
  fire: 'Hottest right now',
  hot: 'Hot',
  warm: 'Warming up',
  cold: 'Just getting started',
};

export function heatLevel(hypeCount: number): HeatLevel {
  // A missing or malformed count is cold, not a crash and not a false "hot".
  if (!Number.isFinite(hypeCount) || hypeCount <= 0) return 'cold';
  if (hypeCount >= HEAT_THRESHOLDS.fire) return 'fire';
  if (hypeCount >= HEAT_THRESHOLDS.hot) return 'hot';
  if (hypeCount >= HEAT_THRESHOLDS.warm) return 'warm';
  return 'cold';
}
