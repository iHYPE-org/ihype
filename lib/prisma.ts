// Standalone PrismaClient singleton for Node.js scripts and local tooling
// (seeding, verification, one-off jobs) talking to the database named by
// DATABASE_URL via the pg driver adapter.
//
// NOTE: the deployed app does NOT use this file. Application code must keep
// importing { db } from '@/lib/db' — that client is Cloudflare Workers-safe
// (WASM engine, Hyperdrive pooling, per-request caching, query timeouts).
// Never import this module from browser/client components.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required (set it in .env).');
}

const adapter = new PrismaPg({ connectionString });

const globalForPrisma = globalThis as unknown as { prismaNode?: PrismaClient };

export const prisma = globalForPrisma.prismaNode ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prismaNode = prisma;
}
