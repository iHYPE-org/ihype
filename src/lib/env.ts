import { z } from 'zod';

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
  AUTH_GOOGLE_SECRET: optStr
});

type Env = z.infer<typeof envSchema>;

// Lazy singleton — validates only on first access, not at build time.
let _env: Env | undefined;

export const env = new Proxy({} as Env, {
  get(_target, prop: string) {
    if (!_env) {
      try {
        _env = envSchema.parse(process.env);
      } catch (e) {
        console.error('[env] Invalid server configuration:', e);
        throw new Error('Server misconfiguration.');
      }
    }
    return _env[prop as keyof Env];
  },
});
