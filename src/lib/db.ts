// Prisma 7 removed the '/wasm' entrypoint this file used to import. The
// plain '@prisma/client' entry is NOT a safe replacement: its conditional
// exports list the "node" condition before "workerd", and OpenNext's
// bundler activates both simultaneously, so plain '@prisma/client' silently
// resolves to the Node-only query engine in a Workers build (no `path`
// module, no native engine) — this exact class of bug caused the outage
// documented in src/lib/__tests__/prisma-workerd-config.test.ts, one
// directory level up from where it originally happened. '/edge' is the new
// explicit, unconditional subpath that always resolves to the wasm/workerd
// build regardless of condition ordering.
import { Prisma, PrismaClient } from '@prisma/client/edge';
import { PrismaPg } from '@prisma/adapter-pg';
import { log } from '@/lib/logger';

const RUNTIME_POSTGRES_URL_CANDIDATES = [
  'POSTGRES_PRISMA_URL',
  'DATABASE_URL_POSTGRES_PRISMA_URL',
  'POSTGRES_URL',
  'DATABASE_URL_POSTGRES_URL',
  'DIRECT_DATABASE_URL',
  'DATABASE_DIRECT_URL',
  'DATABASE_URL_UNPOOLED',
  'POSTGRES_URL_NON_POOLING',
  'DATABASE_URL_POSTGRES_URL_NON_POOLING',
  'POSTGRES_URL_NO_SSL',
  'DATABASE_URL_POSTGRES_URL_NO_SSL'
] as const;

function isPostgresUrl(url: string | undefined) {
  return Boolean(url?.startsWith('postgresql://') || url?.startsWith('postgres://'));
}

function readCloudflareEnv(name: string): string | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getCloudflareContext } = require('@opennextjs/cloudflare');
    const ctx = getCloudflareContext();
    const value = (ctx.env as Record<string, unknown>)[name];
    return typeof value === 'string' ? value.trim() : undefined;
  } catch {
    return undefined;
  }
}

function hasCloudflareContext() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getCloudflareContext } = require('@opennextjs/cloudflare');
    getCloudflareContext();
    return true;
  } catch {
    return false;
  }
}

function readRuntimeEnv(name: string): string | undefined {
  return process.env[name]?.trim() || readCloudflareEnv(name);
}

function readHyperdriveConnectionString(): string | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getCloudflareContext } = require('@opennextjs/cloudflare');
    const ctx = getCloudflareContext();
    const hyperdrive = (ctx.env as Record<string, unknown>).HYPERDRIVE as
      | { connectionString?: unknown }
      | undefined;
    const value = hyperdrive?.connectionString;
    return typeof value === 'string' && isPostgresUrl(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

function normalizeRuntimeDatabaseUrl() {
  const databaseUrl = readRuntimeEnv('DATABASE_URL');
  if (isPostgresUrl(databaseUrl)) {
    process.env.DATABASE_URL = databaseUrl;
    return;
  }

  for (const key of RUNTIME_POSTGRES_URL_CANDIDATES) {
    const value = readRuntimeEnv(key);
    if (isPostgresUrl(value)) {
      process.env.DATABASE_URL = value;
      return;
    }
  }
}

function getConnectionString() {
  // Prefer Hyperdrive on Workers: it pools connections at Cloudflare's edge
  // instead of dialing Postgres directly on every invocation.
  const hyperdrive = readHyperdriveConnectionString();
  if (hyperdrive) {
    return hyperdrive;
  }

  normalizeRuntimeDatabaseUrl();
  return readRuntimeEnv('DATABASE_URL');
}

function makePrisma(url: string) {
  /* Under the e2e harness only (scripts/e2e-workerd.mjs passes
     --var E2E_HARNESS:1), destroy each pg connection after a single use.

     Why this exists, all of it measured on 2026-08-27: workerd requires one
     PrismaClient per request (a shared client draws "Cannot perform I/O on
     behalf of a different request" — 396 of them when tried), and each client
     retains ~10 MB in a LONG-LIVED dev server, because the pool's idle timer
     belongs to a request context that has ended and never fires, so the socket
     — and through it the client and its wasm engine — is never released. At
     ~200 requests per shard that reaches workerd's ~1.4 GB isolate ceiling and
     the server aborts mid-suite, failing whichever test happened to be running
     (the "different flaky test every run" that ate three rounds of locator
     fixes). `maxUses: 1` destroys the connection at release, which happens
     IN-request where I/O is still legal; measured, it halves per-client
     retention and took the shard from crash-and-restart to clean.

     Gated to the harness because production pays the cost differently: there
     an isolate serves one request and dies, so nothing accumulates — but
     maxUses would make every QUERY redial, and a 15-query page would pay 15
     handshakes for a problem production does not have. */
  const singleUse = readRuntimeEnv('E2E_HARNESS') === '1';
  const adapter = new PrismaPg({
    connectionString: url,
    // Fail fast instead of hanging the Worker until Cloudflare's 30s timeout fires.
    connectionTimeoutMillis: 8000,
    // Each Worker invocation handles one request; one connection is enough.
    max: 1,
    idleTimeoutMillis: 10000,
    ...(singleUse ? { maxUses: 1 } : {}),
  });
  // Fail loudly when a query hangs — Cloudflare Workers have a 60s wall-clock
  // limit and a hung query would silently consume it. 25s leaves enough headroom.
  const client = new PrismaClient({ adapter }).$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const start = Date.now();
          /* CLEAR THE TIMER. `Promise.race` settles as soon as the query wins,
             but it does not cancel the loser — so without the `finally` below
             every single query left a live 25-second timeout behind, each one
             pinning a closure over `model`, `operation` and `args`.

             In production that is invisible: a Worker invocation is short and
             the isolate is torn down long before the timers matter. In a
             long-lived process it is a leak with no ceiling, and it is what
             killed the authenticated e2e shard — measured 2026-08-26, the
             wrangler dev server climbed to 1393 MB, spent 95% of its time in
             GC (`average mu = 0.046`), dragged User.findUnique out to 2s, and
             aborted on signal 6 mid-suite. The tests that happened to be
             running when it died failed on whatever their assertion was, which
             is why the "flaky" test was a different one every run. */
          let timer: ReturnType<typeof setTimeout> | undefined;
          const timeout = new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
              const err = new Error('DB query timeout after 25s');
              log.error('[db]', err, `Query timed out: ${model}.${operation}`);
              reject(err);
            }, 25_000);
          });
          try {
            const result = await Promise.race([query(args), timeout]);
            const elapsed = Date.now() - start;
            if (elapsed > 1000) {
              log.warn('[db]', { model, operation, elapsedMs: elapsed }, 'Slow query');
            }
            return result;
          } finally {
            if (timer) clearTimeout(timer);
          }
        },
      },
    },
  });

  return client;
}

