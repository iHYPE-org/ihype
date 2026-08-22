# Runbook — rehearse the money path before the first sale

**Status: never executed.** Live Stripe holds zero PaymentIntents, zero
connected accounts and a zero balance. Nothing has ever been sold through this
app, which means the first real ticket purchase will be the first execution of
the capture → split → payout → refund path in production. This runbook exists so
that does not happen.

It needs credentials nobody in an agent session has. Every step is written to be
done by a human in one sitting, in order, with what "good" looks like stated so a
partial pass is not mistaken for a pass.

---

## What is already proven, and by what

Do not re-prove these; know what they do and don't cover.

| Covered | By | Not covered |
|---|---|---|
| The 70/20/10 arithmetic, lineup splits, rounding remainder | `src/lib/__tests__/ticket-order-state.test.ts` | Whether Prisma writes what the pure function returned |
| Capture / refund / void state transitions, races, capacity release, PENDING-only payable voiding | `src/lib/__tests__/ticket-order-money-path.test.ts` | Whether Prisma's `updateMany` filters as assumed |
| `triggerShowPayouts` querying, per-entry release, failure isolation | `src/lib/__tests__/show-payouts.test.ts` | Whether Stripe accepts the transfer shape |
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
