import { randomUUID } from 'node:crypto';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const { Client } = pg;

const confirm = process.env.CONFIRM_RESET_TEST_LOGINS;
const password = process.env.RESET_LOGIN_PASSWORD;
const connectionString = process.env.DATABASE_URL;

if (process.env.NODE_ENV === 'production' && confirm !== 'reset test logins') {
  throw new Error('Refusing production login reset without CONFIRM_RESET_TEST_LOGINS="reset test logins".');
}

if (!connectionString) {
  throw new Error('DATABASE_URL is required.');
}

if (!password || password.length < 12) {
  throw new Error('RESET_LOGIN_PASSWORD must be at least 12 characters.');
}

const users = [
  { email: 'admin@ihype.org', username: 'admin', name: 'iHYPE Admin', role: 'ADMIN' },
  { email: 'artist@ihype.org', username: 'artist', name: 'Nova Pulse', role: 'ARTIST' },
  { email: 'venue@ihype.org', username: 'venue', name: 'Venue Owner', role: 'VENUE' },
  { email: 'promoter@ihype.org', username: 'promoter', name: 'DJ Echo', role: 'DJ' },
  { email: 'fan@ihype.org', username: 'fan', name: 'Night Owl', role: 'FAN' }
];

const profiles = [
  { username: 'artist', slug: 'artist', hexId: '0xreset000000000000000000000000000001', type: 'ARTIST', name: 'Nova Pulse' },
  { username: 'venue', slug: 'venue', hexId: '0xreset000000000000000000000000000002', type: 'VENUE', name: 'Venue Owner' },
  { username: 'promoter', slug: 'promoter', hexId: '0xreset000000000000000000000000000003', type: 'DJ', name: 'DJ Echo' },
  { username: 'fan', slug: 'fan', hexId: '0xreset000000000000000000000000000004', type: 'LISTENER', name: 'Night Owl' }
];

const client = new Client({ connectionString });

async function upsertTestUsersIfEmpty(existingCount) {
  if (existingCount > 0) return;

  for (const user of users) {
    await client.query(
      `INSERT INTO "User" ("id", "email", "username", "name", "role", "isThirteenOrOlder", "emailVerified", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5::"Role", true, NOW(), NOW(), NOW())
       ON CONFLICT ("username") DO UPDATE SET
         "email" = EXCLUDED."email",
         "name" = EXCLUDED."name",
         "role" = EXCLUDED."role",
         "isThirteenOrOlder" = true,
         "emailVerified" = NOW(),
         "updatedAt" = NOW()`,
      [randomUUID(), user.email, user.username, user.name, user.role]
    );
  }

  for (const profile of profiles) {
    const owner = await client.query('SELECT "id" FROM "User" WHERE "username" = $1 LIMIT 1', [profile.username]);
    const ownerId = owner.rows[0]?.id;
    if (!ownerId) throw new Error(`Missing owner for ${profile.username}`);

    await client.query(
      `INSERT INTO "Profile" ("id", "slug", "hexId", "type", "name", "headline", "genres", "genre", "verified", "isVerified", "ownerId", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4::"ProfileType", $5, 'Test account', $6::text[], 'Test', true, true, $7, NOW(), NOW())
       ON CONFLICT ("slug") DO UPDATE SET
         "ownerId" = EXCLUDED."ownerId",
         "name" = EXCLUDED."name",
         "type" = EXCLUDED."type",
         "genres" = EXCLUDED."genres",
         "genre" = EXCLUDED."genre",
         "verified" = true,
         "isVerified" = true,
         "updatedAt" = NOW()`,
      [randomUUID(), profile.slug, profile.hexId, profile.type, profile.name, ['Test'], ownerId]
    );
  }
}

async function main() {
  await client.connect();
  const passwordHash = await bcrypt.hash(password, 10);

  try {
    await client.query('BEGIN');
    const countResult = await client.query('SELECT COUNT(*)::int AS count FROM "User"');
    const beforeCount = countResult.rows[0].count;

    await upsertTestUsersIfEmpty(beforeCount);

    await client.query('DELETE FROM "Session"');
    await client.query('DELETE FROM "MfaChallenge"');
    await client.query('DELETE FROM "PasswordResetCode"');
    await client.query('DELETE FROM "MagicLinkToken"');
    await client.query('DELETE FROM "Passkey"');
    await client.query(
      `UPDATE "User" SET
        "passwordHash" = $1,
        "emailVerified" = NOW(),
        "mfaSecret" = NULL,
        "mfaEnabledAt" = NULL,
        "mfaBackupCodes" = NULL,
        "emailBounced" = false,
        "updatedAt" = NOW()`,
      [passwordHash]
    );

    const afterUsers = await client.query(
      'SELECT "username", "email", "role" FROM "User" ORDER BY "username" ASC'
    );

    await client.query('COMMIT');

    console.log(`Reset login state for ${afterUsers.rows.length} users. Initial user count was ${beforeCount}.`);
    console.log(afterUsers.rows.map((user) => `${user.username} <${user.email ?? 'no-email'}> ${user.role}`).join('\n'));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
