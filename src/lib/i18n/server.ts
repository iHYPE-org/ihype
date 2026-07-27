import { cookies } from 'next/headers';
import en from '@/lib/i18n/dictionaries/en.json';
import es from '@/lib/i18n/dictionaries/es.json';
import fr from '@/lib/i18n/dictionaries/fr.json';
import pt from '@/lib/i18n/dictionaries/pt.json';
import ar from '@/lib/i18n/dictionaries/ar.json';
import de from '@/lib/i18n/dictionaries/de.json';
import ja from '@/lib/i18n/dictionaries/ja.json';
import zh from '@/lib/i18n/dictionaries/zh.json';
import it from '@/lib/i18n/dictionaries/it.json';
import ko from '@/lib/i18n/dictionaries/ko.json';
import hi from '@/lib/i18n/dictionaries/hi.json';
import ru from '@/lib/i18n/dictionaries/ru.json';
import { isSupportedLocale, LOCALE_COOKIE, type Locale } from '@/lib/i18n/locales';

type Dictionary = Record<string, string>;

// Server components can't read localStorage, so the client I18nProvider also
// mirrors its locale into this cookie. Unlike the client dictionaries (which
// code-split per locale), all 12 are just imported directly here — server
// bundles pay this cost once at build time, not per-request, and Next.js
// dedupes the import across every server component that calls getLocale().
const DICTIONARIES: Record<Locale, Dictionary> = {
  en: en as Dictionary, es: es as Dictionary, fr: fr as Dictionary, pt: pt as Dictionary,
  ar: ar as Dictionary, de: de as Dictionary, ja: ja as Dictionary, zh: zh as Dictionary,
  it: it as Dictionary, ko: ko as Dictionary, hi: hi as Dictionary, ru: ru as Dictionary,
};

/** Reads the visitor's locale cookie in a server component. Defaults to English when unset (first visit — the client provider sets this cookie on its own first render, so it lands on the next navigation). */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isSupportedLocale(value) ? value : 'en';
}

/**
 * Returns a `t(key, fallback)` bound to one locale, for use in a server
 * component: `const t = getT(await getLocale())`.
 *
 * Resolution is deliberately IDENTICAL to the client's useI18n(): the locale's
 * own dictionary, then the inline English fallback. There is no separate
 * en.json tier here even though this module can see the file.
 *
 * That matters for correctness, not symmetry. The client dropped its static
 * en.json import (it is redundant — every t() call carries its English text
 * inline, and bundling it cost 53KB on every page load). If the server kept
 * consulting en.json as a middle tier, then any key whose en.json value ever
 * drifted from its inline fallback would render one string server-side and a
 * different one client-side — a React hydration mismatch, and a confusing one
 * to trace back to a dictionary edit. The two paths now cannot disagree.
 * `src/lib/__tests__/i18n-parity.test.ts` locks this down.
 */
export function getT(locale: Locale) {
  const dict = locale === 'en' ? {} : (DICTIONARIES[locale] ?? {});
  return (key: string, fallback?: string): string => dict[key] ?? fallback ?? key;
}
