import { verifyBearerToken } from '@/lib/secret-compare';

function readCloudflareEnv(name: string): string | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getCloudflareContext } = require('@opennextjs/cloudflare');
    const ctx = getCloudflareContext();
    const value = (ctx.env as Record<string, unknown>)[name];
    return typeof value === 'string' ? value : undefined;
  } catch {
    return undefined;
  }
}

export function getCronSecret() {
  return process.env.CRON_SECRET?.trim() || readCloudflareEnv('CRON_SECRET')?.trim() || '';
}

export function isCronRequestAuthorized(request: Request) {
  return verifyBearerToken(request.headers.get('authorization'), getCronSecret());
}
