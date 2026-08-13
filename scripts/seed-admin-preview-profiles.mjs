#!/usr/bin/env node
/**
 * Gives the admin account an ARTIST profile, a VENUE profile and an
 * advertiser account, so the operator can see every member-facing surface as
 * its own audience sees it.
 *
 * ## Why a script rather than a migration
 *
 * This is DATA, not schema. Migrations in `prisma/migrations/` auto-deploy on
 * every push to main and run against production — putting row inserts there
 * would make them run everywhere, forever, with no way to opt out. This is a
 * one-off an operator runs deliberately, against a database they name.
 *
 *     DATABASE_URL='postgres://…' node scripts/seed-admin-preview-profiles.mjs
 *
 * Idempotent: every write is an upsert keyed on a deterministic slug, so
 * running it twice changes nothing the second time.
 *
 * ## What it does NOT do
 *
 * It does not touch `User.role`. The admin stays ADMIN.
 *
 * That matters for the advertiser half: `Role` is a single field, so an
 * account cannot be ADMIN and ADVERTISER at once. It does not need to be —
 * `/advertise/dashboard` gates on the session and reads `AdvertiserAccount` by
 * `userId`, never on the role — so creating the row is enough to see those
 * surfaces, and nothing about admin access changes.
 *
 * There is no promoter profile, and that is not an omission: `ProfileType` is
 * ARTIST | VENUE | LISTENER. Design System 8 is explicit that promoter is not
 * a role — it is the 10% slice in a split bar — and the DJ type was removed on
 * 2026-08-06.
 */

import { createHash } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * The admin account is `admin@ihype.org` — the same address the brand uses as
 * its only contact. This defaulted to a personal gmail address, which CLAUDE.md
 * also recorded as the admin account; both were wrong, and the guard below is
 * what caught it by refusing to act rather than seeding nothing quietly.
 */
const ADMIN_EMAIL = process.env.ADMIN_PREVIEW_EMAIL || 'admin@ihype.org';

function databaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is required. Point it at the database you mean to seed.');
    process.exit(1);
  }
  return url;
}

/** Deterministic, so re-running upserts the same rows rather than new ones. */
const hexFor = (seed) => `0x${createHash('sha256').update(seed).digest('hex').slice(0, 32)}`;

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl() }) });
  try {
    const admin = await prisma.user.findUnique({
      where: { email: ADMIN_EMAIL },
      select: { id: true, email: true, role: true, name: true },
    });
    if (!admin) {
      console.error(`No user with email ${ADMIN_EMAIL}. Set ADMIN_PREVIEW_EMAIL if it differs.`);
      process.exit(1);
    }
    // Refuse to act on a non-admin: the slugs below are branded "iHYPE", and
    // attaching them to the wrong account is not something a re-run undoes.
    if (admin.role !== 'ADMIN') {
      console.error(`${ADMIN_EMAIL} has role ${admin.role}, not ADMIN. Refusing.`);
      process.exit(1);
    }

    const profiles = [
      {
        type: 'ARTIST',
        slug: 'ihype-preview-artist',
        name: 'iHYPE Preview (Artist)',
        headline: 'Internal preview profile — what an artist page looks like.',
        genres: ['Indie', 'Electronic'],
      },
      {
        type: 'VENUE',
        slug: 'ihype-preview-venue',
        name: 'iHYPE Preview (Venue)',
        headline: 'Internal preview profile — what a venue page looks like.',
        genres: [],
      },
    ];

    for (const profile of profiles) {
      const row = await prisma.profile.upsert({
        where: { slug: profile.slug },
        update: { name: profile.name, headline: profile.headline, ownerId: admin.id },
        create: {
          slug: profile.slug,
          hexId: hexFor(profile.slug),
          name: profile.name,
          headline: profile.headline,
          type: profile.type,
          ownerId: admin.id,
          genres: profile.genres,
          city: 'Portland',
          stateRegion: 'ME',
        },
        select: { id: true, slug: true, type: true },
      });
      console.log(`  ${row.type.padEnd(6)} /${row.type === 'VENUE' ? 'venues' : 'artists'}/${row.slug}`);
    }

    const advertiser = await prisma.advertiserAccount.upsert({
      where: { userId: admin.id },
      update: {},
      create: {
        userId: admin.id,
        companyName: 'iHYPE Preview (Advertiser)',
        contactName: admin.name ?? 'iHYPE Admin',
      },
      select: { companyName: true },
    });
    console.log(`  ADVERT /advertise/dashboard — ${advertiser.companyName}`);

    console.log('\nDone. Role unchanged:', admin.role);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
