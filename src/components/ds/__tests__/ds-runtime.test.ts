import { describe, expect, it } from 'vitest';
import { dsFontSize, DS_BODY_FLOOR_PX, DS_EYEBROW_FLOOR_PX } from '@/components/ds/_ds-runtime';

/**
 * The runtime half of `npm run vendor:ds`.
 *
 * The generated components call this for any type size they compute from their
 * own geometry — a knob cap sized from its diameter, a trend readout three px
 * under its row — so this is the only place a design-system size can reach the
 * DOM without passing through the generator. Both properties below are the
 * reason it exists rather than a `px` number: `rem` follows Settings →
 * Accessibility → Text size, and neither floor may be crossed.
 */
describe('dsFontSize', () => {
  it('converts px to rem at 1/16, so nothing moves at 100% text size', () => {
    expect(dsFontSize(16)).toBe('1rem');
    expect(dsFontSize(24)).toBe('1.5rem');
    expect(dsFontSize(15)).toBe('0.9375rem');
  });

  it('holds the design system\'s 15px content floor', () => {
    // RotaryNav's cap readout: 74px knob x 0.115 = 8.51px in the design system.
    expect(dsFontSize(74 * 0.115)).toBe(`${DS_BODY_FLOOR_PX / 16}rem`);
    expect(dsFontSize(0)).toBe('0.9375rem');
  });

  it('holds the 11px eyebrow floor only when the caller asks for it', () => {
    expect(dsFontSize(9.5, DS_EYEBROW_FLOOR_PX)).toBe('0.6875rem');
    // Above the eyebrow floor, the value is its own.
    expect(dsFontSize(12, DS_EYEBROW_FLOOR_PX)).toBe('0.75rem');
    // The eyebrow floor is never the default: a sentence must not opt into it
    // by omission, which is exactly how 9-10px error messages shipped before.
    expect(dsFontSize(9.5)).toBe(`${DS_BODY_FLOOR_PX / 16}rem`);
  });

  it('falls back to the floor rather than emitting NaNrem', () => {
    // A component computing a size from a prop it was never given (`size`
    // undefined -> NaN) would otherwise write `NaNrem`, which CSS drops — and a
    // dropped font-size inherits, so the bug renders as "looks nearly right".
    expect(dsFontSize(Number.NaN)).toBe('0.9375rem');
    expect(dsFontSize(Number.POSITIVE_INFINITY)).toBe('0.9375rem');
  });
});
