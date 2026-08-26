# Runbook — rehearse the money path before the first sale

**Status: step 1 executed 2026-08-26 — 8 passed, 0 failed, 2 steps blocked.**
Live Stripe still holds zero PaymentIntents, zero connected accounts and a zero
balance. Nothing has ever been sold through this app, so the first real ticket
purchase is still the first production execution of the capture → split → payout
→ refund path. This runbook exists so that does not happen.

### What step 1 proved, against real test-mode Stripe

| Check | Result |
|---|---|
| PaymentIntent authorizes with no `transfer_data` | PASS — `requires_capture` |
| Manual capture method is in force | PASS |
| Capture succeeds | PASS — `succeeded` |
| Full amount lands on the PLATFORM balance, not routed onward | PASS — `amount_received=5000` |
| Captured order refunds in full | PASS — `amount=5000` |
| Ad pre-auth captures only delivered spend, releasing the rest | PASS — `1250` of `5000` |
| Unaired campaign releases the hold entirely | PASS — `canceled` |

The fourth row is the one that matters most historically: it is the 2026-07-14
payout-routing bug — `transfer_data.destination` sending the WHOLE charge to one
party instead of the 70/20/10 split — confirmed fixed against real Stripe rather
than against a mock.

### BLOCKER 2 — `createConnectAccount()` cannot create an account at all

Found 2026-08-26 by running the app's own call, byte for byte, against a
Connect-enabled test account:

```
stripe.accounts.create({ type: 'express', capabilities: { transfers: { requested: true } } })
→ StripeInvalidRequestError: Stripe no longer recommends Accounts v1 for new
  Connect integrations. Create connected accounts with POST /v2/core/accounts
```

`src/lib/stripe.ts:78` uses **Accounts v1**, and that endpoint is CLOSED to new
Connect integrations — not deprecated-with-a-warning, rejected. So on a Stripe
account that registers Connect from now on, no artist, venue or promoter can
onboard, `stripeConnectAccountId` is never set, and every payable entry sits
`PENDING` forever. The failure is at onboarding, before any money moves, which is
the good news: nothing can sell a ticket into a payout that cannot happen.

**Two related traps found at the same time, both of which cost real debugging:**

1. **The v1 capability view LIES about v2 accounts.** `GET /v1/accounts` reported
   `capabilities.transfers: "active"` for two accounts that cannot receive a
   transfer; their `GET /v2/core/accounts?include=configuration.recipient` shows
   `capabilities: {}`. A transfer destination needs
   `configuration.recipient.capabilities.stripe_balance.stripe_transfers` — the
   legacy `transfers` capability is a different thing with a confusingly
   identical name. Do not trust the v1 field when diagnosing a failed payout.
2. **`dashboard` is required** when creating a v2 account with the transfers
   capability, and the error naming it arrives only after everything else
   validates.

Migrating means `accounts.create` → `POST /v2/core/accounts`, the onboarding
link, the capability name checked before a transfer, and whatever
`stripeConnectOnboarded` should now mean. It is a money-path change and wants its
own PR with the rehearsal re-run against it.

### BLOCKER 1 — Connect is not signed up for (on the original account)

Steps 2 and 3 of the rehearsal (**the 70/20/10 transfers**, and **replaying a
payout without double-paying**) could not run. Creating a connected account
returns:

> You can only create new accounts if you've signed up for Connect

**This is a launch prerequisite, not a testing detail.** `triggerShowPayouts()`
pays through `stripe.transfers.create()` to connected accounts, so until Connect
is enabled on the iHYPE Stripe account no artist, venue or promoter can be paid
at all — in test mode or in production. A ticket would sell, the money would
capture to the platform balance, and every payable entry would sit `PENDING`
forever.

Enable Connect (dashboard → Connect), then create three test Express accounts and
complete the hosted onboarding for each with Stripe's test values, and re-run:

```
REHEARSAL_CONNECT_ACCOUNTS=acct_1,acct_2,acct_3 \
  STRIPE_SECRET_KEY=sk_test_… npm run stripe:rehearsal
```

Onboarding cannot be faked — Stripe will not transfer to an account that has not
completed it, and the application has the identical prerequisite.

### What steps 2 and 3 proved before hitting blocker 2

Run against a second, Connect-enabled test account:

| Check | Result |
|---|---|
| **70/20/10 splits sum to the captured total with no leakage** | **PASS — artist=3500 venue=1000 promoter=500 of 5000** |
| Each transfer actually reaches its destination | BLOCKED — destination lacks `stripe_balance.stripe_transfers` |
| Replaying a payout does not double-pay | BLOCKED — depends on the transfer above |

The passing row is the charter arithmetic verified against real Stripe rather
than against a pure function. The two blocked rows are the ones that still have
never executed anywhere; note that the double-pay guard now has unit cover
(`show-payouts.test.ts`, "pays once when the cron runs twice"), which is not the
same as proving Stripe accepts the second call as a no-op.

### The remaining steps still need a human

Step 2 needs a staging database and forwarded webhooks; step 3 is the one-way
door. Every step is written to be done in one sitting, in order, with what "good"
looks like stated so a partial pass is not mistaken for a pass.

---

## What is already proven, and by what

Do not re-prove these; know what they do and don't cover.

