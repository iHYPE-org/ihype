'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import en from '@/lib/i18n/dictionaries/en.json';
import { SUPPORTED_LOCALES, RTL_LOCALES, isSupportedLocale, LOCALE_COOKIE, type Locale } from '@/lib/i18n/locales';

const STORAGE_KEY = 'ihype-locale';

function writeLocaleCookie(locale: Locale) {
  // 1 year, readable by getLocale() (src/lib/i18n/server.ts) for every server
  // component — localStorage alone is invisible to server-rendered pages.
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; SameSite=Lax`;
}

type Dictionary = Record<string, string>;

const dictionaryCache = new Map<Locale, Dictionary>([['en', en as Dictionary]]);

async function loadDictionary(locale: Locale): Promise<Dictionary> {
  const cached = dictionaryCache.get(locale);
  if (cached) return cached;

  // Code-split per locale — mirrors the design system's own lazy per-language
  // chunk loading (lib/i18n.js's __ihypeLoadLangChunk), just via Next.js's
  // dynamic import instead of a manual <script> tag.
  const mod = await import(`@/lib/i18n/dictionaries/${locale}.json`);
  const dict = (mod.default ?? mod) as Dictionary;
  dictionaryCache.set(locale, dict);
  return dict;
}

function detectInitialLocale(): Locale {
  if (typeof window === 'undefined') return 'en';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (isSupportedLocale(stored)) return stored;
  const nav = (navigator.language || 'en').toLowerCase().split('-')[0];
  return isSupportedLocale(nav) ? nav : 'en';
}

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, fallback?: string) => string;
  isRTL: boolean;
};

const I18nContext = createContext<I18nContextValue | null>(null);

/**
 * Mounted once at the app root (AppProviders) — same pattern as
 * AccessibilityProvider. Ports the design system's lib/i18n.js dictionary
 * (12 locales, ~1400+ real translated keys) into a real React context: a
 * saved locale preference re-applies on every fresh page load, and any
 * translated string swapped in via useI18n()'s t() re-renders live when the
 * locale changes, without a full page reload.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [locale, setLocaleState] = useState<Locale>('en');
  const [dict, setDict] = useState<Dictionary>(en as Dictionary);

  useEffect(() => {
    const initial = detectInitialLocale();
    setLocaleState(initial);
    writeLocaleCookie(initial);
    if (initial !== 'en') {
      loadDictionary(initial).then(setDict).catch(() => {});
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = RTL_LOCALES.includes(locale) ? 'rtl' : 'ltr';
  }, [locale]);

  function setLocale(next: Locale) {
    setLocaleState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    writeLocaleCookie(next);
    loadDictionary(next).then(setDict).catch(() => {});
    // Server components read the locale cookie at render time, so they need
    // a fresh server render to pick up the change — a client-side re-render
    // alone would leave all their already-rendered strings in the old locale.
    router.refresh();
  }

  function t(key: string, fallback?: string): string {
    return dict[key] ?? (en as Dictionary)[key] ?? fallback ?? key;
  }

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, isRTL: RTL_LOCALES.includes(locale) }}>
      {children}
    </I18nContext.Provider>
  );
}

/** Falls back to English/no-op when rendered outside the provider (shouldn't happen — mounted at the app root). */
export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (ctx) return ctx;
  return { locale: 'en', setLocale: () => {}, t: (key, fallback) => fallback ?? key, isRTL: false };
}

export { SUPPORTED_LOCALES };
