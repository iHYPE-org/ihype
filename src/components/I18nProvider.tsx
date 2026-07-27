'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import en from '@/lib/i18n/dictionaries/en.json';
import { SUPPORTED_LOCALES, RTL_LOCALES, isSupportedLocale, type Locale } from '@/lib/i18n/locales';

const STORAGE_KEY = 'ihype-locale';

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
  const [locale, setLocaleState] = useState<Locale>('en');
  const [dict, setDict] = useState<Dictionary>(en as Dictionary);

  useEffect(() => {
    const initial = detectInitialLocale();
    setLocaleState(initial);
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
    loadDictionary(next).then(setDict).catch(() => {});
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
