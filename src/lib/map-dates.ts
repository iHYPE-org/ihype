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
 * Dependency-light on purpose (no `@/lib/db`, no `next/*`): the strip is a
 * client component and these are the parts worth testing.
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

export type StripDay = {
  /** `YYYY-MM-DD`, the value sent to the API. */
  key: string;
  /** `FRI` */
  weekday: string;
  /** `7` */
  day: number;
  /** `AUG` */
  month: string;
};

/**
 * The days the strip offers, starting today. Five, as drawn.
 *
 * Only future days: the strip is "what is on", and the events endpoint refuses
 * past dates anyway, so offering yesterday would be a control that returns
 * nothing by construction.
 */
export function stripDays(from: Date, count = 5): StripDay[] {
  const out: StripDay[] = [];
  for (let index = 0; index < count; index += 1) {
    // Date-only arithmetic via setDate, so a DST boundary shifts the clock
    // rather than skipping a calendar day — adding 86_400_000ms would land on
    // the same date twice in the autumn.
    const date = new Date(from.getFullYear(), from.getMonth(), from.getDate() + index);
    out.push({
      key: toDayKey(date),
      weekday: date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
      day: date.getDate(),
      month: date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
    });
  }
  return out;
}

/**
 * The summary line beside the DATES label.
 *
 * Three cases, and the empty one matters: with nothing selected the map shows
 * every upcoming show, so the honest word is "Any day" rather than "None" —
 * the strip is a filter, and an unset filter is not an empty result.
 */
export function describeSelection(selected: ReadonlySet<string>, days: readonly StripDay[]): string {
  const chosen = days.filter((day) => selected.has(day.key));
  if (chosen.length === 0) return 'Any day';
  if (chosen.length === 1) {
    const [only] = chosen;
    return `${title(only.weekday)} ${title(only.month)} ${only.day} · one day`;
  }
  const first = chosen[0];
  const last = chosen[chosen.length - 1];
  // "3 of 5" rather than a range, because the selection need not be contiguous
  // and describing Fri–Sun would claim a Saturday nobody picked.
  const span = `${title(first.month)} ${first.day} – ${title(last.month)} ${last.day}`;
  return chosen.length === lengthBetween(days, first.key, last.key)
    ? `${span} · ${chosen.length} days`
    : `${span} · ${chosen.length} days selected`;
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

function title(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

function lengthBetween(days: readonly StripDay[], fromKey: string, toKey: string): number {
  const from = days.findIndex((day) => day.key === fromKey);
  const to = days.findIndex((day) => day.key === toKey);
  return from === -1 || to === -1 ? -1 : to - from + 1;
}
