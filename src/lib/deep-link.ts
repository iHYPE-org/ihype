// Universal Links (iOS) / App Links (Android) hand the native shell a full
// https://ihype.org/... URL via Capacitor's `appUrlOpen` event — this turns
// that into an internal path the app router can push to, rejecting anything
// that isn't actually our own domain so a malformed or spoofed URL can never
// navigate the app to an external origin.
const ALLOWED_HOSTS = new Set(['ihype.org', 'www.ihype.org']);

export function resolveInternalPath(rawUrl: string): string | null {
  const candidate = rawUrl.trim();
  const isInternalRelativePath = candidate.startsWith('/') && !candidate.startsWith('//') && !candidate.startsWith('/\\');
  if (!isInternalRelativePath && !/^https:\/\//i.test(candidate)) return null;

  let url: URL;
  try {
    url = new URL(candidate, 'https://ihype.org');
  } catch {
    return null;
  }

  if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname.toLowerCase())) return null;

  return `${url.pathname}${url.search}${url.hash}` || '/';
}

/**
 * True when the native shell must hand this path to the BROWSER rather than
 * to the client router.
 *
 * The magic link in every sign-in email points at `/api/auth/magic?token=…`
 * (`src/lib/magic-link.ts`), a route handler that answers 303 to
 * `/auth/confirm`. Android's App Links filter and iOS's Universal Links carry
 * no path restriction, so tapping that link opens the APP and hands the URL
 * to `appUrlOpen` — and `router.push` expects a route that returns an RSC
 * payload, not a redirect out of a route handler.
 *
 * Whether the router happens to fall back to a hard navigation is not a thing
 * to depend on: this product has exactly two ways in, a passkey and a magic
 * link, and on Android the passkey half is unproven (see the assetlinks
 * route). A full-page navigation is precisely what an emailed link does in a
 * browser, which is the behaviour the route was written against — so the
 * shell does that, deliberately, rather than relying on a framework fallback.
 */
export function needsBrowserNavigation(path: string): boolean {
  return path.startsWith('/api/');
}
