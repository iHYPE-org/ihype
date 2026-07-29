import { z } from 'zod';
import { hasRuntimeEnvContext, readRuntimeEnv, runtimeEnvSource } from '@/lib/runtime-env';
import { log } from '@/lib/logger';

// Treat empty strings the same as undefined for optional env vars.
const blank = (v: string | undefined) => (v && v.length > 0 ? v : undefined);
const optStr = z.string().optional().transform(blank);
const optEmail = z.string().optional().transform(v => {
  const s = blank(v); return s && z.string().email().safeParse(s).success ? s : undefined;
});
const optUrl = z.string().optional().transform(v => {
  const s = blank(v); return s && z.string().url().safeParse(s).success ? s : undefined;
});

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(16),
  AUTH_URL: optUrl,
  NEXT_PUBLIC_APP_URL: optUrl,
  OPENAI_API_KEY: optStr,
  SMTP_HOST: optStr,
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_SECURE: optStr,
  SMTP_USER: optStr,
  SMTP_PASSWORD: optStr,
  SMTP_FROM: optEmail,
  EMAIL_FROM: optEmail,
  RESEND_API_KEY: optStr,
  MUX_TOKEN_ID: optStr,
  MUX_TOKEN_SECRET: optStr,
  MUX_WEBHOOK_SECRET: optStr,
  STRIPE_SECRET_KEY: z.string().optional().transform(v => { const s = blank(v); return s?.startsWith('sk_') ? s : undefined; }),
  STRIPE_WEBHOOK_SECRET: z.string().optional().transform(v => { const s = blank(v); return s?.startsWith('whsec_') ? s : undefined; }),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional().transform(v => { const s = blank(v); return s?.startsWith('pk_') ? s : undefined; }),
  AUTH_GOOGLE_ID: optStr,
  AUTH_GOOGLE_SECRET: optStr,
  ADMIN_ALERT_EMAIL: optEmail
});

// Resolved on access, not at module load: module scope runs before any
// Cloudflare request context exists, so a dashboard/secret ADMIN_ALERT_EMAIL
// was invisible here and every alert silently went to the default address.
export function getAdminEmail(): string {
  return readRuntimeEnv('ADMIN_ALERT_EMAIL') ?? 'admin@ihype.org';
}

/** @deprecated Prefer getAdminEmail() — this is fixed at module-load time. */
export const ADMIN_EMAIL = process.env.ADMIN_ALERT_EMAIL ?? 'admin@ihype.org';

type Env = z.infer<typeof envSchema>;

// Lazy singleton — validates only on first access, not at build time.
let _env: Env | undefined;

export const env = new Proxy({} as Env, {
  get(_target, prop: string) {
    if (!_env) {
      // Source is process.env overlaid with the Cloudflare Worker env, because
      // Worker *secrets* (RESEND_API_KEY, STRIPE_SECRET_KEY, AUTH_SECRET…)
      // never appear on process.env in workerd. Parsing process.env alone made
      // every secret-backed subsystem report itself unconfigured — which is
      // how transactional email silently stopped sending for 35 days while
      // every cron job still returned 200.
      const source = runtimeEnvSource();
      let parsed: Env;
      try {
        parsed = envSchema.parse(source);
      } catch (e) {
        log.error('[env]', e instanceof Error ? e : { error: String(e) }, 'Invalid server configuration');
        throw new Error('Server misconfiguration.');
      }

      // Only memoise once the Worker env was actually readable. The first
      // access can happen at module init or during the build, before any
      // request context exists — caching that snapshot would pin every secret
      // to undefined for the whole isolate, long after they became available.
      if (hasRuntimeEnvContext()) {
        _env = parsed;
      }
      return parsed[prop as keyof Env];
    }
    return _env[prop as keyof Env];
  },
});
