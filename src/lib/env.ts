import { z } from 'zod';
import { hasRuntimeEnvContext, runtimeEnvSource } from '@/lib/runtime-env';
import { log } from '@/lib/logger';

// Treat empty strings the same as undefined for optional env vars.
const blank = (v: string | undefined) => (v && v.length > 0 ? v : undefined);
const optStr = z.string().optional().transform(blank);
const optEmail = z.string().optional().transform(v => {
  const s = blank(v); return s && z.string().email().safeParse(s).success ? s : undefined;
});

/* Only the mailer reads through this proxy (`env.EMAIL_FROM`,
   `env.RESEND_API_KEY`, `env.EMAIL_SINK_URL`); everything else in the app
   reads `readRuntimeEnv()` directly. So a key here is either one of those
   three or a VALIDATION that fails the first mail send loudly when the two
   secrets nothing can run without are missing. Until 2026-09-14 the schema
   also declared an OpenAI key, six SMTP settings, a Stripe publishable key and
   Google OAuth credentials — none read by anything, and every one of them a
   claim in `.env.example` about a mailer, an AI vendor and a login method this
   product does not have. `env-example.test.ts` refuses a key here that nothing
   reads. */
const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(16),
  EMAIL_FROM: optEmail,
  RESEND_API_KEY: optStr,
  /* Test-only mail sink. When set to a LOOPBACK URL the mailer posts every
     email there instead of Resend, so the acceptance walk can read back what
     would have left the building. Any non-loopback value is ignored — see
     `emailSinkUrl()` in mailer.ts. */
  EMAIL_SINK_URL: optStr,
  // Video-provider configuration is intentionally absent: iHYPE hosts audio only.
});

/** The single mailbox every operational alert reaches. */
export const ADMIN_ALERT_ADDRESS = 'admin@ihype.org';

/**
 * The address every operational alert goes to.
 *
 * ONE ADDRESS, PINNED, NOT CONFIGURABLE (2026-09-15, owner: "send all emails
 * to admin@ihype.org always"). This used to read a comma-separated
 * `ADMIN_ALERT_EMAIL` and fall back to this address, so an environment value
 * could redirect every alert in the product — 32 call sites: cron failures,
 * the DMCA queue, access requests, payout alerts, a show cancellation. The
 * variable is gone from `.env.example` and from `check:alpha` in the same
 * change, because a name an operator is told to set and nothing reads is the
 * defect `env-example.test.ts` exists to catch.
 *
 * WHAT THIS GIVES UP, stated because the old docstring argued the other way
 * and a later reader will meet that argument first: the override existed so
 * alerts were "not a bus factor of one" and so a second recipient could be
 * added without touching call sites. That is a real cost and the owner's
 * instruction outranks it — alpha runs one operational mailbox. Adding a
 * second recipient is a code change here, deliberately, the same shape as
 * `admin-allowlist.ts` making a second administrator a code change.
 *
 * NOT the same list as `DEFAULT_ADMIN_EMAILS` in `src/lib/admin-allowlist.ts`,
 * which is who may HOLD the admin role and names `staff@ihype.org` too. Who
 * may sign in and who gets paged are different questions; do not merge them.
 */
export function getAdminAlertRecipients(): string[] {
  return [ADMIN_ALERT_ADDRESS];
}

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
