/** Shared between the client I18nProvider (writes it) and the server getLocale() (reads it) — kept in this dependency-light module since server.ts imports next/headers, which can't be pulled into a client bundle. */
export const LOCALE_COOKIE = 'ihype_locale';

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
