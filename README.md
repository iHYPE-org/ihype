# iHYPE

iHYPE is a Next.js application for artist, DJ, venue, promoter, and fan pages, event discovery, media uploads, audience engagement, and ticketing. It uses Prisma with PostgreSQL and deploys to Cloudflare Workers through OpenNext.

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

The seed creates local development accounts for fan, artist, promoter, venue, and admin roles. Shared demo credentials are for local or controlled staging use only. Production disables demo login unless `FEATURE_ENABLE_DEMO_LOGINS=true` is deliberately configured.

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
