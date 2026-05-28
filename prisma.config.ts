import 'dotenv/config'
import { defineConfig } from 'prisma/config'

const PLACEHOLDER_DATABASE_URL = 'postgresql://placeholder:placeholder@localhost:5432/placeholder'
const DATABASE_URL_CANDIDATES = [
  'DATABASE_URL',
  'DIRECT_DATABASE_URL',
  'DATABASE_DIRECT_URL',
  'DATABASE_URL_UNPOOLED',
  'POSTGRES_URL',
  'POSTGRES_PRISMA_URL',
  'POSTGRES_URL_NON_POOLING',
  'POSTGRES_URL_NO_SSL',
  'DATABASE_URL_POSTGRES_URL',
  'DATABASE_URL_POSTGRES_PRISMA_URL',
  'DATABASE_URL_POSTGRES_URL_NON_POOLING',
  'DATABASE_URL_POSTGRES_URL_NO_SSL',
] as const

const MIGRATION_DATABASE_URL_CANDIDATES = [
  'DIRECT_URL',
  'DIRECT_DATABASE_URL',
  'DATABASE_DIRECT_URL',
  'DATABASE_URL_UNPOOLED',
  'POSTGRES_URL_NON_POOLING',
  'DATABASE_URL_POSTGRES_URL_NON_POOLING',
  ...DATABASE_URL_CANDIDATES,
] as const

function isPostgresUrl(url: string) {
  return url.startsWith('postgresql://') || url.startsWith('postgres://')
}

function isPrismaMigrationCommand() {
  return process.argv.includes('migrate')
}

function resolvePostgresUrl(candidates: readonly string[]) {
  for (const key of candidates) {
    const value = process.env[key]?.trim()
    if (value && isPostgresUrl(value)) {
      return value
    }
  }

  return null
}

// Normalise DATABASE_URL to a postgresql:// URL so Prisma schema validation passes.
// A prisma:// Accelerate URL is rejected by the postgresql provider at validate time.
const postgresUrl = resolvePostgresUrl(
  isPrismaMigrationCommand() ? MIGRATION_DATABASE_URL_CANDIDATES : DATABASE_URL_CANDIDATES
)
if (postgresUrl) {
  process.env.DATABASE_URL = postgresUrl
} else if (!isPostgresUrl(process.env.DATABASE_URL ?? '')) {
  // No usable postgres URL found — set a placeholder so prisma generate can run.
  // The app will fail at runtime until DATABASE_URL is configured with a real database.
  process.env.DATABASE_URL = PLACEHOLDER_DATABASE_URL
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
})
