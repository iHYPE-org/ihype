/**
 * Runtime environment access that works for Cloudflare Worker **secrets**.
 *
 * Why this exists
 * ---------------
 * On workerd, `process.env` carries what the build and `wrangler.toml [vars]`
 * put there. Worker *secrets* (`wrangler secret put`) are not on `process.env`
 * at all — they arrive on the Cloudflare env binding, reachable only through
 * `getCloudflareContext()` and only inside a request context.
 *
 * Every module in this codebase that needed a secret at runtime discovered
 * that separately and grew its own fallback: `src/lib/db.ts` (DATABASE_URL),
 * `src/lib/cron-auth.ts` (CRON_SECRET), plus `r2.ts`/`ai.ts`/`analytics.ts`
 * which read bindings directly. The modules that never grew one —
 * `src/lib/env.ts` and `src/lib/payments.ts` — are exactly the ones that
 * report their subsystem as "not configured" in production: transactional
 * email and Stripe. That is not a coincidence, it is the same missing lookup.
 *
 * Reading through here is purely additive: a value already present in
 * `process.env` always wins, so nothing that works today can start failing.
 */

type ContextReader = () => Record<string, unknown> | null;

function defaultContextReader(): Record<string, unknown> | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getCloudflareContext } = require('@opennextjs/cloudflare');
    const ctx = getCloudflareContext();
    const env = ctx?.env as Record<string, unknown> | undefined;
    return env ?? null;
  } catch {
    // No request context (module init, build, tests, plain Node) — the
    // binding simply is not reachable from here.
    return null;
  }
}

// The reader is indirected purely so tests can simulate a Worker env. The
// lookup itself is a synchronous require() (matching db.ts and cron-auth.ts),
// which vitest cannot intercept, and the behaviour worth pinning down —
// "a secret that exists only on the Cloudflare binding is found" — is
// otherwise untestable.
let contextReader: ContextReader = defaultContextReader;

/** Test-only seam. Pass null to restore the real Cloudflare lookup. */
export function setContextReaderForTests(reader: ContextReader | null): void {
  contextReader = reader ?? defaultContextReader;
}

function readCloudflareEnvObject(): Record<string, unknown> | null {
  return contextReader();
}

/** True when a Cloudflare request context is available, i.e. secrets are visible. */
export function hasRuntimeEnvContext(): boolean {
  return readCloudflareEnvObject() !== null;
}

/** One variable, preferring process.env and falling back to the Worker env. */
export function readRuntimeEnv(name: string): string | undefined {
  const fromProcess = process.env[name]?.trim();
  if (fromProcess) return fromProcess;
  const value = readCloudflareEnvObject()?.[name];
  return typeof value === 'string' ? value.trim() || undefined : undefined;
}

/**
 * `process.env` overlaid with any string values from the Worker env.
 *
 * Non-string entries are dropped on purpose: the Cloudflare env also holds
 * bindings (KV namespace, R2 bucket, Durable Object namespace, AI), and
 * handing those to a zod string schema would turn a working deploy into a
 * hard "Server misconfiguration" throw.
 */
export function runtimeEnvSource(): Record<string, string | undefined> {
  const merged: Record<string, string | undefined> = { ...process.env };
  const cloudflare = readCloudflareEnvObject();
  if (!cloudflare) return merged;

  for (const [key, value] of Object.entries(cloudflare)) {
    if (typeof value !== 'string') continue;
    const existing = merged[key]?.trim();
    if (!existing) merged[key] = value;
  }
  return merged;
}
