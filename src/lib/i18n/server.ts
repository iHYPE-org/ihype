import { cookies } from 'next/headers';
import { isSupportedLocale, LOCALE_COOKIE, type Locale, type LocaleSource } from '@/lib/i18n/locales';

type Dictionary = Record<string, string>;

// Dictionaries are fetched from Cloudflare **static assets**, not bundled.
//
// They used to be twelve static `import ... from './dictionaries/xx.json'`
// lines here. A Worker ships as a single script under a hard 10 MiB gzip
// limit, and those imports were 2.26 MiB gzip of it (measured: building with
// the dictionaries emptied took worker.js from 7.36 MiB to 5.10 MiB). Once the
// user-facing translations were complete the deploy hit 9.07 MiB against the
// 9 MiB budget in scripts/worker-size-budget.mjs.
//
// Per-locale `await import()` does NOT solve this — wrangler re-bundles dynamic
// imports back into the one script (measured 7.36 -> 7.37 MiB) and never
// uploads the split chunks, so it would fail at runtime and quietly serve
// English. Static assets are a separate upload that does not count toward the
// script limit, so scripts/build-i18n-assets.mjs mirrors the dictionaries into
// public/i18n/ and this module reads them from there.
//
// Cached per isolate: a warm isolate fetches each locale at most once.
const CACHE = new Map<Locale, Dictionary>();

/**
 * Reads one locale's dictionary out of the ASSETS binding (production) or over
 * plain HTTP from the app's own origin (local dev, where Next serves public/).
 *
 * Every failure path returns {} rather than throwing: a missing dictionary must
 * degrade to the inline English fallbacks, never blank a page. The one thing it
 * must not do is fail *silently in production* — see the smoke check in
 * scripts/workerd-smoke.mjs, which asserts a real translated string is present
 * in server-rendered HTML so this can't regress unnoticed the way a bundling
 * change already nearly did.
 */
async function fetchDictionary(locale: Locale): Promise<Dictionary> {
  const path = `/i18n/${locale}.json`;

  // Production / `wrangler dev`: the ASSETS binding serves public/ directly,
  // in-process, with no network hop.
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const assets = (getCloudflareContext().env as Record<string, unknown>).ASSETS as
      | { fetch(input: Request | URL | string): Promise<Response> }
      | undefined;
    if (assets) {
      // The origin is ignored by the binding but URL needs an absolute input.
      const res = await assets.fetch(new URL(path, 'https://assets.local'));
      if (res.ok) return (await res.json()) as Dictionary;
      return {};
    }
  } catch {
    // getCloudflareContext() throws outside workerd (next build, next dev,
    // vitest). Fall through to the HTTP path rather than treating it as fatal.
  }

  // Local dev / any non-workerd server: Next serves public/ at the same origin.
  try {
    const base = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const res = await fetch(new URL(path, base));
    if (res.ok) return (await res.json()) as Dictionary;
  } catch {
    // No server reachable (e.g. static generation during `next build`).
  }

  return {};
}

/**
 * The locale's whole dictionary, for the ROOT LAYOUT to hand the client
 * provider as its initial state (DESIGN_SYNC row 426). Until it did, the
 * client started every render at English with no dictionary and the server
 * rendered the cookie locale, so a Spanish member's every `t()` text node
 * differed between the HTML and the first client render — a hydration
 * mismatch on every page. English is `{}` (inline fallbacks), so an English
 * member pays nothing for this.
 */
export async function getServerDictionary(locale: Locale): Promise<Dictionary> {
  return loadDictionary(locale);
}

async function loadDictionary(locale: Locale): Promise<Dictionary> {
  // English resolves entirely from the inline t() fallbacks — see getServerT.
  if (locale === 'en') return {};

  const cached = CACHE.get(locale);
  if (cached) return cached;

  const dict = await fetchDictionary(locale);
  // Only cache a non-empty result: caching {} would pin a transient asset
  // failure for the life of the isolate.
  if (Object.keys(dict).length > 0) CACHE.set(locale, dict);
  return dict;
}


/**
 * The request's locale and where it came from. The cookie wins when it is
 * there — it IS the member's choice on this browser. With no cookie (a new
 * device, a fresh browser, the native app after a reinstall) a signed-in
 * member's STORED choice is honoured, so the first screen is already in their
 * language and the client provider writes the cookie from it rather than
 * guessing from the browser. Only with neither is the answer English.
 *
 * The account read is a dynamic import on purpose: this module is imported
 * by every server page, and `@/lib/auth` must not become a static dependency
 * of the i18n layer (tests import this file without a database). A failed
 * read is a plain English first visit, never an error.
 */
export async function resolveLocale(): Promise<{ locale: Locale; source: LocaleSource }> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  if (isSupportedLocale(value)) return { locale: value, source: 'cookie' };
  try {
    const { auth } = await import('@/lib/auth');
    const session = await auth();
    if (session?.user?.id) {
      const { db } = await import('@/lib/db');
      const user = await db.user.findUnique({ where: { id: session.user.id }, select: { locale: true } });
      if (isSupportedLocale(user?.locale)) return { locale: user.locale, source: 'account' };
    }
  } catch {
    // A first visit in English; the member can still choose.
  }
  return { locale: 'en', source: 'default' };
}

/** Reads the request's locale in a server component — the cookie, else the signed-in member's stored choice, else English. */
export async function getLocale(): Promise<Locale> {
  return (await resolveLocale()).locale;
}

/**
 * A `t(key, fallback)` bound to a locale the CALLER already holds — the
 * member's stored `User.locale` when writing them an email, where there is no
 * request and no cookie. Same resolution as `getServerT()`.
 */
export async function getTForLocale(locale: Locale | null | undefined): Promise<(key: string, fallback?: string) => string> {
  const dict = await loadDictionary(isSupportedLocale(locale) ? locale : 'en');
  return (key: string, fallback?: string): string => dict[key] ?? fallback ?? key;
}

/**
 * Returns a `t(key, fallback)` bound to the request's locale, for use in a
 * server component: `const t = await getServerT()`.
 *
 * Resolution is deliberately IDENTICAL to the client's useI18n(): the locale's
 * own dictionary, then the inline English fallback. There is no separate
 * en.json tier here even though this module could load the file.
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
export async function getServerT(): Promise<(key: string, fallback?: string) => string> {
  const dict = await loadDictionary(await getLocale());
  return (key: string, fallback?: string): string => dict[key] ?? fallback ?? key;
}

/**
 * `t` and the locale it was bound to, in one cookie read — for a server page
 * that also formats a date or a figure (`src/lib/format-locale.ts`). The locale
 * a formatter receives and the locale `t` resolves against must be the SAME
 * value, or a page can read "lun, 14 sept" under an English heading.
 */
export async function getServerI18n(): Promise<{ locale: Locale; source: LocaleSource; t: (key: string, fallback?: string) => string }> {
  const { locale, source } = await resolveLocale();
  const dict = await loadDictionary(locale);
  return { locale, source, t: (key: string, fallback?: string): string => dict[key] ?? fallback ?? key };
}
