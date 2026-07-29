import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  hasRuntimeEnvContext,
  readRuntimeEnv,
  runtimeEnvSource,
  setContextReaderForTests,
} from '@/lib/runtime-env';

/**
 * The Cloudflare lookup is a synchronous require() inside runtime-env.ts —
 * the same shape db.ts and cron-auth.ts use — which vitest cannot intercept,
 * so the module exposes a reader seam. `null` models the real out-of-request
 * behaviour (module init, build, plain Node), where the binding is absent.
 */
const cloudflareEnv: { value: Record<string, unknown> | null } = { value: null };

const ORIGINAL = { ...process.env };

beforeEach(() => {
  cloudflareEnv.value = null;
  setContextReaderForTests(() => cloudflareEnv.value);
});

afterEach(() => {
  setContextReaderForTests(null);
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL)) delete (process.env as Record<string, string | undefined>)[key];
  }
  Object.assign(process.env, ORIGINAL);
});

describe('readRuntimeEnv', () => {
  it('finds a Worker secret that is absent from process.env', () => {
    // The whole point: `wrangler secret put` values never reach process.env,
    // which is why email and Stripe reported themselves unconfigured.
    delete (process.env as Record<string, string | undefined>).STRIPE_SECRET_KEY;
    cloudflareEnv.value = { STRIPE_SECRET_KEY: 'sk_live_from_worker_secret' };

    expect(readRuntimeEnv('STRIPE_SECRET_KEY')).toBe('sk_live_from_worker_secret');
  });

  it('prefers process.env so nothing that works today can change', () => {
    process.env.RESEND_API_KEY = 're_from_process';
    cloudflareEnv.value = { RESEND_API_KEY: 're_from_worker' };

    expect(readRuntimeEnv('RESEND_API_KEY')).toBe('re_from_process');
  });

  it('treats an empty process.env value as absent and falls through', () => {
    process.env.EMAIL_FROM = '   ';
    cloudflareEnv.value = { EMAIL_FROM: 'iHYPE <no-reply@ihype.org>' };

    expect(readRuntimeEnv('EMAIL_FROM')).toBe('iHYPE <no-reply@ihype.org>');
  });

  it('returns undefined out of request context rather than throwing', () => {
    delete (process.env as Record<string, string | undefined>).CRON_SECRET;
    cloudflareEnv.value = null;

    expect(readRuntimeEnv('CRON_SECRET')).toBeUndefined();
    expect(hasRuntimeEnvContext()).toBe(false);
  });
});

describe('runtimeEnvSource', () => {
  it('drops non-string bindings so zod never sees a KV namespace', () => {
    // A binding object handed to a z.string() schema would throw
    // "Server misconfiguration" and take the whole app down.
    cloudflareEnv.value = {
      KV: { get: () => undefined },
      R2: { put: () => undefined },
      RATE_LIMITER_DO: { idFromName: () => undefined },
      RESEND_API_KEY: 're_secret',
    };

    const source = runtimeEnvSource();
    expect(source.RESEND_API_KEY).toBe('re_secret');
    expect(source.KV).toBeUndefined();
    expect(source.R2).toBeUndefined();
    expect(source.RATE_LIMITER_DO).toBeUndefined();
  });

  it('never removes or overwrites an existing process.env value', () => {
    process.env.DATABASE_URL = 'postgres://from-process';
    cloudflareEnv.value = { DATABASE_URL: 'postgres://from-worker', AUTH_SECRET: 's'.repeat(32) };

    const source = runtimeEnvSource();
    expect(source.DATABASE_URL).toBe('postgres://from-process');
    expect(source.AUTH_SECRET).toBe('s'.repeat(32));
  });

  it('falls back to process.env alone when there is no context', () => {
    process.env.DATABASE_URL = 'postgres://only-process';
    cloudflareEnv.value = null;

    expect(runtimeEnvSource().DATABASE_URL).toBe('postgres://only-process');
  });
});
