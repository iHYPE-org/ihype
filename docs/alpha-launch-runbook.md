# Alpha launch runbook

This is the minimum evidence required before admitting the first external alpha
cohort. Record the date, operator, environment, and result for every rehearsal.
Do not put credentials, customer data, or full webhook payloads in this file.

## Automated gates

1. Run `npm run check`.
2. Run `npm run build`.
3. Load production configuration securely and run
   `node -r dotenv/config scripts/beta-launch-check.mjs`.
4. Run `npm run smoke:production` with the monitoring bearer configured.
5. Confirm the authorized health response reports:
   - database `ok`;
   - no launch blockers;
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
