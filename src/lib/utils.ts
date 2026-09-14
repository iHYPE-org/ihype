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

export function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}
