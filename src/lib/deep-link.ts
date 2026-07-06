// Universal Links (iOS) / App Links (Android) hand the native shell a full
// https://ihype.org/... URL via Capacitor's `appUrlOpen` event — this turns
// that into an internal path the app router can push to, rejecting anything
// that isn't actually our own domain so a malformed or spoofed URL can never
// navigate the app to an external origin.
const ALLOWED_HOSTS = new Set(['ihype.org', 'www.ihype.org']);

export function resolveInternalPath(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  if (!ALLOWED_HOSTS.has(url.hostname.toLowerCase())) return null;

  return `${url.pathname}${url.search}${url.hash}` || '/';
}
