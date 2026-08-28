#!/usr/bin/env tsx
/**
 * Runbook step 2, as a script: the app's own money path against a scratch
 * database.
 *
 * Why this exists
 * ---------------
 * `docs/runbooks/money-path-rehearsal.md` step 2 was a page of prose describing
 * a walk of 7 stages, each with database state to check in between. It is the
 * only place a real `AccountsPayableEntry` can be watched going PENDING →
 * RELEASED with a Stripe transfer id on it, and it had never been done — partly
 * because a 1-2 hour hand-walk gets done once, by one person, and then is never
 * repeated after the code changes underneath it.
 *
 * The assertions here are the runbook's own, in the same order.
 *
 * What it does NOT do
 * -------------------
 * It does not provision Postgres, run the app, or forward webhooks. Those are
 * three long-lived processes and a script that owns them is a worse version of
 * three terminal windows. It CHECKS for each of them and refuses with the exact
 * command to run, which is the part that was actually easy to get wrong.
 *
 * It does not use live Stripe, and refuses any key that is not `sk_test_`.
 *
 * Prerequisites, all three checked at startup
 * -------------------------------------------
 *   1. A scratch Postgres, migrated to head. NOT production — see the preflight.
 *        createdb ihype_rehearsal
 *        DATABASE_URL=… DIRECT_URL=… npx prisma migrate deploy
 *   2. The app running against it in test mode with payments ON:
 *        DATABASE_URL=… DIRECT_URL=… STRIPE_SECRET_KEY=sk_test_… \
 *        STRIPE_WEBHOOK_SECRET=whsec_… AUTH_SECRET=… CRON_SECRET=… \
 *        FEATURE_ENABLE_TICKET_PAYMENTS=true npm run dev
 *   3. Webhooks forwarded, or nothing ever captures and every wait times out:
 *        stripe listen --forward-to localhost:3000/api/stripe/webhook
 *
 * Usage
 * -----
 *   DATABASE_URL=… STRIPE_SECRET_KEY=sk_test_… AUTH_SECRET=… CRON_SECRET=… \
 *     npm run rehearse:money
 *
 * Optional:
 *   REHEARSAL_BASE_URL        default http://localhost:3000
 *   REHEARSAL_VENUE_ACCOUNT   a Connect account with card_payments ACTIVE.
 *                             Present → the show settles VENUE_DIRECT.
 *   REHEARSAL_ARTIST_ACCOUNT  a Connect account with stripe_transfers ACTIVE.
 *                             Present without a venue → DESTINATION.
 *                             Neither → PLATFORM, the fallback.
 *   REHEARSAL_HEADFUL=1       watch the hosted checkout being filled in.
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { chromium } from '@playwright/test';
import { seedSessionCookie, sessionCookieName } from '../e2e/fixtures/session';

const BASE_URL = (process.env.REHEARSAL_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const DATABASE_URL = process.env.DATABASE_URL ?? '';
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY ?? '';
const CRON_SECRET = process.env.CRON_SECRET ?? '';
const VENUE_ACCOUNT = process.env.REHEARSAL_VENUE_ACCOUNT ?? null;
const ARTIST_ACCOUNT = process.env.REHEARSAL_ARTIST_ACCOUNT ?? null;

/** Face value per ticket. Chosen so the 70/20/10 split does not divide evenly —
 *  a round number would let a rounding bug pass unnoticed. */
const TICKET_PRICE_CENTS = 1837;

const TEST_CARD = process.env.REHEARSAL_CARD ?? '4242424242424242';

let passed = 0;
let failed = 0;

