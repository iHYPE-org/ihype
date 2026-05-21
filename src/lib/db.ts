import { Prisma, PrismaClient } from '@prisma/client/wasm';
import { PrismaPg } from '@prisma/adapter-pg';

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

function normalizeRuntimeDatabaseUrl() {
  if (isPostgresUrl(process.env.DATABASE_URL)) {
    return;
  }

  for (const key of RUNTIME_POSTGRES_URL_CANDIDATES) {
    const value = process.env[key]?.trim();
    if (isPostgresUrl(value)) {
      process.env.DATABASE_URL = value;
      return;
    }
  }
}

function getHyperdriveConnectionString(): string | undefined {
  try {
    // Dynamic require keeps Cloudflare runtime lookup out of the Next.js build path.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getCloudflareContext } = require('@opennextjs/cloudflare');
    const ctx = getCloudflareContext();
    const hyperdrive = (ctx.env as Record<string, unknown>).HYPERDRIVE as
      | { connectionString: string }
      | undefined;
    return hyperdrive?.connectionString;
  } catch {
    return undefined;
  }
}

function getConnectionString() {
  const hyperdriveUrl = getHyperdriveConnectionString();
  if (hyperdriveUrl) {
    return hyperdriveUrl;
  }

  normalizeRuntimeDatabaseUrl();
  return process.env.DATABASE_URL;
}

function makePrisma(url: string) {
  const adapter = new PrismaPg({ connectionString: url });
  return new PrismaClient({ adapter });
}

type DbClient = ReturnType<typeof makePrisma>;

const globalForPrisma = globalThis as unknown as {
  prisma?: DbClient;
  prismaConnectionString?: string;
};

function getDb() {
  const url = getConnectionString();
  if (!url) {
    throw new Error('DATABASE_URL or Cloudflare Hyperdrive connection string is required for Prisma');
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
