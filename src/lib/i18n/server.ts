import { cookies } from 'next/headers';
import { isSupportedLocale, LOCALE_COOKIE, type Locale } from '@/lib/i18n/locales';

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

/** Reads the visitor's locale cookie in a server component. Defaults to English when unset (first visit — the client provider sets this cookie on its own first render, so it lands on the next navigation). */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isSupportedLocale(value) ? value : 'en';
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
