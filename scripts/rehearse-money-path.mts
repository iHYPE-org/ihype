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

import Stripe from 'stripe';
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

/**
 * Pays the Checkout Session via the API instead of a browser.
 *
 * REHEARSAL_PAY_MODE=api exists because a sandboxed session may be unable to
 * point a browser at checkout.stripe.com at all (this repo's own
 * audit-mobile.mjs documents Playwright failing through a TLS-terminating
 * agent proxy — verified again 2026-08-28). The session is found by the
 * confirmationCode the app stamped into its metadata, and its PaymentIntent
 * is confirmed with the standard test payment method. Test mode only by
 * construction: the preflight already refused any non-sk_test_ key.
 *
 * What this does NOT exercise: the hosted payment page itself (its fields,
 * its redirect). Everything downstream — the webhook, capture, finalisation —
 * is identical, and those are what this script asserts.
 */
async function payViaApi(prisma: PrismaClient, confirmationCode: string): Promise<boolean> {
  const stripe = new Stripe(STRIPE_KEY);
  for (let attempt = 0; attempt < 5; attempt++) {
    /* A VENUE_DIRECT session is created ON the venue's account — the exact
       property step 1's "invisible to a platform-scoped lookup" check exists
       to prove — so a platform-scoped list can never find it (measured
       2026-08-30: every purchase stage failed "no Checkout Session found"
       while the app answered 201). Search both scopes, and carry the scope
       forward: the synthetic PaymentIntent must live where the real one
       would, or nothing downstream (the refund above all) is faithful. */
    const scopes: (Stripe.RequestOptions | undefined)[] = [undefined];
    if (VENUE_ACCOUNT) scopes.push({ stripeAccount: VENUE_ACCOUNT });
    let session: Stripe.Checkout.Session | undefined;
    let scope: Stripe.RequestOptions | undefined;
    for (const candidate of scopes) {
      const sessions = candidate
        ? await stripe.checkout.sessions.list({ limit: 20 }, candidate)
        : await stripe.checkout.sessions.list({ limit: 20 });
      session = sessions.data.find((s) => s.metadata?.confirmationCode === confirmationCode);
      if (session) {
        scope = candidate;
        break;
      }
    }
    if (session) {
      try {
        /* Checkout creates its PaymentIntent LAZILY — only when the payer
           submits the hosted form, which only a browser can do. So the money
           is made real here directly: a genuine PaymentIntent for the
           session's exact amount, confirmed with the standard test card. The
           refund and dispute paths downstream act on this intent, so every
           money-bearing call in the rehearsal still hits real Stripe.

           The one synthesized piece is the `checkout.session.completed`
           ENVELOPE, delivered below with the same signature scheme real
           delivery uses — because Stripe offers no API to complete a hosted
           session, and this sandbox cannot reach checkout.stripe.com with a
           browser (its egress proxy re-signs TLS; Chromium refuses). On a
           machine that can, prefer the default browser mode, which exercises
           the real event too. */
        /* Mirror the shape the REAL session gives its PaymentIntent, or the
           refund path downstream is not rehearsed faithfully. Measured
           2026-08-30: a plain PI on a DESTINATION order made the cancel
           route's `reverse_transfer: true` fail with "does not have an
           associated transfer" — a harness artifact, not the app. The order
           row already stores the split, so the shapes are recomputed the way
           src/lib/stripe.ts computes them: DESTINATION's fee is what is LEFT
           after the act's share; VENUE_DIRECT's fee is the SUM of the two
           onward shares (the venue keeps its 20% by never sending it). */
        const order = await prisma.ticketOrder.findUnique({ where: { confirmationCode } });
        const modeShape: Partial<Stripe.PaymentIntentCreateParams> = {};
        if (order?.settlementMode === 'DESTINATION' && order.settlementAccountId) {
          modeShape.transfer_data = { destination: order.settlementAccountId };
          modeShape.application_fee_amount = order.totalChargeCents - order.artistPayoutCents;
        } else if (order?.settlementMode === 'VENUE_DIRECT') {
          modeShape.application_fee_amount = order.artistPayoutCents + order.promoterPayoutCents;
        }
        const intent = await stripe.paymentIntents.create(
          {
            amount: session.amount_total ?? 0,
            currency: session.currency ?? 'usd',
            payment_method: 'pm_card_visa',
            confirm: true,
            automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
            metadata: { confirmationCode, rehearsal: 'true' },
            ...modeShape,
          },
          { idempotencyKey: `rehearsal-pay:${confirmationCode}`, ...(scope ?? {}) },
        );
        const event = {
          id: `evt_rehearsal_${confirmationCode}`,
          object: 'event',
          api_version: '2026-07-29.dahlia',
          created: Math.floor(Date.now() / 1000),
          type: 'checkout.session.completed',
          data: { object: { ...session, payment_intent: intent.id, payment_status: 'paid', status: 'complete' } },
          livemode: false,
          pending_webhooks: 1,
          request: { id: null, idempotency_key: null },
        };
        const payload = JSON.stringify(event);
        const signature = stripe.webhooks.generateTestHeaderString({
          payload,
          secret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
        });
        const delivered = await fetch(`${BASE_URL}/api/stripe/webhook`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'stripe-signature': signature },
          body: payload,
        });
        if (!delivered.ok) {
          console.error(`  webhook delivery answered ${delivered.status}`);
          return false;
        }
        return true;
      } catch (error) {
        console.error(`  API pay failed: ${(error as Error).message.slice(0, 200)}`);
        return false;
      }
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  console.error('  no Checkout Session found carrying this confirmationCode');
  return false;
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
  /* The purchase route requires an adult attestation (`isEighteenOrOlder`)
     before it will sell — the e2e fixture seeds a bare fan, so stamp it the
     way Settings would. Deliberately NOT part of the fixture's defaults: specs
     that assert the AGE_18_REQUIRED refusal need a fan without it. */
  await prisma.user.update({ where: { id: fan.user.id }, data: { isEighteenOrOlder: true } });
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
    /* The token is a dummy on purpose: the rehearsal server runs Cloudflare's
       published always-pass Turnstile TEST secret, which verifies any token.
       Against a real secret this dummy fails closed, exactly as it should. */
    body: JSON.stringify({ turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX', ...body }),
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

  const order = purchase.body.order as Record<string, unknown> | undefined;
  const confirmationCode = String(order?.confirmationCode ?? purchase.body.confirmationCode ?? '');
  const checkoutUrl = String(purchase.body.checkoutUrl ?? '');
  if (!confirmationCode || !checkoutUrl) {
    check(`${label}: purchase returned a checkout URL`, false, JSON.stringify(purchase.body));
    return null;
  }

  const paid = process.env.REHEARSAL_PAY_MODE === 'api'
    ? await payViaApi(prisma, confirmationCode)
    : await payHostedCheckout(checkoutUrl);
  if (!paid) {
    check(`${label}: checkout completed`, false);
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

    console.log('\n[4] Cancel a show, which refunds — the only refund path that exists');
    /* Buyer-initiated refunds were REMOVED 2026-08-12 (commit b7fb6205,
       product ruling: "all ticket sales are final") — the runbook's original
       stage 4 tested a deleted route, and CLAUDE.md still described it as
       live. What exists is the ORGANIZER cancellation flow, which refunds
       every captured order via a real Stripe refund. Rehearsed on its own
       mini-show so the main show's payables survive for the payout stages. */
    const cancelShow = await prisma.show.create({
      data: {
        slug: `rehearsal-cancel-${Date.now().toString(36)}`,
        title: 'Rehearsal Cancellation',
        startsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        creatorId: seeded.owner.user.id,
        venueProfileId: seeded.venue.id,
        headlinerProfileId: seeded.artist.id,
        status: 'SCHEDULED',
        ticketPriceCents: TICKET_PRICE_CENTS,
        ticketCapacity: 50,
        isTicketed: true,
        venuePayoutPercent: 20,
        artistPayoutPercent: 70,
        promoterPayoutPercent: 10,
      },
      select: { id: true, slug: true },
    });
    const cancelSeeded = { ...seeded, show: cancelShow };
    const refundableCode = await buyTicket(prisma, cancelSeeded, 'refundable order', { quantity: 1 });
    const scannedCode = await buyTicket(prisma, cancelSeeded, 'scanned order', { quantity: 1 });

    if (refundableCode && scannedCode) {
      /* One ticket is scanned before the cancellation: the cancel route must
         refund the unscanned order and SKIP the scanned one — a person who
         walked in attended the show, cancelled or not. */
      const scannedTicket = await prisma.ticket.findFirst({
        where: { ticketOrder: { confirmationCode: scannedCode } },
        select: { id: true },
      });
      if (scannedTicket) {
        await prisma.ticket.update({
          where: { id: scannedTicket.id },
          data: { status: 'SCANNED', scannedAt: new Date() },
        });
      }

      const cancel = await api(`/api/shows/${cancelShow.id}/cancel`, seeded.owner.cookie, {
        method: 'POST',
        body: JSON.stringify({ reason: 'other' }),
      });
      check('cancellation accepted', cancel.status === 200, `HTTP ${cancel.status} ${JSON.stringify(cancel.body).slice(0, 200)}`);

      const refunded = await prisma.ticketOrder.findUnique({
        where: { confirmationCode: refundableCode },
        include: { tickets: true, accountsPayableEntries: true },
      });
      check('unscanned order is VOID', refunded?.status === 'VOID', refunded?.status);
      check('a real Stripe refund id was recorded', Boolean(refunded?.stripeRefundId), refunded?.stripeRefundId ?? 'null');
      check('its tickets are VOID', (refunded?.tickets ?? []).every((t) => t.status === 'VOID'),
        (refunded?.tickets ?? []).map((t) => t.status).join(','));
      check('its payables are VOID', (refunded?.accountsPayableEntries ?? []).every((e) => e.status === 'VOID'),
        (refunded?.accountsPayableEntries ?? []).map((e) => e.status).join(','));

      console.log('\n[5] The scanned order is skipped, not refunded');
      const attended = await prisma.ticketOrder.findUnique({
        where: { confirmationCode: scannedCode },
        select: { status: true, stripeRefundId: true },
      });
      check('scanned order is NOT voided — a scan is a person who walked in',
        attended?.status === 'CAPTURED', attended?.status);
      check('and no refund was issued for it', !attended?.stripeRefundId, attended?.stripeRefundId ?? 'none');

      const mainOrderPayables = await prisma.accountsPayableEntry.findMany({
        where: { showId: seeded.show.id },
        select: { status: true },
      });
      check("the main show's payables are untouched by the cancellation",
        mainOrderPayables.every((e) => e.status === 'PENDING'),
        mainOrderPayables.map((e) => e.status).join(','));
    }

    console.log('\n[6] End the show and run the payout cron');
    /* ELEVEN days back, not one: triggerShowPayouts holds every payout for
       PAYOUT_HOLD_DAYS (10) past the show date so the dispute window has
       mostly closed before money leaves. A rehearsal that backdated by a day
       measured the hold working, not the payout failing. */
    await prisma.show.update({
      where: { id: seeded.show.id },
      data: { status: 'ENDED', startsAt: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000) },
    });
    const firstRun = await runCron('show-payouts');
    check('payout cron ran', firstRun.status === 200, JSON.stringify(firstRun.body));

    const released = await prisma.accountsPayableEntry.findMany({
      where: { showId: seeded.show.id, status: 'RELEASED' },
      select: { category: true, stripeTransferId: true, amountCents: true },
    });
    const stillPending = await prisma.accountsPayableEntry.findMany({
      where: { showId: seeded.show.id, status: 'PENDING' },
      select: { category: true },
    });
    /* The cron can only PAY a payee who finished Connect onboarding — an
       entry whose profile has no account is counted `skipped` and stays
       PENDING, which is the app doing the right thing, not a fault. So what
       this stage proves depends on what this run was given: with onboarded
       accounts it proves money moves exactly once; without, it proves the
       cron correctly refuses to invent a destination. Both assertions are
       real; only one of them is about money. */
    const haveAccounts = Boolean(VENUE_ACCOUNT || ARTIST_ACCOUNT);
    if (haveAccounts) {
      check('at least one entry RELEASED', released.length > 0, `${released.length} released`);
      check('every released entry carries a real transfer id', released.every((e) => e.stripeTransferId),
        released.map((e) => `${e.category}:${e.stripeTransferId ?? 'MISSING'}`).join(' '));
      const unexpectedlyPending = stillPending.filter((e) => !String(e.category).startsWith('TAX'));
      check('nothing but tax is left PENDING', unexpectedlyPending.length === 0,
        unexpectedlyPending.map((e) => e.category).join(',') || 'only tax');
    } else {
      const skipped = Number((firstRun.body as Record<string, unknown>).skipped ?? 0);
      check('with no payee onboarded, every payable is skipped rather than paid to nowhere',
        released.length === 0 && skipped > 0 && stillPending.length > 0,
        `released=${released.length} skipped=${skipped} pending=${stillPending.length}`);
      console.log('        (Set REHEARSAL_VENUE_ACCOUNT / REHEARSAL_ARTIST_ACCOUNT with onboarded');
      console.log('        accounts to prove the money actually moves — the release leg is UNPROVEN.)');
    }

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
