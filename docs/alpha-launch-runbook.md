# Alpha launch runbook

This is the minimum evidence required before admitting the first external alpha
cohort. Record the date, operator, environment, and result for every rehearsal.
Do not put credentials, customer data, or full webhook payloads in this file.

## Automated gates

1. Run `npm run check`.
2. Run `npm run build`.
3. Load production configuration securely and run
   `npm run check:alpha`. This requires two operational-alert recipients and a
   successful restore-drill timestamp no more than 35 days old.
4. Run `npm run smoke:production` with the monitoring bearer configured.
5. Confirm the authorized health response reports:
   - database `ok`;
   - no launch blockers;
   - `alphaReadiness.ready: true` (two administrators, fresh restore evidence,
     invite-only registration, and the minimum real-content cohort);
   - no terminally failed notification jobs;
   - no pending notification job older than 30 minutes.
6. Run `npm run test:e2e:responsive`. It checks every module at 320, 375,
   390, and 430 CSS pixels, phone landscape, light mode, reduced motion, and
   140% text — `TEXT_SCALE_MAX`, the largest the settings screen produces, and
   the value the spec now asserts actually applied before measuring anything.
   Review its screenshot artifacts when CI reports a regression.

## Payment and ticket rehearsal

> **The app's money path HAS now executed against test-mode Stripe (2026-09-03),
> and this warning used to say it never had.** `npm run alpha:walk` against the
> real Workers build and a scratch PG17 database passed **43 of 44** items with
> zero failures (41 of 42 on the first run; two items were added the same day —
> a closed sale being refused rather than charged, and a paid ad spot actually
> airing on the station a member listens to), including: a ticket sold and
> CAPTURED (1952c), three payables with
> the promoter earning exactly 10% of face value, the QR scanned once and a
> replay refused 409, the same Stripe event delivered twice issuing one ticket
> and one payout, a show cancellation refunding for real (`re_…` 1865c) with
> every payable VOID, and an ad hold authorized then released because delivered
> spend was under Stripe's 50c floor. The single non-pass is environmental:
> Stripe refuses a `localhost` `business_url`, so Connect onboarding cannot
> complete on loopback — the same call with `https://ihype.org/…` succeeded.
>
> **Why it had never run, which is worth keeping.** `scripts/e2e-workerd.mjs`
> forwarded only the database and auth variables into the Worker. The walk
> passed `STRIPE_SECRET_KEY` to ITSELF and nothing passed it to the WORKER,
> where `getPaymentProcessingReadiness()` reads it through `readRuntimeEnv`. So
> every ticket and card call answered 503 and the ad checkout threw
> "STRIPE_SECRET_KEY is not configured" — and the walk recorded those as
> FAILURES OF THE PRODUCT. They were failures of the harness. It now forwards
> the Stripe, cron and payments-flag variables when the caller has them, and
> refuses a live key outright.
>
> **Still not executed, and still blocking:** `npm run stripe:rehearsal` (the
> Stripe-side semantics, which needs no database), and `triggerShowPayouts()`
> run TWICE against an ended show to see `released: 0` the second time. The walk
> creates payables and voids them on refund; it does not release them.
>
> **Step 0, before any of the below:** `STRIPE_SECRET_KEY=sk_test_… npm run
> stripe:rehearsal`. It refuses any key that is not `sk_test_`, and it
> rehearses the Stripe-side semantics the app depends on: full capture to the
> platform balance with no `transfer_data`, three transfers summing exactly
> with the last absorbing the remainder, per-entry transfer idempotency, full
> refund, and partial capture plus hold release for ad settlement.
>
> It has **no database**, so it cannot exercise `triggerShowPayouts()`'s own
> state transitions (PENDING → RELEASED, the `stripeTransferId` write, the
> refund path that voids still-PENDING entries). Those need a staging database
> with a real ended show. Do both before the doors open; the rehearsal alone is
> not sufficient evidence.

- Complete a successful Stripe sandbox purchase.
- Confirm the order is captured and the expected tickets exist.
- Confirm ticket email delivery and its Resend delivery event.
- Resend the Stripe event and confirm no duplicate order, ticket, or email.
- Deliver relevant webhook events out of order and confirm final state remains correct.
- Scan a ticket once, then confirm a second scan is rejected.
- Exercise a declined payment.
- Exercise successful, delayed, and failed refund paths.
- Reconcile Stripe amounts against the order, ticket, and payable records.

## Recovery rehearsal

- Confirm the database backup retention window.
- Restore the latest backup into an isolated project.
- Run `npm run verify:restore` with the isolated and production database URLs;
  the checker refuses to query a matching production database identity.
- Verify users, profiles, orders, tickets, scans, payables, and notification jobs.
- Verify R2 objects independently; database backups do not contain media objects.
- Record the measured recovery point and recovery time.

## Monitoring rehearsal

- Trigger a safe Sentry test error and confirm the alert reaches an operator.
- Confirm the external cron heartbeat becomes late when a controlled ping is omitted.
- Force a notification job retry and confirm it appears in authorized health.
- Send to a controlled invalid mailbox and confirm the signed Resend bounce webhook.
- Confirm the Stripe dashboard shows successful webhook delivery.

## Emergency controls

- Confirm two operators can independently disable uploads, new payments, new
  ticket sales, radio, and map lookups from the audited admin flag panel.
- Confirm the switches return a retryable 503 and that issued-ticket reads,
  scanning, refunds, and Stripe webhook reconciliation continue to work.
- Confirm two operators can roll back the Worker deployment.
- Document database migration recovery for the release.
- Confirm the rotation procedure for Auth, cron, Stripe, Resend, Turnstile, and
  admin-device secrets.
- Confirm issued tickets remain verifiable while new sales are disabled.

Runtime overrides are stored as `flags:<name>` in Cloudflare KV and take
effect without a Worker deploy. Environment values are fallbacks only:
`FEATURE_ENABLE_PAYMENTS`, `FEATURE_ENABLE_TICKETING`,
`FEATURE_ENABLE_RADIO`, and `FEATURE_ENABLE_MAPS`. Do not disable webhook or
refund handling during an incident; those are recovery paths, not new risk.

## Privacy and alpha feedback rehearsal

- Confirm one-tap alpha feedback includes only module, coarse viewport class,
  coarse platform, app version, and an error reference.
- Confirm analytics ingest drops query text, paths, content IDs, listening
  history, free-form errors, and coordinates.
- Confirm exact profile addresses are accepted only for venues; artists and
  DJs retain broad scene labels, and fans have no stored profile location.
- Confirm the player restores its local queue and position after reload and
  resumes cleanly after a controlled offline/online transition.

## Alpha containment

- Keep invite-only registration enabled.
- Set initial cohort and daily transaction-value caps.
- Assign the support and incident contacts for the launch window.
- Review errors, failed email, abandoned orders, open reports, and queue backlog
  daily throughout alpha.
- Before inviting testers, publish at least 10 playable tracks, 5 discoverable
  artists, 2 discoverable venues, 2 upcoming events, and 1 scheduled radio show.

## Native release rehearsal

- Manually run **Native shell build (iOS + Android)** with `publish=false` first.
  This exercises signing and retains the signed IPA/AAB without contacting a store.
- Inspect and install the retained artifacts on controlled devices.
- Only after that rehearsal passes, rerun with `publish=true` to upload to
  TestFlight and the Play internal-testing track.
