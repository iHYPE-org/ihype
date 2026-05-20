import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaNeonHttp } from '@prisma/adapter-neon';

function getConnectionString(): string {
  return process.env.DATABASE_URL ?? '';
}

// Lazy singleton — not created at module load time because process.env is only
// populated after the first request arrives (opennextjs populateProcessEnv).
// Re-created if the connection string changes between invocations.
let _prisma: PrismaClient | undefined;
let _cs: string | undefined;

function getPrisma(): PrismaClient {
  const cs = getConnectionString();
  if (!_prisma || cs !== _cs) {
    _cs = cs;
    const adapter = new PrismaNeonHttp(cs, {});
    _prisma = new PrismaClient({ adapter });
  }
  return _prisma;
}

// Proxy so callers can keep using `db.user.findMany(...)` etc. unchanged,
// while actual initialization is deferred until first access.
export const db = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    return Reflect.get(getPrisma(), prop, getPrisma());
  },
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
