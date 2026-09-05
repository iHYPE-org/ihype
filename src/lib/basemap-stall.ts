/**
 * Why the basemap has not drawn yet, said from what MapLibre can report.
 *
 * `MmmMap` declares the map failed when `load` has not fired inside a deadline.
 * Until 2026-09-05 that verdict carried a reason only when MapLibre had emitted
 * an `error` event first — a refused request, a 4xx. The owner then reported a
 * blank map whose line read "The map could not load. Everything else still
 * works." and nothing else: no event had fired, so nothing was known, and the
 * fix was a guess again. This turns the deadline itself into a diagnosis by
 * asking MapLibre which stage it reached:
 *
 *   style not loaded   → the style document never arrived (network, a blocker,
 *                        a proxy, a firewall on the member's side)
 *   style, no tiles    → the style is in and its sources are not; tiles or
 *                        glyphs are pending, or the worker that parses them
 *                        never started
 *   tiles, no frame    → everything arrived and nothing drew: the render loop
 *                        runs on requestAnimationFrame, which a background tab
 *                        or a paused GPU stops, and `load` fires FROM a frame
 *   context lost       → WebGL gave the canvas up
 *
 * Pure so it is tested; `MmmMap` supplies the readings.
 */

export type BasemapStage = {
  /** `map.isStyleLoaded()` at the deadline. */
  styleLoaded: boolean;
  /** `map.areTilesLoaded()` at the deadline. */
  tilesLoaded: boolean;
  /** How many `render` events fired before the deadline. */
  framesRendered: number;
  /** A `webglcontextlost` that has not been restored. */
  contextLost: boolean;
  /** `error` events seen before the deadline. */
  errors: number;
  /** `document.visibilityState === 'hidden'` at the deadline. */
  hidden: boolean;
  /** The host the style is fetched from, named so the line points somewhere. */
  styleHost: string;
  deadlineMs: number;
};

/**
 * `null` means "do not judge yet": a hidden tab has no animation frames, so
 * `load` cannot fire however healthy the network is, and calling that a failure
 * would be wrong every time someone opened the map in a background tab.
 */
export function describeBasemapStall(stage: BasemapStage): string | null {
  if (stage.hidden) return null;
  const seconds = Math.round(stage.deadlineMs / 1000);
  if (stage.contextLost) return 'the graphics context was lost';
  if (!stage.styleLoaded) {
    return stage.errors > 0
      ? `the style from ${stage.styleHost} failed ${stage.errors === 1 ? 'once' : `${stage.errors} times`}`
      : `no reply from ${stage.styleHost} in ${seconds}s`;
  }
  if (!stage.tilesLoaded) {
    return stage.framesRendered === 0
      ? `style loaded, tiles never parsed — the map worker may be blocked`
      : `style loaded, tiles still pending after ${seconds}s`;
  }
  if (stage.framesRendered === 0) return 'map data loaded but nothing drew — graphics paused';
  return `no first frame in ${seconds}s`;
}