type DbClient = ReturnType<typeof makePrisma>;

const globalForPrisma = globalThis as unknown as {
  prisma?: DbClient;
  prismaConnectionString?: string;
};

// Cache one PrismaClient per CF request so all db.* calls within the same
// request share a single connection rather than each spawning their own.
const cfRequestCache = new WeakMap<object, DbClient>();

function getDb() {
  const url = getConnectionString();
  if (!url) {
    throw new Error('A direct Postgres DATABASE_URL is required for Prisma');
  }

  if (hasCloudflareContext()) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getCloudflareContext } = require('@opennextjs/cloudflare');
      const ctx = getCloudflareContext() as object;
      let client = cfRequestCache.get(ctx);
      if (!client) {
        client = makePrisma(url);
        cfRequestCache.set(ctx, client);
      }
      return client;
    } catch {
      return makePrisma(url);
    }
  }

  if (!globalForPrisma.prisma || globalForPrisma.prismaConnectionString !== url) {
    globalForPrisma.prisma = makePrisma(url);
    globalForPrisma.prismaConnectionString = url;
  }

  return globalForPrisma.prisma;
}

export const db = new Proxy({} as DbClient, {
  get(_target, prop, receiver) {
    const client = getDb();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === 'function' ? value.bind(client) : value;
  }
});

function isRetryablePrismaError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === 'P5010' || error.message.includes('fetch failed');
  }
  // PrismaClientInitializationError covers cold-start TCP timeouts (P1017, P1001, etc.)
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }
  // Raw pg pool / Node network errors that escape Prisma's wrapper
  if (error instanceof Error) {
    const msg = error.message;
    return (
      msg.includes('fetch failed') ||
      msg.includes('connect ETIMEDOUT') ||
      msg.includes('connect timeout') ||
      msg.includes('Connection terminated') ||
      msg.includes('ECONNREFUSED') ||
      msg.includes('ECONNRESET') ||
      msg.includes('Server has closed the connection') ||
      msg.includes("Can't reach database") ||
      msg.includes('Connection pool timeout') ||
      msg.includes('DB query timeout')
    );
  }
  return false;
}

export async function withDbRetry<T>(operation: () => Promise<T>, attempts = 5): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!isRetryablePrismaError(error) || attempt === attempts) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, attempt * 300));
    }
  }

  throw lastError;
}
