// Connectivity smoke test: one read against DATABASE_URL via lib/prisma.ts.
// Run: npx tsx scripts/verify-prisma.ts
import { prisma } from '../lib/prisma';

async function main() {
  const [users, profiles, shows] = await Promise.all([
    prisma.user.count(),
    prisma.profile.count(),
    prisma.show.count(),
  ]);
  console.log(`✅ Connected. users=${users} profiles=${profiles} shows=${shows}`);
}

main()
  .catch((error) => {
    console.error('❌ Prisma verification failed:');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
