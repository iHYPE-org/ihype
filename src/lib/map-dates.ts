/**
 * The MAP date strip's date maths, kept pure and out of the component.
 *
 * Design System 8's map document is explicit about the semantics, and they are
 * not the obvious ones:
 *
 * > "A set of days, not a span. Clicking the strip toggles one day, so a Friday
 * > and a Sunday with nothing between them is a legal selection — which is what
 * > anyone planning a weekend actually wants."
 *
 * So this is a `Set`, not a `{from, to}`. Everything below follows from that.
 *
 * Dependency-light on purpose (no `@/lib/db`, no `next/*`): the picker is a
 * client component and these are the parts worth testing.
 *
 * ## The five-day strip became a calendar (2026-08-22)
 *
 * The map used to show five day cards above a DATES readout. They are gone at
 * the owner's direction ("Remove individual dates and put a date selection
 * inside search bar to the right that pops up calendar for date selection"), so
 * the set is no longer bounded by a five-item strip and the maths that assumed
 * one had to go with it. `monthGrid` and `describeDayKeys` replace `stripDays`
 * and `describeSelection`: a calendar can reach any date, so a summary cannot be
 * derived by filtering a known list — it has to read the keys themselves.
 *
 * ## Local days, deliberately
 *
 * A day here is the viewer's local calendar day, formatted as `YYYY-MM-DD` and
 * sent to the server, which resolves it against ITS zone. That looks like a bug
 * and is the intended behaviour: someone asking for Friday means Friday where
 * the show is. `toISOString()` would be wrong — it converts to UTC first, so
 * anyone west of Greenwich after 5pm asks for tomorrow.
 */

/** `YYYY-MM-DD` in the LOCAL zone. Never `toISOString()` — see the header. */
export function toDayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Toggle one day. Returns a new Set — the caller stores it in React state. */
export function toggleDay(selected: ReadonlySet<string>, key: string): Set<string> {
  const next = new Set(selected);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

/** The query value, sorted so the same selection always produces one URL. */
export function toDatesParam(selected: ReadonlySet<string>): string {
  return [...selected].sort().join(',');
}

export type CalendarCell = {
  /** `YYYY-MM-DD`, the same value the API takes. */
  key: string;
  /** Day of month, 1-31. */
  day: number;
  /** False for the leading/trailing cells that belong to the neighbouring month. */
  inMonth: boolean;
  /** Before today in the viewer's own zone — offered but not selectable. */
  isPast: boolean;
  isToday: boolean;
};

export type CalendarMonth = {
  /** `August 2026`, for the popover's own heading. */
  title: string;
  /** Always six rows of seven, so the grid never changes height mid-month. */
  weeks: CalendarCell[][];
};

/**
 * The month grid the date popover draws.
 *
 * Six rows of seven, always — a five-row month rendered five rows tall makes
 * the popover jump 40px when you page into a six-row one, and a popover that
 * resizes under the thumb loses the day you were reaching for.
 *
 * Weeks start Sunday, matching the `en-US` locale the rest of this module
 * formats in.
 *
 * `isPast` is computed against the LOCAL day, for the same reason `toDayKey`
 * refuses `toISOString()`: the events endpoint rejects past dates, so a past
 * cell is a control that returns nothing by construction. It is rendered
 * (a calendar with holes is not a calendar) and disabled.
 */
export function monthGrid(anchor: Date, today: Date = new Date()): CalendarMonth {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const first = new Date(year, month, 1);
  // Back up to the Sunday on or before the 1st. getDay() is already local.
  const start = new Date(year, month, 1 - first.getDay());
  const todayKey = toDayKey(today);

  const weeks: CalendarCell[][] = [];
  for (let week = 0; week < 6; week += 1) {
    const row: CalendarCell[] = [];
    for (let weekday = 0; weekday < 7; weekday += 1) {
      // Date-only arithmetic via the constructor, so a DST boundary shifts the
      // clock rather than skipping a calendar day.
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + week * 7 + weekday);
      const key = toDayKey(date);
      row.push({
        key,
        day: date.getDate(),
        inMonth: date.getMonth() === month,
        isPast: key < todayKey,
        isToday: key === todayKey,
      });
    }
    weeks.push(row);
  }

  return {
    title: first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    weeks,
  };
}

/** Page the popover a whole month, keeping the day-of-month out of it. */
export function shiftMonth(anchor: Date, delta: number): Date {
  return new Date(anchor.getFullYear(), anchor.getMonth() + delta, 1);
}

/**
 * The readout on the picker's own button.
 *
 * Reads the KEYS, not a strip: a calendar can reach any date, so there is no
 * known list to filter. The empty case still matters and still says "Any day" —
 * the picker is a filter, and an unset filter is not an empty result.
 *
 * One day is named in full because that is the useful thing to see. More than
 * one is counted rather than listed: three dates do not fit the button, and a
 * range would claim the days between, which the set semantics explicitly do not
 * include (a Friday and a Sunday with nothing between them is legal).
 */
export function describeDayKeys(selected: ReadonlySet<string>): string {
  const keys = [...selected].sort();
  if (keys.length === 0) return 'Any day';
  if (keys.length === 1) return formatDayKey(keys[0]);
  return `${keys.length} days`;
}

/** `Sat, Aug 22` from `2026-08-22`, parsed as a LOCAL date rather than UTC. */
export function formatDayKey(key: string): string {
  const [year, month, day] = key.split('-').map(Number);
  // `new Date('2026-08-22')` parses as UTC midnight and formats as the 21st
  // west of Greenwich. The numeric constructor is local, which is what a
  // calendar day means here.
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
