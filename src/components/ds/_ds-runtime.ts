/**
 * The one hand-written file in `src/components/ds/`.
 *
 * Everything else in this directory is GENERATED from the vendored design
 * system by `npm run vendor:ds` — see `./README.md`. This module is the small
 * runtime those generated files call, and it exists for exactly one reason:
 * the design system writes type sizes as inline `px` numbers, and this app
 * cannot ship inline px type.
 *
 * `--ihype-text-scale` (Settings -> Accessibility -> Text size) is applied to
 * the ROOT font size, so `rem` follows the reader's setting and `px` cannot.
 * That is why `scripts/lint-source.mjs` fails the build on an inline px
 * `fontSize`, and why every size coming out of the design system is converted
 * here rather than being copied across as a number.
 *
 * The floor is the design system's OWN rule, not an invention of this repo:
 * ADHERENCE.md rule 3 — "Content has a 15px floor ... The single exception is
 * the tracked-mono eyebrow: 11px." The generator decides which of the two
 * applies from the surrounding style object, the same way `lint-source.mjs`
 * decides it, and records every value it had to raise in the vendor report so
 * the fix can be made upstream in the design system instead of here.
 */

/** The design system's content floor, in px. */
export const DS_BODY_FLOOR_PX = 15;

/** The design system's tracked-mono eyebrow floor, in px. Metadata only. */
export const DS_EYEBROW_FLOOR_PX = 11;

/**
 * A design-system px size as a `rem` string, never below the floor.
 *
 * Generated components call this for any size they compute at runtime (a knob
 * label sized from its own diameter, a trend readout three px under its row).
 * Static sizes are converted at generation time and arrive here as literals.
 */
export function dsFontSize(px: number, floorPx: number = DS_BODY_FLOOR_PX): string {
  const value = Number.isFinite(px) ? Math.max(floorPx, px) : floorPx;
  return `${value / 16}rem`;
}
