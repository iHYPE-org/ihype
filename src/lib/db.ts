import { Prisma, PrismaClient } from '@prisma/client/wasm';
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
  normalizeRuntimeDatabaseUrl();
  return readRuntimeEnv('DATABASE_URL');
}

function makePrisma(url: string) {
  const adapter = new PrismaPg({
    connectionString: url,
    // Fail fast instead of hanging the Worker until Cloudflare's 30s timeout fires.
    connectionTimeoutMillis: 8000,
    // Each Worker invocation handles one request; one connection is enough.
    max: 1,
    idleTimeoutMillis: 10000,
  });
  // Fail loudly when a query hangs — Cloudflare Workers have a 60s wall-clock
  // limit and a hung query would silently consume it. 25s leaves enough headroom.
  const client = new PrismaClient({ adapter }).$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const start = Date.now();
          const timeout = new Promise<never>((_, reject) =>
            setTimeout(() => {
              const err = new Error('DB query timeout after 25s');
              log.error('[db]', err, `Query timed out: ${model}.${operation}`);
              reject(err);
            }, 25_000)
          );
          const result = await Promise.race([query(args), timeout]);
          const elapsed = Date.now() - start;
          if (elapsed > 1000) {
            log.warn('[db]', { model, operation, elapsedMs: elapsed }, 'Slow query');
          }
          return result;
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
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === 'P5010' || error.message.includes('fetch failed'))
  );
}

export async function withDbRetry<T>(operation: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!isRetryablePrismaError(error) || attempt === attempts) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, attempt * 150));
    }
  }

  throw lastError;
}
