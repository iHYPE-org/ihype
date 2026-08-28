# iHYPE

iHYPE is a Next.js application for artist, venue, and fan profiles, event discovery, audio uploads, audience engagement, and paid ticketing. It uses Prisma with PostgreSQL and deploys to Cloudflare Workers through OpenNext.

## Stack

- Next.js App Router and route handlers
- React and TypeScript
- Auth.js with Prisma
- PostgreSQL and Prisma ORM
- Cloudflare Workers, Durable Objects, and object storage
- Resend/SMTP for transactional email
- Stripe for optional paid ticketing and payouts
- Playwright and Vitest for automated checks

## Local setup

1. Copy `.env.example` to `.env` and replace every placeholder.
2. Start PostgreSQL.
3. Install dependencies and generate Prisma Client:

```bash
npm ci
npx prisma generate
```

4. Apply the local schema and seed development data:

```bash
npx prisma migrate dev
npm run prisma:seed
```

5. Start the application:

```bash
npm run dev
```

## Development checks

```bash
npm run lint
npm test
npm run test:e2e
npm run cf:build
```

Pull requests also run a mandatory Chromium smoke test against scratch PostgreSQL and boot the built application in the Workers runtime.

## Demo accounts

The seed creates local development accounts for fan, artist, venue, and admin roles. Shared demo credentials are for local or controlled staging use only. Production disables demo login unless `FEATURE_ENABLE_DEMO_LOGINS=true` is deliberately configured.

## Paid ticketing launch gate

Paid ticketing is disabled by default for local/new environments:

```dotenv
FEATURE_ENABLE_TICKET_PAYMENTS=false
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

Stripe credentials alone do not enable charges. Paid ticketing becomes available only when all three conditions are met:

1. `FEATURE_ENABLE_TICKET_PAYMENTS=true`
2. `STRIPE_SECRET_KEY` contains a valid Stripe secret key
3. `STRIPE_WEBHOOK_SECRET` contains a valid webhook signing secret

Keep the feature switch false until payment-provider onboarding, refund policy, tax handling, accounting, and production reconciliation procedures are approved. While disabled, paid purchase and capture endpoints fail closed and do not create payment reservations, captured orders, tickets, or payout liabilities.

**Production status (2026-07-19):** `FEATURE_ENABLE_TICKET_PAYMENTS=true` in `wrangler.toml` — 501c3 status and a live Stripe account attached to the org's bank account have been confirmed. This flag alone does not move money: `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` are Cloudflare Worker secrets, set out-of-band (never touched by this repo or its CI), and `getPaymentProcessingReadiness()` (`src/lib/payments.ts`) still fails closed if either is missing or `STRIPE_SECRET_KEY` is a `sk_test_` key in production.

**Production status (2026-08-27) — the flag is back to FALSE, and this supersedes the two notes below.** `FEATURE_ENABLE_TICKET_PAYMENTS = "false"` in `wrangler.toml`. The two notes below are accurate about what was configured and are kept as the record of it; what none of it established is that anyone could be **paid**. Stripe **Connect had never been signed up for** on the iHYPE account at the time of writing (it was, on 2026-08-27 — see the settlement-model section directly below, which supersedes this paragraph on that point alone), so `createPayoutTransfer()` has no destination and `triggerShowPayouts()` can release nothing. With the flag true, a fan could buy, the charge would capture to the platform balance, the order would read `CAPTURED`, the ticket would scan — and every `AccountsPayableEntry` would sit `PENDING` indefinitely, with no fault reported anywhere, because nothing is faulty. That state was armed for five weeks and cost nothing only because live Stripe holds zero PaymentIntents. Re-enable only after `docs/runbooks/money-path-rehearsal.md` is walked to the end: Connect enabled, an Express account through hosted onboarding, a real transfer reaching a real destination, and the payout cron run twice showing `released: 0` on the second pass.

**Settlement model (2026-08-28) — read this before changing anything in `src/lib/stripe.ts`.** Connect is now signed up for, and the configuration chosen is the one that answers the constraint the org actually has: no reserve, no headcount for tax remittance, no headcount for ticket support. Sellers collect **directly**; onboarding is hosted by Stripe; the connected account gets the Express Dashboard; and **Stripe manages risk and is liable if a seller cannot pay back a loss, including losses from fraud.** In code that is `responsibilities: { fees_collector: 'stripe', losses_collector: 'stripe' }` in `createStripeConnectAccount()`, and it is why `debit_negative_balances` was deleted rather than deferred — a platform that is not liable cannot debit its connected accounts.

There are three settlement modes and the ticket route picks between them in this precedence, recording the choice on the order as `settlementMode`/`settlementAccountId`:

1. **`VENUE_DIRECT`** — the venue holds a payout-ready merchant account, so the charge is created **on** that account (`createVenueDirectCheckoutSession`, `{ stripeAccount }`). The venue is the merchant of record: it bears the dispute, and Stripe bears the loss if the venue cannot. iHYPE takes `application_fee_amount` covering the artist's 70% and the promoter's 10%, which lands in the platform balance and is transferred onward by the payout cron. The venue's 20% and tax never become `AccountsPayableEntry` rows, because that money never left the venue.
2. **`DESTINATION`** — no venue merchant account, but an artist payout account exists: a destination charge routes the artist's share (`transfer_data` + `application_fee_amount`, deliberately **no `on_behalf_of`** — the owner's call is that iHYPE stays the name on the purchase). iHYPE is the settlement merchant here and bears the dispute, which is what the 1.5% `TICKET_RESERVE_PERCENT` line on checkout exists to fund.
3. **`PLATFORM`** — nobody is connected. Everything captures to the platform balance and every share is an `AccountsPayableEntry` for the payout cron. This is the fallback, not the design.

The 70/20/10 arithmetic is identical in all three (`src/lib/ticketing.ts`); only who holds the money in between changes. The reserve line is charged only when `platformBearsRisk` is true, i.e. modes 2 and 3.

**Update (2026-07-20):** the Stripe webhook endpoint (`https://ihype.org/api/stripe/webhook`, subscribed to `payment_intent.amount_capturable_updated`/`payment_intent.succeeded`/`payment_intent.payment_failed`/`payment_intent.canceled`/`account.updated`) is registered and its signing secret is set as `STRIPE_WEBHOOK_SECRET`. Confirmed via Stripe's "Send test webhook" returning `200` — both required secrets are live and signature verification succeeds end-to-end.

