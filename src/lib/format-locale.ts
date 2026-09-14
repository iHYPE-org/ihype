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
