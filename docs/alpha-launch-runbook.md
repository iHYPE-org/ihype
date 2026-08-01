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

## Payment and ticket rehearsal

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

- Confirm two operators can disable paid ticketing and uploads.
- Confirm two operators can roll back the Worker deployment.
- Document database migration recovery for the release.
- Confirm the rotation procedure for Auth, cron, Stripe, Resend, Turnstile, and
  admin-device secrets.
- Confirm issued tickets remain verifiable while new sales are disabled.

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