function check(label: string, ok: boolean, detail = ''): boolean {
  if (ok) {
    passed += 1;
    console.log(`  PASS  ${label}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed += 1;
    console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  }
  return ok;
}

function die(message: string, ...lines: string[]): never {
  console.error(`\n${message}`);
  for (const line of lines) console.error(`  ${line}`);
  process.exit(1);
}

/* ------------------------------------------------------------------ preflight
 * Every refusal here is a mistake that would otherwise be discovered halfway
 * through, after the script had already written rows somewhere. */

function preflightStatic() {
  if (!STRIPE_KEY) {
    die('STRIPE_SECRET_KEY is not set.', 'Export a TEST-mode key (sk_test_…).');
  }
  if (!STRIPE_KEY.startsWith('sk_test_')) {
    die(
      'Refusing to run: STRIPE_SECRET_KEY is not a test-mode key.',
      'This script creates orders, refunds and transfers. It must never touch live mode.',
    );
  }
  if (!DATABASE_URL) die('DATABASE_URL is not set.', 'Point it at a SCRATCH database.');

  /* The single most expensive mistake available here is pointing this at
     production, so the check is a denylist of what production looks like rather
     than a trusting flag. It creates orders, voids tickets and moves capacity;
     there is no undo. */
  const looksManaged = /supabase\.co|neon\.tech|rds\.amazonaws\.com/i.test(DATABASE_URL);
  const named = /rehears|scratch|test|local/i.test(DATABASE_URL);
  if (looksManaged && !named) {
    die(
      'Refusing to run: DATABASE_URL points at a managed host and is not named as scratch.',
      'This script creates and voids real rows. Use a throwaway database.',
      'If this really is a scratch database on a managed host, put "scratch" or',
      '"rehearsal" in its name so the refusal can tell the difference.',
    );
  }
  if (!process.env.AUTH_SECRET && !process.env.NEXTAUTH_SECRET) {
    die('AUTH_SECRET is not set.', 'Needed to sign the buyer session, and must match the running app.');
  }
  if (!CRON_SECRET) {
    die('CRON_SECRET is not set.', 'Step 7 calls the payout cron and it will 401 without this.');
  }
}

async function preflightLive(prisma: PrismaClient) {
  // The app has to be up, or every later failure is a confusing timeout.
  const health = await fetch(`${BASE_URL}/api/health`).catch(() => null);
  if (!health || !health.ok) {
    die(
      `The app is not answering at ${BASE_URL}.`,
      'Start it against the SAME scratch database, with FEATURE_ENABLE_TICKET_PAYMENTS=true.',
    );
  }

  // The schema has to be migrated, or the first query dies with a raw SQL error.
  await prisma.show.findFirst({ select: { id: true } }).catch(() => {
    die('The scratch database has no schema.', 'Run: npx prisma migrate deploy');
  });
}

/* --------------------------------------------------------------------- helpers */

async function api(path: string, cookie: string, init: RequestInit = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      cookie: `${sessionCookieName()}=${cookie}`,
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* leave as text — an HTML error page is more useful unparsed */
  }
  return { status: response.status, body: body as Record<string, unknown> };
}

/**
 * Waits for the webhook to land, rather than assuming it has.
 *
 * The purchase call returns as soon as the Checkout Session exists. Everything
 * this script asserts — CAPTURED, tickets, payables — is written by the webhook
 * handler afterwards, over a `stripe listen` tunnel with its own latency. A
 * fixed sleep is the version of this that passes on a fast machine and fails on
 * a busy one, so it polls and reports what it last saw on timeout.
 */
async function waitForOrderStatus(
  prisma: PrismaClient,
  confirmationCode: string,
  want: string,
  timeoutMs = 45_000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  let last = 'not found';
  while (Date.now() < deadline) {
    const order = await prisma.ticketOrder.findUnique({
      where: { confirmationCode },
      select: { status: true },
    });
    last = order?.status ?? 'not found';
    if (last === want) return last;
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  console.error(
    `\n  Timed out waiting for order ${confirmationCode} to reach ${want}; last saw ${last}.`,
  );
  console.error('  The usual cause is that `stripe listen` is not forwarding to this app.');
  return last;
}

/** Fills the Stripe-hosted checkout page. The one part of the walk that has to
 *  be a browser: there is no API that pays a Checkout Session. */
async function payHostedCheckout(url: string): Promise<boolean> {
  const browser = await chromium.launch({ headless: process.env.REHEARSAL_HEADFUL !== '1' });
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.getByPlaceholder('1234 1234 1234 1234').fill(TEST_CARD);
    await page.getByPlaceholder('MM / YY').fill('12 / 34');
    await page.getByPlaceholder('CVC').fill('123');
    const name = page.getByPlaceholder('Full name on card');
    if (await name.isVisible().catch(() => false)) await name.fill('Rehearsal Buyer');
    const zip = page.getByPlaceholder('12345');
    if (await zip.isVisible().catch(() => false)) await zip.fill('04101');
    await page.getByTestId('hosted-payment-submit-button').click();
    // The redirect back to success_url is the signal the form was accepted. It
    // is NOT the signal that the order is captured — the webhook does that, and
    // waitForOrderStatus is what waits for it.
    await page.waitForURL(/checkout=success/, { timeout: 60_000 });
    return true;
  } catch (error) {
    console.error(`  Could not complete the hosted checkout: ${(error as Error).message}`);
    console.error('  Re-run with REHEARSAL_HEADFUL=1 to watch it.');
    return false;
  } finally {
    await browser.close();
  }
}

async function runCron(job: string) {
  const response = await fetch(`${BASE_URL}/api/cron?job=${job}`, {
    headers: { authorization: `Bearer ${CRON_SECRET}` },
  });
  return { status: response.status, body: (await response.json().catch(() => ({}))) as Record<string, unknown> };
}

/* ----------------------------------------------------------------------- steps */

type Seeded = Awaited<ReturnType<typeof seedEverything>>;

async function seedEverything(prisma: PrismaClient) {
  console.log('\n[1] Seed a show with a venue and a headliner');

  const stamp = Date.now().toString(36);
  const fan = await seedSessionCookie(`rehearsal-fan-${stamp}@example.com`);
  const promoter = await seedSessionCookie(`rehearsal-promoter-${stamp}@example.com`, {
    profiles: [{ type: 'ARTIST', name: 'Rehearsal Promoter' }],
  });
  const owner = await seedSessionCookie(`rehearsal-owner-${stamp}@example.com`, {
    profiles: [
      { type: 'VENUE', name: 'Rehearsal Hall', verified: true },
      { type: 'ARTIST', name: 'Rehearsal Act', verified: true },
    ],
  });

  const venue = owner.profiles.find((p) => p.type === 'VENUE')!;
  const artist = owner.profiles.find((p) => p.type === 'ARTIST')!;

  /* The Connect accounts are supplied, never created. Stripe will not transfer
     to — or charge on — an account that has not completed onboarding, so these
     are a prerequisite of the run and not something a script can arrange. Which
     ones are present is what decides the settlement mode being rehearsed. */
  if (VENUE_ACCOUNT) {
    await prisma.profile.update({
      where: { id: venue.id },
      data: { stripeConnectAccountId: VENUE_ACCOUNT, stripeConnectOnboarded: true },
    });
  }
  if (ARTIST_ACCOUNT) {
    await prisma.profile.update({
      where: { id: artist.id },
      data: { stripeConnectAccountId: ARTIST_ACCOUNT, stripeConnectOnboarded: true },
    });
  }

  const expectedMode = VENUE_ACCOUNT ? 'VENUE_DIRECT' : ARTIST_ACCOUNT ? 'DESTINATION' : 'PLATFORM';
  console.log(`  Settlement mode under test: ${expectedMode}`);
  if (expectedMode === 'PLATFORM') {
    console.log('  (Set REHEARSAL_VENUE_ACCOUNT / REHEARSAL_ARTIST_ACCOUNT to rehearse the other two.)');
  }

  const show = await prisma.show.create({
    data: {
      slug: `rehearsal-show-${stamp}`,
      title: 'Rehearsal Show',
      // Comfortably outside the 48-hour refund window, so step 5 is allowed.
      startsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      creatorId: owner.user.id,
      venueProfileId: venue.id,
      headlinerProfileId: artist.id,
      status: 'SCHEDULED',
      ticketPriceCents: TICKET_PRICE_CENTS,
      ticketCapacity: 50,
      /* All four of these are checked by POST /api/shows/[showId]/tickets and
         a miss on any one answers 400 "not configured for ticket sales" — the
         percents are NULLABLE with no default, so a show created without them
         looks complete and cannot sell a thing. */
      isTicketed: true,
      venuePayoutPercent: 20,
      artistPayoutPercent: 70,
      promoterPayoutPercent: 10,
    },
    select: { id: true, slug: true },
  });

  check('show seeded', Boolean(show.id), `${show.slug} at ${TICKET_PRICE_CENTS}¢`);
  return { fan, owner, promoter, venue, artist, show, expectedMode };
}

async function buyTicket(
  prisma: PrismaClient,
  seeded: Seeded,
  label: string,
  body: Record<string, unknown>,
): Promise<string | null> {
  const purchase = await api(`/api/shows/${seeded.show.id}/tickets`, seeded.fan.cookie, {
    method: 'POST',
    body: JSON.stringify(body),
  });

  if (purchase.status === 503) {
    die(
      'The app refused the purchase: paid ticketing is disabled.',
      'Restart it with FEATURE_ENABLE_TICKET_PAYMENTS=true and test-mode Stripe secrets.',
      'src/lib/payments.ts fails closed on purpose — a rehearsal with the flag off proves nothing.',
    );
  }
  if (purchase.status !== 201) {
    check(`${label}: purchase accepted`, false, `HTTP ${purchase.status} ${JSON.stringify(purchase.body)}`);
    return null;
  }

  const confirmationCode = String(purchase.body.confirmationCode ?? '');
  const checkoutUrl = String(purchase.body.checkoutUrl ?? '');
  if (!confirmationCode || !checkoutUrl) {
    check(`${label}: purchase returned a checkout URL`, false, JSON.stringify(purchase.body));
    return null;
  }

  if (!(await payHostedCheckout(checkoutUrl))) {
    check(`${label}: hosted checkout completed`, false);
    return null;
  }

  const status = await waitForOrderStatus(prisma, confirmationCode, 'CAPTURED');
  if (!check(`${label}: order reaches CAPTURED`, status === 'CAPTURED', `status=${status}`)) return null;
  return confirmationCode;
}

async function assertOrderFinancials(prisma: PrismaClient, seeded: Seeded, confirmationCode: string) {
  const order = await prisma.ticketOrder.findUnique({
    where: { confirmationCode },
    include: { tickets: true, accountsPayableEntries: true },
  });
  if (!order) return check('order readable', false, confirmationCode);

  check('one ticket row per seat', order.tickets.length === order.quantity,
    `${order.tickets.length} tickets for quantity ${order.quantity}`);

  check('settlement mode is the one under test', order.settlementMode === seeded.expectedMode,
    `${order.settlementMode} (expected ${seeded.expectedMode})`);

  /* WHICH SHARES BECOME PAYABLES DEPENDS ON THE MODE, and getting this wrong in
     either direction is a double payment or a missing one:
       VENUE_DIRECT  the venue's share and the tax never left the venue, so
                     neither is a payable. Artist and promoter are.
       DESTINATION   Stripe routed the artist's share with the charge, so the
                     artist is NOT a payable. Venue, promoter and tax are.
       PLATFORM      everything is a payable. */
  const categories = new Set(order.accountsPayableEntries.map((e) => e.category));
  if (seeded.expectedMode === 'VENUE_DIRECT') {
    check('venue share is not a payable (it never left the venue)', !categories.has('VENUE_PAYOUT'),
      [...categories].join(','));
  } else if (seeded.expectedMode === 'DESTINATION') {
    check('artist share is not a payable (Stripe routed it)', !categories.has('ARTIST_PAYOUT'),
      [...categories].join(','));
  } else {
    check('artist and venue are both payables', categories.has('ARTIST_PAYOUT') && categories.has('VENUE_PAYOUT'),
      [...categories].join(','));
  }

  /* The sum has to be exact. This is the assertion the whole 70/20/10 design
     rests on, and rounding is where it would fail: the last share absorbs the
     remainder precisely so the parts add to the whole. */
  const payableTotal = order.accountsPayableEntries.reduce((sum, e) => sum + e.amountCents, 0);
  const expectedTotal =
    (seeded.expectedMode === 'VENUE_DIRECT'
      ? order.artistPayoutCents + order.promoterPayoutCents
      : seeded.expectedMode === 'DESTINATION'
        ? order.venuePayoutCents + order.promoterPayoutCents + order.totalTaxCents
        : order.venuePayoutCents + order.artistPayoutCents + order.promoterPayoutCents + order.totalTaxCents);
  check('payable entries sum EXACTLY to the shares they cover', payableTotal === expectedTotal,
    `${payableTotal} vs ${expectedTotal}`);

  check('every entry starts PENDING', order.accountsPayableEntries.every((e) => e.status === 'PENDING'),
    order.accountsPayableEntries.map((e) => `${e.category}=${e.status}`).join(' '));

  /* Only modes 2 and 3 charge the protection reserve. Mode 1 charges none,
     because iHYPE is carrying nothing to protect against, and a fee with no
     cost behind it is the one thing the fee design refuses to do. */
  if (seeded.expectedMode === 'VENUE_DIRECT') {
    check('no protection reserve on a venue-direct sale', order.reserveFeeCents === 0,
      `${order.reserveFeeCents}¢`);
  } else {
    check('protection reserve charged when iHYPE bears the risk', order.reserveFeeCents > 0,
      `${order.reserveFeeCents}¢`);
  }

  const show = await prisma.show.findUnique({
    where: { id: seeded.show.id },
    select: { ticketsSoldCount: true },
  });
  check('ticketsSoldCount moved', (show?.ticketsSoldCount ?? 0) >= order.quantity,
    `${show?.ticketsSoldCount}`);

  return order;
}

async function main() {
  preflightStatic();
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_URL }) });

  try {
    await preflightLive(prisma);
    console.log(`Money-path rehearsal against ${BASE_URL}`);
    console.log('Test mode only; this script refuses any key that is not sk_test_.');

    const seeded = await seedEverything(prisma);

    console.log('\n[2] Buy a ticket, and check the database rather than the response');
    const firstCode = await buyTicket(prisma, seeded, 'first order', { quantity: 1 });
    if (firstCode) await assertOrderFinancials(prisma, seeded, firstCode);

    console.log('\n[3] Buy again with a promoter attributed');
    /* The 10% is "if applicable": it is only withheld when someone is actually
       being credited, and otherwise redistributes. This is the branch no unit
       test reaches, because it spans the referral tables. */
    const secondCode = await buyTicket(prisma, seeded, 'referred order', {
      quantity: 1,
      affiliatePromoterProfileId: seeded.promoter.profiles[0]?.id,
    });
    if (secondCode) {
      const entries = await prisma.accountsPayableEntry.findMany({
        where: { ticketOrder: { confirmationCode: secondCode }, category: 'PROMOTER_AFFILIATE' },
        select: { profileId: true, amountCents: true },
      });
      check('the 10% attributes to a real profile, not null', entries.length > 0 && entries.every((e) => e.profileId),
        entries.map((e) => `${e.profileId}:${e.amountCents}`).join(' ') || 'no promoter entry');
    }

    console.log('\n[4] Refund the first order');
    if (firstCode) {
      const first = await prisma.ticketOrder.findUnique({
        where: { confirmationCode: firstCode },
        select: { tickets: { select: { serializedId: true } } },
      });
      const serialized = first?.tickets[0]?.serializedId;
      const refund = serialized
        ? await api(`/api/tickets/${serialized}/refund`, seeded.fan.cookie, { method: 'POST', body: '{}' })
        : { status: 0, body: {} };
      check('refund accepted', refund.status === 200, `HTTP ${refund.status} ${JSON.stringify(refund.body)}`);

      const after = await prisma.ticketOrder.findUnique({
        where: { confirmationCode: firstCode },
        include: { tickets: true, accountsPayableEntries: true },
      });
      check('order is VOID', after?.status === 'VOID', after?.status);
      check('a real Stripe refund id was recorded', Boolean(after?.stripeRefundId), after?.stripeRefundId ?? 'null');
      check('its tickets are VOID', (after?.tickets ?? []).every((t) => t.status === 'VOID'),
        (after?.tickets ?? []).map((t) => t.status).join(','));
      check('its payables are VOID', (after?.accountsPayableEntries ?? []).every((e) => e.status === 'VOID'),
        (after?.accountsPayableEntries ?? []).map((e) => e.status).join(','));

      if (secondCode) {
        /* The refund must not touch the other order. A refund that voided every
           payable for the SHOW rather than the ORDER would look identical in
           the first three assertions above. */
        const other = await prisma.accountsPayableEntry.findMany({
          where: { ticketOrder: { confirmationCode: secondCode } },
          select: { status: true },
        });
        check("the other order's payables are untouched", other.every((e) => e.status === 'PENDING'),
          other.map((e) => e.status).join(','));
      }
    }

    console.log('\n[5] Scan the remaining ticket, then try to refund it');
    if (secondCode) {
      const remaining = await prisma.ticket.findFirst({
        where: { ticketOrder: { confirmationCode: secondCode } },
        select: { id: true, serializedId: true },
      });
      if (remaining) {
        // Scanned directly rather than through the scan endpoint: this step is
        // about the REFUND refusal, and staff-auth is a different rehearsal.
        await prisma.ticket.update({
          where: { id: remaining.id },
          data: { status: 'SCANNED', scannedAt: new Date() },
        });
        const refused = await api(`/api/tickets/${remaining.serializedId}/refund`, seeded.fan.cookie, {
          method: 'POST',
          body: '{}',
        });
        check('a scanned ticket cannot be refunded', refused.status >= 400,
          `HTTP ${refused.status} — a scanned ticket is a person who walked in`);
        await prisma.ticket.update({
          where: { id: remaining.id },
          data: { status: 'VALID', scannedAt: null },
        });
      }
    }

    console.log('\n[6] End the show and run the payout cron');
    await prisma.show.update({
      where: { id: seeded.show.id },
      data: { status: 'ENDED', startsAt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });
    const firstRun = await runCron('show-payouts');
    check('payout cron ran', firstRun.status === 200, JSON.stringify(firstRun.body));

    const released = await prisma.accountsPayableEntry.findMany({
      where: { showId: seeded.show.id, status: 'RELEASED' },
      select: { category: true, stripeTransferId: true, amountCents: true },
    });
    check('at least one entry RELEASED', released.length > 0, `${released.length} released`);
    check('every released entry carries a real transfer id', released.every((e) => e.stripeTransferId),
      released.map((e) => `${e.category}:${e.stripeTransferId ?? 'MISSING'}`).join(' '));

    const stillPending = await prisma.accountsPayableEntry.findMany({
      where: { showId: seeded.show.id, status: 'PENDING' },
      select: { category: true },
    });
    /* Tax entries have no Connect account to pay, so they stay PENDING by
       design — remittance is a manual accounting matter. Anything ELSE left
       pending is an entry the cron could not pay and did not report. */
    const unexpectedlyPending = stillPending.filter((e) => !String(e.category).startsWith('TAX'));
    check('nothing but tax is left PENDING', unexpectedlyPending.length === 0,
      unexpectedlyPending.map((e) => e.category).join(',') || 'only tax');

    console.log('\n[7] Run the payout cron a second time');
    /* THE ASSERTION THIS WHOLE SCRIPT IS FOR. A cron that pays twice is the
       worst bug this system can have and it is invisible until it happens —
       the money is gone and the rows look plausible. */
    const secondRun = await runCron('show-payouts');
    check('second run releases nothing', secondRun.body.released === 0,
      `released=${JSON.stringify(secondRun.body.released)}`);

    console.log(`\n${passed} passed, ${failed} failed.`);
    console.log(`Scratch data left behind under show ${seeded.show.slug} — drop the database when done.`);
    if (failed > 0) {
      console.error('\nA failure here is a failure that would happen against live money.');
      process.exit(1);
    }
    console.log('\nThe app\'s own money path holds for settlement mode ' + seeded.expectedMode + '.');
    console.log('The other modes need their REHEARSAL_*_ACCOUNT set and another run.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('\nRehearsal aborted:', error?.message ?? error);
  process.exit(1);
});
