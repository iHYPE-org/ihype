# Alpha Release Checklist

**Owners:** both iHYPE operators  
**Rule:** do not expand the alpha while any required item is failing or unverified.

## Before merging

- [ ] Pull-request CI passes, including Workerd security smoke and performance budgets.
- [ ] The database migration has been reviewed for destructive operations.
- [ ] Production dependencies report no high or critical vulnerabilities.
- [ ] No landing-page, player, search, or theme regression is visible on mobile.

## Before deploying

- [ ] Run `npm run check:alpha` with the production configuration available locally.
- [ ] Confirm the Cloudflare `ihype-cron` Worker contains both `CRON_SECRET` and `HEARTBEAT_URL`.
- [ ] Confirm the Production GitHub environment requires an operator approval.
- [ ] Confirm registration, upload, outbound-email, advertising, and payment switches have the intended values.
- [ ] Confirm the most recent backup verification passed.
- [ ] `RESTORE_DRILL_VERIFIED_AT` matches that drill and is no more than 35 days old.

## Immediately after deploying

- [ ] Production smoke passes; a Cloudflare block is a failure, not a waiver.
- [ ] Authenticated `/api/health` reports `launchReadiness.ready: true`.
- [ ] Authenticated `/api/health` reports `alphaReadiness.ready: true`.
- [ ] The external heartbeat receives a successful ping after the next five-minute batch.
- [ ] No failed notification jobs or overdue notification backlog appears.
- [ ] Sentry has no new release regression.

## End-to-end alpha rehearsal

- [ ] Register a new fan and complete authentication.
- [ ] Complete a published song and verify one idempotent HYPE reward.
- [ ] HYPE and un-HYPE a public target; verify balance and ledger history.
- [ ] Cast one community vote and verify a duplicate vote is rejected.
- [ ] Complete a referral and verify capped, idempotent rewards.
- [ ] Purchase a Stripe test ticket, receive it, scan it, and verify attendance HYPE.
- [ ] Replay the Stripe webhook and confirm no duplicate ticket, payout, or notification.
- [ ] Refund the order and reconcile database, Stripe, and payable balances.

## Human resilience

- [ ] Both operators receive `ADMIN_ALERT_EMAIL` messages.
- [ ] A second administrator can sign in and use the emergency switches.
- [ ] Complete and record the monthly backup restore drill.
- [ ] Walk through the incident-response runbook together.
- [ ] Record who is on call and how the other operator is reached.

## Content and native clients

- [ ] Alpha readiness reports at least 10 playable tracks, 5 artists, 2 venues, 2 upcoming events, and 1 radio show.
- [ ] Run the native workflow with `publish=false`; install and exercise both retained signed artifacts.
- [ ] Only after signed-device testing passes, explicitly approve a `publish=true` internal-store upload.

## Expansion rule

Start with a small invited cohort. Expand only after several consecutive days
with successful heartbeats, no unresolved payment discrepancies, no failed
notification jobs, and no serious privacy, moderation, or access-control issue.
