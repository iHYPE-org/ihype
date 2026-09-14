import type { Locale } from '@/lib/i18n/locales';

/**
 * Dates, counts and money in the MEMBER'S language (2026-09-14, DESIGN_SYNC
 * row 424).
 *
 * Until this module every date and figure the product rendered was formatted
 * with a literal `'en-US'` (65 sites) or with no locale at all (79 more — the
 * Worker's default is en-US and a browser's is whatever the OS says, neither
 * of which is the language the member picked in Settings). So a member who had
 * chosen Español read "lun, 14 sept" nowhere and "Mon, Sep 14 · 8:00 PM"
 * beside every translated sentence, and every instrument that measures
 * translation was green, because none of them reads a `Date`.
 *
 * Every formatter here takes the product `Locale` — the same value `useI18n()`
 * hands a client component and `getServerI18n()` hands a server one — and maps
 * it to the BCP-47 tag Intl needs. **English is pinned to `en-US`**, not bare
 * `en`, so English output stays byte-identical to what shipped before this
 * module: the twelve-hour clock, "Sep 14", "$1,234.56". A test holds that.
 *
 * Money is USD everywhere (Stripe charges in dollars), so `formatUsd` formats
 * the DOLLAR AMOUNT in the member's number system and lets Intl place the
 * currency mark the way that language does — "1.234,56 $" in German,
 * "US$ 1.234,56" in Brazilian Portuguese — rather than concatenating "$" onto a
 * localised number, which reads as a typo in every language but English.
 *
 * Emails, crons, the OG image and the poster are deliberately NOT callers: a
 * recipient has no stored locale and a shared image has no reader, so those
 * stay `'en-US'` and are listed by name in `locale-formatting.test.ts`.
 */
const INTL_TAGS: Record<Locale, string> = {
  en: 'en-US',
  es: 'es',
  fr: 'fr',
  pt: 'pt-BR',
  ar: 'ar',
  de: 'de',
  ja: 'ja',
  zh: 'zh',
  it: 'it',
  ko: 'ko',
  hi: 'hi',
  ru: 'ru',
};

/** The BCP-47 tag Intl receives for a product locale. Unknown input is English, never a throw — a formatter must not take a page down. */
export function intlTag(locale: Locale | string | null | undefined): string {
  return (locale && INTL_TAGS[locale as Locale]) || INTL_TAGS.en;
}

export function formatDate(locale: Locale | string | null | undefined, date: Date | string | number, options: Intl.DateTimeFormatOptions): string {
  const value = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat(intlTag(locale), options).format(value);
}

/**
 * A CALENDAR DAY — a date with no time of day, stored at UTC midnight.
 *
 * `AvailabilityDate.date` is the one this product holds: the artist picks
 * 15 March and `new Date('2026-03-15')` stores 2026-03-15T00:00:00Z. Read
 * back in any zone west of Greenwich that instant falls on the 14th, so a
 * plain `formatDate` shows the day BEFORE the day the artist chose — which
 * is exactly what the artist's own editor did while the public pane, three
 * files away, passed `timeZone: 'UTC'` under a comment explaining why
 * (DESIGN_SYNC row 460).
 *
 * The zone is forced and cannot be passed in: a caller who could override it
 * is a caller who will, and this is the whole of the rule. An instant — a
 * scheduled release, a show's start, a payout's moment — is NOT a calendar
 * day and belongs in `formatDate`, where the member's own zone is right.
 */
export function formatCalendarDay(
  locale: Locale | string | null | undefined,
  date: Date | string | number,
  options: Omit<Intl.DateTimeFormatOptions, 'timeZone'> = { year: 'numeric', month: 'short', day: 'numeric' },
): string {
  return formatDate(locale, date, { ...options, timeZone: 'UTC' });
}

/**
 * Is this a zone `Intl` actually knows? The only definitive test is to build a
 * formatter with it — an unknown name throws `RangeError`. Used where a zone
 * arrives from a client (`POST /api/shows`) so an unusable string is refused at
 * the door rather than stored and thrown on by every reader afterwards.
 */
