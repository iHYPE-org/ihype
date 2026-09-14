export function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

import { formatDate } from '@/lib/format-locale';
import type { Locale } from '@/lib/i18n/locales';

/** Date and clock together, in the member's language. */
export function formatShowTime(date: Date, locale: Locale) {
  return formatDate(locale, date, { dateStyle: 'medium', timeStyle: 'short' });
}

export function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_BASE_URL ?? 'https://ihype.org';
}