**OPEN INCIDENT (found 2026-08-28, needs the live Stripe dashboard):** since 2026-08-26 19:28 UTC, production `/api/stripe/webhook` has been rejecting POSTs with "No signatures found matching the expected signature" — Sentry [JAVASCRIPT-NEXTJS-D](https://ihype.sentry.io/issues/JAVASCRIPT-NEXTJS-D), 83 events in two days and escalating, still occurring after the 08-28 19:20 deploy. The onset coincides with the Connect signup (08-26/27). It is NOT the test sandbox: the sandbox has zero webhook endpoints (verified via the Stripe MCP), and a sandbox could not sign with a live secret anyway. The most likely cause is a live-mode endpoint whose signing secret no longer matches the Worker's `STRIPE_WEBHOOK_SECRET` — either the endpoint was re-created/rolled during Connect signup, or Connect setup added a second endpoint whose secret was never installed. The 2026-07-20 note above was true when written; this supersedes it until re-verified. Fix needs live-dashboard access: Developers → Webhooks, compare each endpoint's signing secret against the Worker secret, update the Worker (`wrangler secret put STRIPE_WEBHOOK_SECRET` on `ihype`), then confirm the Sentry issue stops. While the flag is off nothing is lost — live mode holds no PaymentIntents — but `account.updated` events for Connect onboarding are being dropped, which is exactly the backstop the runbook's KYC section relies on. Do not walk runbook step 3 before this is fixed.

## Closed-beta invite codes

Set `FEATURE_REQUIRE_INVITE_CODE=true` and provide comma-separated random codes in `BETA_INVITE_CODES`. Production ignores short or known sample codes. Generate each code with at least 16 random characters, for example:

```bash
openssl rand -hex 16
```

## Media storage

Production uploads require configured object storage. Temporary database-backed media storage is disabled by default. Artist uploads are limited by file size, request rate, track count, and cumulative profile storage.

## Security posture

- Authentication sessions are tied to a user security version and expire after 12 hours.
- Magic-link bearer tokens are stored as one-way hashes and consumed atomically.
- Passkeys require user verification.
- Browser routes receive a nonce-based script Content Security Policy.
- Ticket scans, ticket capacity reservations, and order state changes use conditional database transitions.
- Webhook business changes and idempotency markers commit in the same transaction.
- Production rate limiting requires the atomic Durable Object backend and fails closed if it is unavailable.
- Public health checks expose liveness only. Detailed dependency health requires an admin session or monitoring bearer token.

## Privacy export

Authenticated users can download account, profile, content, activity, ticket, moderation, notification, follow, booking, and advertising records associated with their account. Credential secrets, session tokens, payment-processor identifiers, push credentials, and raw binary media are intentionally excluded from the export.

## Production deployment

The production workflow:

1. Installs dependencies and generates Prisma Client.
2. Runs type checks, design checks, and unit tests.
3. Builds the Cloudflare Workers bundle.
4. Applies migrations through the direct/non-pooled database URL.
5. Deploys the application and cron Worker.
6. Runs authenticated production health and public smoke checks.
7. Purges the Cloudflare cache.

The workflow builds before applying migrations so a compilation failure cannot advance the production schema.

Required GitHub environment secrets include:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `DATABASE_URL`
- `DIRECT_URL`
- `AUTH_SECRET`
- `CRON_SECRET`
- email-provider credentials

Stripe secrets are not required while `FEATURE_ENABLE_TICKET_PAYMENTS=false`.

## Launch configuration check

Run the configuration validator before beta or production changes:

```bash
node -r dotenv/config scripts/beta-launch-check.mjs
```

The check validates required secrets, rejects weak invite codes, and requires Stripe settings only when paid ticketing is explicitly enabled.

## Operational requirements

Before public launch, establish database backups and restore drills, email-domain authentication, content moderation and takedown procedures, incident response, privacy request handling, media-rights review, payment reconciliation, refund operations, and legal review of nonprofit and ticketing language.