export function isValidTimeZone(zone: unknown): zone is string {
  if (typeof zone !== 'string' || zone.length === 0 || zone.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/**
 * A SHOW'S DOOR TIME — an instant rendered on the VENUE's wall clock.
 *
 * `Show.startsAt` is an instant and nothing else. Every reader formatted it
 * with no zone at all, which means the zone of whatever ran the formatter: UTC
 * on a Cloudflare Worker, so a 9pm Saturday show in Portland was sold on a page
 * reading "Sunday, March 15 - 1:00 AM". A fan four hours out is told the wrong
 * night; a fan in the same city as the venue is told the wrong hour.
 *
 * The zone is the one the ORGANISER'S OWN BROWSER reported when they picked the
 * time (`Show.timeZone`, captured by the event creator), because that is the
 * only place in this product that has ever known which clock the door time was
 * on. A show created before the column has `null`, and then this renders in the
 * runtime's own zone — which is the old behaviour, except that it SAYS SO.
 *
 * Two rules, and both are the point:
 *
 * 1. **A clock time always names its zone.** When `options` asks for an hour,
 *    `timeZoneName: 'short'` is added and cannot be turned off — "9:00 PM EDT".
 *    A bare "9:00 PM" is the ambiguity this function exists to remove, and a
 *    caller who could opt out is a caller who will. A date with no hour names
 *    no zone, because "Saturday, March 14" carries no clock to be wrong about.
 * 2. **An unknown zone never throws.** `Intl` rejects a name it does not know
 *    with a `RangeError`, and a formatter must not take a page down; a bad
 *    stored zone degrades to the runtime's.
 *
 * `dateStyle` and `timeStyle` are refused by the signature, and that is not
 * tidiness: `Intl` throws outright when either is combined with a component
 * option, `timeZoneName` included, so a caller reaching for `timeStyle: 'short'`
 * here would take the page down at the moment the zone was added. Name the
 * components.
 */
export function formatDoorTime(
  locale: Locale | string | null | undefined,
  instant: Date | string | number,
  timeZone: string | null | undefined,
  options: Omit<Intl.DateTimeFormatOptions, 'dateStyle' | 'timeStyle' | 'timeZone'> = { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' },
): string {
  const wantsClock = options.hour !== undefined;
  const withZone: Intl.DateTimeFormatOptions = {
    ...options,
    ...(wantsClock ? { timeZoneName: options.timeZoneName ?? 'short' } : {}),
  };
  if (timeZone) {
    try {
      return formatDate(locale, instant, { ...withZone, timeZone });
    } catch {
      /* A stored zone Intl cannot resolve — fall through to the runtime's,
         which is still a real clock and is still named. */
    }
  }
  return formatDate(locale, instant, withZone);
}

export function formatNumber(locale: Locale | string | null | undefined, value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(intlTag(locale), options).format(value);
}

/**
 * A USD amount from CENTS. `digits` is how many decimals to show: `2` for a
 * receipt line, `0` for a headline figure, `'auto'` for a face value that
 * drops the cents when there are none ("$18", "$18.50").
 */
export function formatUsd(locale: Locale | string | null | undefined, cents: number, digits: 0 | 2 | 'auto' = 2): string {
  const dollars = cents / 100;
  const fraction = digits === 'auto' ? (Number.isInteger(dollars) ? 0 : 2) : digits;
  return new Intl.NumberFormat(intlTag(locale), {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: fraction,
    maximumFractionDigits: fraction,
  }).format(dollars);
}

/**
 * "5m ago" / "hace 5 min" / "5分前" — the age of a notification, in the
 * member's language, through `Intl.RelativeTimeFormat`. Replaces a hand-written
 * `timeAgo()` whose five English strings were the same in every locale. The
 * unit ladder is the old one's: under a minute is "now", then minutes, hours,
 * days, weeks. `narrow` keeps English at "5m ago", which is what the list
 * rendered before.
 */
export function formatRelativeAge(locale: Locale | string | null | undefined, iso: string | Date, now: number = Date.now()): string {
  const at = iso instanceof Date ? iso.getTime() : new Date(iso).getTime();
  if (Number.isNaN(at)) return '';
  const rtf = new Intl.RelativeTimeFormat(intlTag(locale), { numeric: 'auto', style: 'narrow' });
  const mins = Math.floor((now - at) / 60000);
  if (mins < 1) return rtf.format(0, 'second');
  if (mins < 60) return rtf.format(-mins, 'minute');
  const hours = Math.floor(mins / 60);
  if (hours < 24) return rtf.format(-hours, 'hour');
  const days = Math.floor(hours / 24);
  if (days < 7) return rtf.format(-days, 'day');
  return rtf.format(-Math.floor(days / 7), 'week');
}
