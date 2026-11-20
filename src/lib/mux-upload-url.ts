/**
 * Only accept upload destinations operated by Mux. Mux began migrating
 * direct-upload URLs from storage.googleapis.com to subdomains of mux.com
 * in 2025; both are supported without trusting lookalike domains.
 *
 * A signed direct-upload URL is a capability to receive a user's original
 * video. Never forward it to arbitrary HTTPS hosts if the provider response
 * is malformed or an upstream integration is compromised.
 */
export function isAllowedMuxDirectUploadUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    const hostname = url.hostname;
    return url.protocol === 'https:'
      && !url.username && !url.password && !url.port
      && (hostname === 'storage.googleapis.com'
        || (hostname.endsWith('.mux.com') && hostname.length > '.mux.com'.length));
  } catch {
    return false;
  }
}
