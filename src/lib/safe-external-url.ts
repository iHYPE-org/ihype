/**
 * SSRF guard for user-supplied URLs the server will fetch (e.g. the page
 * editor's website import). Only allows public http(s) URLs by hostname
 * shape: no credentials, no ports, no IP literals, no localhost/.local/
 * .internal/.home.arpa names. Apply to the initial URL and again to every
 * redirect hop.
 */
export function validatePublicHttpUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (url.username || url.password || url.port) return null;
  const host = url.hostname.toLowerCase();
  if (!host.includes('.')) return null; // bare names like "localhost", "router"
  if (host.startsWith('.') || host.endsWith('.')) return null;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return null; // IPv4 literal
  if (host.startsWith('[') || host.includes(':')) return null; // IPv6 literal
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.home.arpa') ||
    host.endsWith('.ihype.org')
  ) {
    return null;
  }
  return url;
}
