/**
 * Does the seat count hold when everybody arrives at once?
 *
 * WHY THIS EXISTS. Every other instrument here reads the code: whether a class
 * is named right, whether a path resolves, whether a claim matches the product.
 * None of them can answer "does this oversell under load", because overselling
 * is a property of concurrent transactions against a real Postgres and is
 * invisible in a diff. Until this script there was no k6, artillery, autocannon
 * or soak harness anywhere in the repository, so every statement about the app
 * under a real on-sale was read off the source rather than measured — which is
 * exactly the gap that let the reservation-expiry cron release seats it had not
 * voided (DESIGN_SYNC row 492) while every test passed.
 *
 * WHAT IT DRIVES. `reserveShowInventory` and `releaseShowInventory` from
 * `src/lib/ticket-inventory.ts` — the product's own functions, imported, never
 * a copy. A harness that reimplements the rule measures the harness; this
 * repository has that lesson written down twice already (the two measurement
 * harnesses that hand-restated a token table and drifted).
 *
 * WHAT IT DOES NOT PROVE. It does not drive HTTP, Stripe, auth or the Worker
 * runtime, so it says nothing about request throughput, CPU limits or
 * Hyperdrive pooling. It measures ONE invariant, the one with money attached:
 * a show never sells a seat it does not have, and never loses one it does.
 *
 *   npm run probe:concurrency
 *   PROBE_DATABASE_URL=postgresql://… npm run probe:concurrency
 *
 * Exit 0 every invariant held · 1 an invariant broke · 2 could not run.
 * It BLOCKS rather than passing when there is no database: a green run over a
 * probe that never connected is the one outcome worse than a red one.
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { randomUUID } from 'node:crypto';
import { reserveShowInventory, releaseShowInventory } from '../src/lib/ticket-inventory';

const DATABASE_URL =
  process.env.PROBE_DATABASE_URL || process.env.E2E_WORKERD_DATABASE_URL || process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('BLOCKED — set PROBE_DATABASE_URL (or DATABASE_URL) to a SCRATCH Postgres.');
  console.error('This probe writes rows and is never pointed at production.');
  process.exit(2);
}
if (/supabase\.(co|com)|ihype\.org/i.test(DATABASE_URL)) {
  console.error('BLOCKED — that looks like a managed/production database. Use a scratch one.');
  process.exit(2);
}

// Enough connections that the fan-out is genuinely simultaneous rather than
// serialised by the pool — a probe that queues its own requests measures
// nothing about concurrency.
const POOL = 32;
const url = DATABASE_URL.includes('?')
  ? `${DATABASE_URL}&connection_limit=${POOL}`
  : `${DATABASE_URL}?connection_limit=${POOL}`;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

type Failure = { scenario: string; detail: string };
const failures: Failure[] = [];
let attempts = 0;

function check(scenario: string, ok: boolean, detail: string) {
  if (!ok) failures.push({ scenario, detail });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${detail}`);
}

let creatorId: string | null = null;

/** One throwaway organiser for every show the probe seeds. */
async function ensureCreator() {
  if (creatorId) return creatorId;
  const user = await prisma.user.create({
    data: { username: `probe_${randomUUID().slice(0, 8)}`, email: `probe_${randomUUID()}@example.com` },
  });
  creatorId = user.id;
  return creatorId;
}

async function seedShow(capacity: number | null) {
  const id = `probe_${randomUUID()}`;
  await prisma.show.create({
    data: {
      id,
      creatorId: await ensureCreator(),
      slug: id,
      title: 'Concurrency probe',
      description: 'Seeded by scripts/concurrency-probe.mts',
      startsAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      status: 'SCHEDULED',
      isTicketed: true,
      ticketCapacity: capacity,
      ticketsSoldCount: 0,
      ticketPriceCents: 1000,
    },
  });
  return id;
}

const soldCount = async (showId: string) =>
  (await prisma.show.findUniqueOrThrow({ where: { id: showId }, select: { ticketsSoldCount: true } }))
    .ticketsSoldCount;

/** One reservation, in its own transaction, exactly as the purchase route does it. */
async function attemptReserve(showId: string, quantity: number, ticketCapacity: number | null) {
  attempts += 1;
  return prisma.$transaction((tx) => reserveShowInventory(tx, { showId, quantity, ticketCapacity }));
}

async function scenarioSingleSeatStampede() {
  console.log('\n1. 40 buyers, 1 seat each, capacity 10');
  const CAPACITY = 10;
  const BUYERS = 40;
  const showId = await seedShow(CAPACITY);

  const granted = (
    await Promise.all(Array.from({ length: BUYERS }, () => attemptReserve(showId, 1, CAPACITY)))
  ).filter(Boolean).length;

  const sold = await soldCount(showId);
  check('stampede', granted === CAPACITY, `${granted} of ${BUYERS} granted, expected exactly ${CAPACITY}`);
  check('stampede', sold === CAPACITY, `ticketsSoldCount ${sold}, expected ${CAPACITY}`);
}

