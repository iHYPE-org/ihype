/**
 * Local preview auth is deliberately a two-part gate: an explicit opt-in and
 * a loopback hostname. Even if the flag were copied into a deployment by
 * mistake, a request for ihype.org can never activate it.
 */
export function isLocalAuthSkipEnabled(hostname: string, flag: string | undefined): boolean {
  const host = hostname.split(':')[0]?.toLowerCase() ?? hostname.toLowerCase();
  const isLoopback = host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.localhost');
  return flag === 'true' && isLoopback;
}

