import { describe, expect, it } from 'vitest';
import { PULSE_SECTIONS, orderPulseSections, type PulseSection } from '@/lib/admin-pulse';

function section(overrides: Partial<PulseSection> & Pick<PulseSection, 'id'>): PulseSection {
  return {
    label: overrides.id,
    glyph: '·',
    summary: '',
    badge: null,
    urgent: false,
    stats: [],
    items: [],
    ...overrides,
  } as PulseSection;
}

describe('orderPulseSections', () => {
  it('puts an urgent section first even when a calmer one has a bigger badge', () => {
    // The whole point of the ordering: 200 waiting-but-on-time items must not
    // bury the one queue that is past the turnaround the product promises.
    const ordered = orderPulseSections([
      section({ id: 'comms', badge: 200 }),
      section({ id: 'attention', badge: 1, urgent: true }),
    ]);
    expect(ordered.map((s) => s.id)).toEqual(['attention', 'comms']);
  });

  it('ranks by badge size within the same urgency', () => {
    const ordered = orderPulseSections([
      section({ id: 'comms', badge: 2 }),
      section({ id: 'money', badge: 9 }),
      section({ id: 'system', badge: 5 }),
    ]);
    expect(ordered.map((s) => s.id)).toEqual(['money', 'system', 'comms']);
  });

  it('sorts a section with no badge below one with a real zero-or-more count', () => {
    // `null` is "could not be read / nothing to badge", not "zero". It must not
    // outrank a section reporting a genuine figure.
    const ordered = orderPulseSections([
      section({ id: 'growth', badge: null }),
      section({ id: 'money', badge: 0 }),
    ]);
    expect(ordered.map((s) => s.id)).toEqual(['money', 'growth']);
  });

  it('does not mutate the array it is given', () => {
    const input = [section({ id: 'comms', badge: 1 }), section({ id: 'attention', urgent: true })];
    const before = input.map((s) => s.id);
    orderPulseSections(input);
    expect(input.map((s) => s.id)).toEqual(before);
  });

  it('keeps every declared section id in the union', () => {
    // Guards the tab strip against a section being added to the data half and
    // silently never rendering, which is invisible until someone looks for a
    // figure that was supposed to be there.
    expect(PULSE_SECTIONS).toEqual(['attention', 'live', 'money', 'growth', 'comms', 'system']);
  });
});