| Covered | By | Not covered |
|---|---|---|
| The 70/20/10 arithmetic, lineup splits, rounding remainder | `src/lib/__tests__/ticket-order-state.test.ts` | Whether Prisma writes what the pure function returned |
| Capture / refund / void state transitions, races, capacity release, PENDING-only payable voiding | `src/lib/__tests__/ticket-order-money-path.test.ts` | Whether Prisma's `updateMany` filters as assumed |
| `triggerShowPayouts` querying, per-entry release, failure isolation, **and that a second cron pass releases nothing** | `src/lib/__tests__/show-payouts.test.ts` | Whether Stripe accepts the transfer shape |
| Stripe fee arithmetic | `src/lib/__tests__/stripe-fees.test.ts` | Anything about a real charge |

Everything in the right-hand column is what the steps below are for.

---

## Step 1 — Stripe-side semantics (30 minutes, test mode)

`scripts/stripe-payout-rehearsal.mjs` rehearses the six Stripe behaviours the
app's design depends on. It **refuses any key that is not `sk_test_`**, so it
cannot touch live money.

```bash
STRIPE_SECRET_KEY=sk_test_… npm run stripe:rehearsal
```

A test-mode account already exists on the iHYPE Stripe account, so the key comes
from Stripe Dashboard → Developers → API keys with the **Test mode** toggle on.

The script creates its own connected accounts unless you point it at existing
ones with `REHEARSAL_CONNECT_ACCOUNTS=acct_…,acct_…,acct_…`.

**What good looks like:** every one of its six checks prints a pass, in
particular that the three transfers sum to exactly the captured amount and that
replaying a transfer with the same idempotency key returns the *same* transfer id
rather than paying twice.

**What it cannot do:** it has no database, so it does not exercise
`triggerShowPayouts()`'s own state transitions — the thing that decides which
entries get paid. That is step 2.

---

## Step 2 — the app's own path, against a scratch database (1–2 hours)

This is the step that has never been done in any form, and it is the one that
matters: it is the only way to see a `AccountsPayableEntry` go from PENDING to
RELEASED with a real `stripeTransferId` on it.

You need a throwaway Postgres and test-mode Stripe keys. **Never point this at
the production `DATABASE_URL`** — it creates and refunds orders.

```bash
# 1. A scratch database, migrated to head.
createdb ihype_rehearsal
DATABASE_URL=postgresql://…/ihype_rehearsal DIRECT_URL=postgresql://…/ihype_rehearsal \
  npx prisma migrate deploy

# 2. Run the app against it, in test mode, with payments ON.
#    FEATURE_ENABLE_TICKET_PAYMENTS defaults to OFF and src/lib/payments.ts
#    fails closed on it — a rehearsal with it unset proves nothing.
DATABASE_URL=… DIRECT_URL=… \
STRIPE_SECRET_KEY=sk_test_… STRIPE_WEBHOOK_SECRET=whsec_… \
FEATURE_ENABLE_TICKET_PAYMENTS=true npm run dev

# 3. Forward webhooks, or nothing ever captures.
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Then walk the path as a member, and check the database after each step rather
than at the end:

1. **Create a show** with a venue and a headliner, both with onboarded test-mode
   Connect accounts (`POST /api/stripe/connect/onboard` from `/payouts?tab=settings`).
2. **Buy a ticket** with `4242 4242 4242 4242`.
   → `TicketOrder` is `CAPTURED`; `Ticket` rows exist, one per seat;
   `AccountsPayableEntry` rows sum to **exactly** the order's payout cents, all
   `PENDING`; `Show.ticketsSoldCount` moved by the quantity.
3. **Buy a second ticket through a HYPE link** (`/h/<code>`).
   → the promoter entry carries that referrer's `profileId`, not null. This is
   the 10% pool actually attributing to a person, which no test covers because
   it spans the referral tables.
4. **Refund the first order** (>48h before doors, from `/tickets`).
   → order and tickets `VOID`; capacity back; **its** payable entries `VOID`; the
   other order's entries untouched and still `PENDING`; a real refund visible in
   the Stripe test dashboard.
5. **Scan a ticket** on the remaining order, then try to refund it.
   → refused. A scanned ticket is a person who walked in.
6. **End the show** (`status = ENDED`, `startsAt` in the past) and run the payout
   cron: `curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron?job=show-payouts`.
   → each entry `RELEASED` with a `stripeTransferId`; transfers visible in the
   Stripe test dashboard, summing to the captured total; the venue and artist
   owners each got the payout email; **tax entries stay PENDING** (manual
   remittance, by design).
7. **Run the cron again.**
   → `released: 0`. This is the idempotency check that matters most: a cron that
   pays twice is the worst bug this system can have, and it is invisible until it
   happens.

Record the outcome — including anything surprising — in a DESIGN_SYNC row, and
delete the scratch database.

---

## Step 3 — the one-way door

Only after steps 1 and 2 pass:

- Set `FEATURE_ENABLE_TICKET_PAYMENTS=true` in the production Worker.
- Sell **one** ticket to yourself at the lowest possible price, and walk step 2's
  checks against production once, refunding at the end.
- Then open sales.

The first real sale should be one you made on purpose.

---

## Known gaps this runbook does not close

- **`Ad.spentCents` has no history**, so `ad_spend` in the analytics engine is
  inferred from impressions at each campaign's delivered rate. A real
  per-period figure needs a spend-ledger row per impression.
- **Tax remittance is manual.** Tax entries are booked and stay PENDING
  forever; nothing files anything.
- **`stripe` schema in Supabase** is the vendor's Sync Engine, not read by any
  application code. It is not part of this path.
