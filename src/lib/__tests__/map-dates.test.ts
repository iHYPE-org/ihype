import { describe, expect, it } from 'vitest';
import { describeDayKeys, formatDayKey, monthGrid, shiftMonth, toDatesParam, toDayKey, toggleDay } from '@/lib/map-dates';

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

describe('monthGrid', () => {
  // A fixed "today" throughout, so isPast/isToday are not clock-dependent.
  const today = new Date(2026, 7, 22);

  it('always renders six rows of seven, whatever shape the month is', () => {
    // February 2026 starts on a Sunday and is 28 days: exactly four weeks, the
    // month most likely to render short. A popover that changes height as you
    // page loses the day the thumb was reaching for.
    for (const month of [1, 7, 10]) {
      const grid = monthGrid(new Date(2026, month, 1), today);
      expect(grid.weeks).toHaveLength(6);
      for (const week of grid.weeks) expect(week).toHaveLength(7);
    }
  });

  it('starts each row on a Sunday and pads with the neighbouring months', () => {
    const grid = monthGrid(new Date(2026, 7, 1), today);
    // 1 Aug 2026 is a Saturday, so the first row is 26–31 July then 1 August.
    expect(grid.weeks[0].map((cell) => cell.key)).toEqual([
      '2026-07-26', '2026-07-27', '2026-07-28', '2026-07-29', '2026-07-30', '2026-07-31', '2026-08-01',
    ]);
    expect(grid.weeks[0].slice(0, 6).every((cell) => !cell.inMonth)).toBe(true);
    expect(grid.weeks[0][6].inMonth).toBe(true);
  });

  it('names the month it was anchored in, not the padding', () => {
    expect(monthGrid(new Date(2026, 7, 1), today).title).toBe('August 2026');
  });

  it('marks today, and marks every earlier day past', () => {
    const cells = monthGrid(new Date(2026, 7, 1), today).weeks.flat();
    const byKey = new Map(cells.map((cell) => [cell.key, cell]));
    expect(byKey.get('2026-08-22')?.isToday).toBe(true);
    expect(byKey.get('2026-08-22')?.isPast).toBe(false);
    expect(byKey.get('2026-08-21')?.isPast).toBe(true);
    expect(byKey.get('2026-08-23')?.isPast).toBe(false);
    // Including the padding, which is what makes the leading cells unselectable
    // rather than merely faint.
    expect(byKey.get('2026-07-31')?.isPast).toBe(true);
  });

  it('crosses a leap day without skipping or repeating one', () => {
    const keys = monthGrid(new Date(2028, 1, 1), new Date(2028, 1, 1)).weeks.flat().map((c) => c.key);
    expect(keys).toContain('2028-02-29');
    expect(keys.filter((key) => key === '2028-02-29')).toHaveLength(1);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('runs a continuous day sequence with no gaps at a month boundary', () => {
    const keys = monthGrid(new Date(2026, 7, 1), today).weeks.flat().map((c) => c.key);
    for (let index = 1; index < keys.length; index += 1) {
      const [ay, am, ad] = keys[index - 1].split('-').map(Number);
      const [by, bm, bd] = keys[index].split('-').map(Number);
      const gap = (Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000;
      expect(gap).toBe(1);
    }
  });
});

describe('shiftMonth', () => {
  it('pages a whole month and keeps the day of month out of it', () => {
    // Anchored on the 31st, a naive setMonth(+1) lands in the month AFTER next
    // for any 30-day month — 31 August + 1 month would be 1 October.
    const next = shiftMonth(new Date(2026, 7, 31), 1);
    expect([next.getFullYear(), next.getMonth(), next.getDate()]).toEqual([2026, 8, 1]);
  });

  it('crosses a year boundary in both directions', () => {
    expect(shiftMonth(new Date(2026, 11, 15), 1).getFullYear()).toBe(2027);
    expect(shiftMonth(new Date(2026, 0, 15), -1).getFullYear()).toBe(2025);
  });
});

describe('describeDayKeys', () => {
  it('says "Any day" when nothing is picked — an unset filter is not empty', () => {
    expect(describeDayKeys(new Set())).toBe('Any day');
  });

  it('names the single day in full', () => {
    expect(describeDayKeys(new Set(['2026-08-07']))).toBe('Fri, Aug 7');
  });

  it('counts rather than spanning, so it cannot claim a day in a gap', () => {
    // Fri + Sun must never read as "Aug 7 - Aug 9", which asserts a Saturday
    // nobody selected. The set semantics allow the gap; the label must not
    // paper over it.
    expect(describeDayKeys(new Set(['2026-08-07', '2026-08-09']))).toBe('2 days');
  });
});

describe('formatDayKey', () => {
  it('parses the key as a LOCAL day, not UTC midnight', () => {
    // `new Date('2026-08-22')` is UTC midnight and formats as the 21st anywhere
    // west of Greenwich — the same trap toDayKey exists to avoid.
    expect(formatDayKey('2026-08-22')).toBe('Sat, Aug 22');
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
