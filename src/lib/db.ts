import { Prisma, PrismaClient } from '@prisma/client';
import { withAccelerate } from '@prisma/extension-accelerate';

function getConnectionString(): string | undefined {
  try {
    // Dynamic import so this only runs at runtime, not during Next.js build
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getCloudflareContext } = require('@opennextjs/cloudflare');
    const ctx = getCloudflareContext();
    const hyperdrive = (ctx.env as Record<string, unknown>).HYPERDRIVE as
      | { connectionString: string }
      | undefined;
    if (hyperdrive?.connectionString) return hyperdrive.connectionString;
  } catch {
    // Not in a CF Workers context (local dev / Next.js build) — fall through
  }
  return process.env.DATABASE_URL;
}

function makePrisma() {
  const url = getConnectionString();
  return new PrismaClient({ datasources: url ? { db: { url } } : undefined }).$extends(
    withAccelerate()
  );
}

const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof makePrisma>;
};

export const db = globalForPrisma.prisma ?? makePrisma();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}

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
