import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(16),
  AUTH_URL: z.string().url().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  OPENAI_API_KEY: z.string().min(1).optional(),
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_SECURE: z.string().min(1).optional(),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASSWORD: z.string().min(1).optional(),
  SMTP_FROM: z.string().email().optional(),
  EMAIL_FROM: z.string().email().optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  MUX_TOKEN_ID: z.string().optional(),
  MUX_TOKEN_SECRET: z.string().optional(),
  MUX_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().startsWith('sk_').optional(),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_').optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().startsWith('pk_').optional(),
  AUTH_GOOGLE_ID: z.string().min(1).optional(),
  AUTH_GOOGLE_SECRET: z.string().min(1).optional()
});

type Env = z.infer<typeof envSchema>;

// Lazy singleton — validates only on first access, not at build time.
let _env: Env | undefined;

export const env = new Proxy({} as Env, {
  get(_target, prop: string) {
    if (!_env) _env = envSchema.parse(process.env);
    return _env[prop as keyof Env];
  },
});
