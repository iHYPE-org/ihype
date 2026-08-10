import { describe, expect, it } from 'vitest';
import { describeSelection, stripDays, toDatesParam, toDayKey, toggleDay } from '@/lib/map-dates';

describe('toDayKey', () => {
  it('formats the LOCAL calendar day, not the UTC one', () => {
    // 23:30 local on the 7th. toISOString() would say the 8th for anyone east
    // of Greenwich — which is how a date filter silently asks for tomorrow.
    const local = new Date(2026, 7, 7, 23, 30);
    expect(toDayKey(local)).toBe('2026-08-07');
  });

  it('zero-pads month and day', () => {
    expect(toDayKey(new Date(2026, 0, 3))).toBe('2026-01-03');
  });
});

describe('stripDays', () => {
  it('starts at the given day and runs forward', () => {
    const days = stripDays(new Date(2026, 7, 7), 5);
    expect(days.map((d) => d.key)).toEqual([
      '2026-08-07', '2026-08-08', '2026-08-09', '2026-08-10', '2026-08-11',
    ]);
    expect(days[0].weekday).toBe('FRI');
    expect(days[0].day).toBe(7);
    expect(days[0].month).toBe('AUG');
  });

  it('crosses a month boundary without skipping or repeating a day', () => {
    expect(stripDays(new Date(2026, 7, 30), 4).map((d) => d.key)).toEqual([
      '2026-08-30', '2026-08-31', '2026-09-01', '2026-09-02',
    ]);
  });

  it('crosses a leap day', () => {
    expect(stripDays(new Date(2028, 1, 28), 3).map((d) => d.key)).toEqual([
      '2028-02-28', '2028-02-29', '2028-03-01',
    ]);
  });
});

describe('toggleDay', () => {
  const days = ['2026-08-07', '2026-08-09'];

  it('adds, then removes, and never mutates the input', () => {
    const start: ReadonlySet<string> = new Set(days);
    const added = toggleDay(start, '2026-08-08');
    expect([...added].sort()).toEqual(['2026-08-07', '2026-08-08', '2026-08-09']);
    expect([...start].sort()).toEqual(days);
    expect([...toggleDay(added, '2026-08-08')].sort()).toEqual(days);
  });

  it('allows a non-contiguous selection', () => {
    // The whole reason this is a Set and not a range: Friday and Sunday with
    // nothing between them is what someone planning a weekend actually wants.
    const weekend = toggleDay(toggleDay(new Set(), '2026-08-07'), '2026-08-09');
    expect(weekend.has('2026-08-08')).toBe(false);
    expect(weekend.size).toBe(2);
  });
});

describe('describeSelection', () => {
  const days = stripDays(new Date(2026, 7, 7), 5);

  it('says "Any day" when nothing is picked — an unset filter is not empty', () => {
    expect(describeSelection(new Set(), days)).toBe('Any day');
  });

  it('names the single day', () => {
    expect(describeSelection(new Set(['2026-08-07']), days)).toBe('Fri Aug 7 · one day');
  });

  it('describes a contiguous run as a span', () => {
    const run = new Set(['2026-08-07', '2026-08-08', '2026-08-09']);
    expect(describeSelection(run, days)).toBe('Aug 7 – Aug 9 · 3 days');
  });

  it('does not claim the days in a gap', () => {
    // Fri + Sun must not read as "Aug 7 – Aug 9 · 3 days", which would assert a
    // Saturday nobody selected.
    expect(describeSelection(new Set(['2026-08-07', '2026-08-09']), days))
      .toBe('Aug 7 – Aug 9 · 2 days selected');
  });
});

describe('toDatesParam', () => {
  it('sorts, so one selection is always one URL', () => {
    expect(toDatesParam(new Set(['2026-08-09', '2026-08-07']))).toBe('2026-08-07,2026-08-09');
  });

  it('is empty when nothing is selected', () => {
    expect(toDatesParam(new Set())).toBe('');
  });
});