async function scenarioMixedQuantities() {
  console.log('\n2. 24 buyers, 1-4 seats each, capacity 10');
  const CAPACITY = 10;
  const showId = await seedShow(CAPACITY);
  // Deterministic sizes — no Math.random, so a failure reproduces.
  const sizes = Array.from({ length: 24 }, (_, i) => (i % 4) + 1);

  const results = await Promise.all(sizes.map((q) => attemptReserve(showId, q, CAPACITY)));
  const seatsGranted = sizes.reduce((sum, q, i) => sum + (results[i] ? q : 0), 0);

  const sold = await soldCount(showId);
  check('mixed', seatsGranted <= CAPACITY, `granted ${seatsGranted} seat(s), capacity ${CAPACITY}`);
  check('mixed', sold === seatsGranted, `ticketsSoldCount ${sold} agrees with ${seatsGranted} granted`);
}

async function scenarioReserveAndReleaseStorm() {
  console.log('\n3. reserves and releases interleaved, capacity 10');
  const CAPACITY = 10;
  const showId = await seedShow(CAPACITY);

  // Fill it, then fire 20 reserves and 20 releases at the same row at once.
  await Promise.all(Array.from({ length: CAPACITY }, () => attemptReserve(showId, 1, CAPACITY)));

  const mixed = await Promise.all([
    ...Array.from({ length: 20 }, () => attemptReserve(showId, 1, CAPACITY).then((ok) => ({ kind: 'take' as const, ok }))),
    ...Array.from({ length: 20 }, () =>
      prisma
        .$transaction((tx) => releaseShowInventory(tx, { showId, seats: 1 }))
        .then((ok) => ({ kind: 'give' as const, ok })),
    ),
  ]);

  const taken = mixed.filter((r) => r.kind === 'take' && r.ok).length;
  const given = mixed.filter((r) => r.kind === 'give' && r.ok).length;
  const sold = await soldCount(showId);

  check('storm', sold === CAPACITY + taken - given, `ticketsSoldCount ${sold} = ${CAPACITY} + ${taken} taken - ${given} given`);
  check('storm', sold >= 0, `ticketsSoldCount ${sold} never went negative`);
  check('storm', sold <= CAPACITY, `ticketsSoldCount ${sold} never exceeded capacity ${CAPACITY}`);
}

async function scenarioReleaseFloor() {
  console.log('\n4. releases racing an empty show');
  const showId = await seedShow(10);
  await attemptReserve(showId, 1, 10);

  // Ten concurrent releases against a single held seat: exactly one may win,
  // and the rest must refuse rather than write a negative count that
  // reserveShowInventory would then read as room.
  const results = await Promise.all(
    Array.from({ length: 10 }, () => prisma.$transaction((tx) => releaseShowInventory(tx, { showId, seats: 1 }))),
  );
  const sold = await soldCount(showId);
  check('floor', results.filter(Boolean).length === 1, `${results.filter(Boolean).length} of 10 releases applied, expected 1`);
  check('floor', sold === 0, `ticketsSoldCount ${sold}, expected 0`);
}

async function scenarioUncapped() {
  console.log('\n5. an uncapped show is not a zero-capacity show');
  const showId = await seedShow(null);
  const granted = (
    await Promise.all(Array.from({ length: 20 }, () => attemptReserve(showId, 2, null)))
  ).filter(Boolean).length;
  const sold = await soldCount(showId);
  check('uncapped', granted === 20, `${granted} of 20 granted on a null capacity`);
  check('uncapped', sold === 40, `ticketsSoldCount ${sold}, expected 40`);
}

async function main() {
  console.log('Concurrency probe — ticket inventory under simultaneous writers');
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    console.error(`BLOCKED — could not reach the database: ${(error as Error).message}`);
    process.exit(2);
  }

  await scenarioSingleSeatStampede();
  await scenarioMixedQuantities();
  await scenarioReserveAndReleaseStorm();
  await scenarioReleaseFloor();
  await scenarioUncapped();

  await prisma.show.deleteMany({ where: { slug: { startsWith: 'probe_' } } });
  if (creatorId) await prisma.user.deleteMany({ where: { id: creatorId } });
  await prisma.$disconnect();

  // A zero is EARNED, never assumed: a run that made no attempts is a run that
  // measured nothing, and must not read as a pass.
  const MIN_ATTEMPTS = 100;
  console.log(`\n${attempts} reservation attempt(s) driven against real Postgres.`);
  if (attempts < MIN_ATTEMPTS) {
    console.error(`BLOCKED — only ${attempts} attempts, expected at least ${MIN_ATTEMPTS}. The probe did not run properly.`);
    process.exit(2);
  }

  if (failures.length > 0) {
    console.error(`\nFAILED — ${failures.length} invariant(s) broke:`);
    for (const f of failures) console.error(`  [${f.scenario}] ${f.detail}`);
    process.exit(1);
  }
  console.log('Every invariant held: no show sold a seat it did not have, and none lost one it did.');
}

main().catch(async (error) => {
  console.error(`FAILED — ${(error as Error).stack ?? error}`);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
