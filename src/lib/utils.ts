export function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

import { formatDoorTime } from '@/lib/format-locale';
import type { Locale } from '@/lib/i18n/locales';

/**
 * Date and clock together, in the member's language and on the VENUE'S clock.
 *
 * `timeZone` is REQUIRED and nullable rather than optional, so adding a caller
 * is a decision about which clock the reading is on rather than a default that
 * quietly means "the server's" — which is what this helper used to mean, and
 * what put a Portland show's Saturday door on a Sunday. Pass `Show.timeZone`;
 * pass `null` only for an instant that has no venue (`ticketingOpensAt` is the
 * one — when sales open is a platform moment, and it names whatever clock it
 * rendered on).
 *
 * Written as components, never `dateStyle`/`timeStyle`: Intl refuses to combine
 * either with the zone name.
 */
export function formatShowTime(date: Date, locale: Locale, timeZone: string | null) {
  return formatDoorTime(locale, date, timeZone, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_BASE_URL ?? 'https://ihype.org';
}

