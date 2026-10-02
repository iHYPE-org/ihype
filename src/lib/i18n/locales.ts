/** Shared between the client I18nProvider (writes it) and the server getLocale() (reads it) — kept in this dependency-light module since server.ts imports next/headers, which can't be pulled into a client bundle. */
export const LOCALE_COOKIE = 'ihype_locale';

/** Where a request's locale came from: the cookie, the signed-in member's stored choice, or nobody (English). */
export type LocaleSource = 'cookie' | 'account' | 'default';

/**
 * The locale cookie read off a raw `Cookie` header, for a route handler that
 * has no `cookies()` store in reach — `POST /api/register` records the
 * language the member signed up in. Null when the header carries no
 * supported value, never a default: the caller decides what "unknown" means.
 */
export function localeFromCookieHeader(header: string | null | undefined): Locale | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name !== LOCALE_COOKIE) continue;
    const value = decodeURIComponent(rest.join('=')).trim();
    return isSupportedLocale(value) ? value : null;
  }
  return null;
}

export const SUPPORTED_LOCALES = ['en', 'es', 'fr', 'pt', 'ar', 'de', 'ja', 'zh', 'it', 'ko', 'hi', 'ru'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English', es: 'Español', fr: 'Français', pt: 'Português', ar: 'العربية',
  de: 'Deutsch', ja: '日本語', zh: '中文', it: 'Italiano', ko: '한국어', hi: 'हिन्दी', ru: 'Русский',
};

export const RTL_LOCALES: readonly Locale[] = ['ar'];

export function isSupportedLocale(value: string | null | undefined): value is Locale {
  return !!value && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}
