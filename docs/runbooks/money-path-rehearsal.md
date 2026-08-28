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

### Loss controls, added 2026-08-27 — verify these in the rehearsal

Four changes exist to stop a sale losing money for iHYPE, the act, the venue or
the promoter. Three are provable without Stripe and are unit-tested; the fourth
has never executed anywhere and is the one to watch for.

| Control | What it prevents | Proven? |
|---|---|---|
| **10-day payout hold** (`PAYOUT_HOLD_DAYS`, `show-payouts.ts`) | Payables used to release the moment a show hit `ENDED`, leaving **zero** window to reverse anything. A dispute the next morning had nothing to claw back. | Unit-tested. Confirm in step 3 that a show ended today releases NOTHING. |
| **1.5% protection reserve** (`TICKET_RESERVE_PERCENT`) | Disputes ($15 fee + the amount, debited from the PLATFORM even on a destination charge), Connect's ~1% of gross, and the Amex under-collection `stripe-fees.ts` has always documented. All previously paid by nobody. | Unit-tested, disclosed at checkout. Reconcile the fund against real disputes before trusting 1.5%. |
| **`reverse_transfer` + `refund_application_fee`** on refunds | Stripe's default is that the destination KEEPS its transfer and the platform absorbs the whole refund — every refund a net loss of about the artist's share. | Unit-tested. **Prove against real Stripe**: refund a destination charge and check the act's balance actually drops. |
| ~~`debit_negative_balances: true`~~ **REMOVED 2026-08-27** | It made Stripe recover a negative balance from the payee's own bank, which mattered while iHYPE was liable for those balances. | **Deleted, not deferred.** Connect signup selected Stripe-managed risk, and a platform that is not liable cannot debit its connected accounts at all — Stripe handles recovery itself. The call was also a v1 `accounts.update` against a v2 account and had never executed anywhere. Do not re-add it: "make sure we can debit the account" reads like an obviously good idea to anyone who has not read the platform's risk configuration. |

What none of it fixes: a stolen card that buys a ticket, attends the show, and
disputes. The show happened and the act played. Radar lowers the frequency, the
reserve absorbs the hit, the hold decides whether it lands on iHYPE or is
clawed back from the act — and the deliberate answer is that **iHYPE carries
it**, because an artist clawed back a week after playing does not come back.

### Connect is configured, and it changes the dispute answer below

Signed up 2026-08-27. The platform's own Connect configuration is:

| Setting | Chosen |
|---|---|
| Funds flow | **Sellers will collect payments directly** — direct charges, the venue is the merchant |
| Account creation | Onboarding hosted by Stripe |
| Account management | Sellers use the Express Dashboard |
| Risk and loss liability | **Stripe manages risk and is liable if sellers cannot pay back losses, including fraud** |

The last row is the one that matters most and it was not a given. On a
**venue-direct** sale iHYPE now carries no dispute exposure at all: Stripe
debits the venue's account, and if that account cannot cover it, STRIPE absorbs
the shortfall rather than the platform. That is what makes this design viable
for a platform with no reserve behind it.

`createStripeConnectAccount` must match, and now does:
`responsibilities: { fees_collector: 'stripe', losses_collector: 'stripe' }`.
It said `'application'` for both until this date, which would have handed the
liability straight back — quietly, on an account that looks correctly
configured.

**What the section below still describes accurately** is the FALLBACK modes.
A headliner-destination or platform-settled charge is an *indirect* charge, the
platform is the merchant, and Stripe's own guidance is explicit that
Stripe-managed risk "doesn't absolve your platform of responsibility for its own
balance". So the empty-fund problem is real for exactly those sales — the ones
where no venue is onboarded — and disappears for the rest. That is a strong
argument for getting venues onboarded early, and a reason the 1.5% reserve stays
on the fallback modes and is charged on none of the venue-direct ones.

### Dispute liability: settled, and the fund is empty

Confirmed with Stripe, 2026-08-27, after the destination-charge work landed.
Recorded here because it is the question most likely to be re-litigated by
someone reading `on_behalf_of` and assuming it did more than it does.

**iHYPE carries every chargeback.** Stripe debits dispute amounts and fees from
the PLATFORM account on a destination charge, *with or without* `on_behalf_of`.
The connected account bears none of it. `on_behalf_of` moves the settlement
merchant — the act's name on the fan's statement, their country's fee structure
— and moves no risk at all.

Two levers were checked and neither helps:

- **`losses_collector` / `controller.losses.payments`** governs *connected
  account* negative balances, not the platform's own. It cannot help on an
  indirect charge, where the negative balance in question is the platform's.
  (**Corrected 2026-08-28:** this bullet used to say the right value was
  `application` and that `createStripeConnectAccount` already set it. Both
  halves are now wrong — the signed-up configuration is Stripe-managed risk, so
  the value is `'stripe'`, and the function was changed to match. The point the
  bullet was making still stands: it buys nothing on the fallback modes.)
- **Direct charges** put liability on the connected account — and this bullet
  used to end there, claiming they settle to exactly one account so the
  70/20/10 "could not be routed by Stripe" and one party would have to be
  trusted to pay the other two. **That was wrong, and it cost most of a day.**
  `application_fee_amount` on a direct charge lands in the PLATFORM balance and
  can be transferred onward, so a direct charge routes a three-way split
  perfectly well: the venue keeps its 20% by never sending it, and the artist's
  70% and the promoter's 10% arrive as an application fee that the payout cron
  pays out. That is `VENUE_DIRECT`, and it is now the preferred mode. Nobody is
  trusted to pay anybody.

Liability follows the merchant on the charge, and a charge has one merchant.
That is card-network structure, not a product choice, so no vendor escapes it
by being cleverer. **What follows from it is not what this paragraph used to
say** — it used to conclude that no configuration gives an enforced split with
no platform dispute liability. There is one: make the merchant somebody other
than iHYPE. A direct charge on the venue's account is an enforced three-way
split (see the corrected bullet above) whose merchant is the venue, so the
dispute is the venue's and, under Stripe-managed risk, the unrecoverable
shortfall is Stripe's. iHYPE's exposure is zero on those sales. It is the
fallback modes — where no venue is onboarded and iHYPE is the merchant by
default — that carry the liability this section is about.

#### Deflection is not insurance

Stripe pointed at third-party apps — ChargebackStop, Chargeblast, Chargeflow —
rather than their own first-party Chargeback Protection, which strongly implies
the first-party product is not available on Connect destination charges. Do not
plan around it without confirming.

What those apps sell is mostly **prevention and automation**, not risk
transfer:

- **Pre-dispute alerts** (Ethoca / Verifi networks): notification when a
  cardholder disputes with their bank, with a window to refund voluntarily
  before it becomes a chargeback. The sale is still lost; the **$15 fee**, the
  chargeback record and the dispute-ratio hit are avoided.
- **Dispute automation**: evidence assembly and submission, usually priced on
  recovery. Some tiers advertise a guarantee — read those terms rather than the
  marketing.

None of them move liability. They lower frequency and cost.

**Alerts are worth more here than to an ordinary merchant**, and the reason is
the payout hold. An alert arriving inside the ten days means the payable is
still held, so the refund AND the transfer reversal can both happen while the
act's share is still recoverable — instead of clawing back from someone who
played the show a week ago, which is the outcome this runbook says iHYPE should
absorb rather than inflict. The hold creates the window; the alerts say when to
use it. That is a better argument for ten days than the one written above it.

#### The fund starts at zero, and is not segregated

`TICKET_RESERVE_PERCENT` COLLECTS a reserve. It does not begin with one, and
there is no float behind it. At 27c on an $18 ticket:

| Outcome | Net loss | Tickets that must have sold to cover it |
|---|---|---|
| Dispute, transfer reversal succeeds | $18.00 − $12.60 recovered + $15 fee = **$20.40** | **76** |
| Dispute, reversal fails (act's balance empty) | $18 + $15 = **$33.00** | **122** |

So the fund cannot absorb one dispute until roughly the hundredth ticket. Before
that, a dispute is met by whatever is in the Stripe balance; if that is short,
Stripe debits the linked bank account, and failing that the platform goes
negative and recovers from later sales.

**It is also commingled.** The reserve accrues into the same balance as venue
shares, promoter shares and collected TAX. A dispute consumes whatever is
sitting there, which can be a remittance owed to a tax authority — a worse
failure than the dispute. `reserveFeeCents` is stored per order specifically so
collected-minus-consumed can be reported against the tax liability; build that
view before volume, not after.

#### What to do about it, given no guaranteed float

A seeded float is the clean answer and **cannot be relied on** — donations are
not guaranteed. So the rule is a threshold rather than a precondition:

- **Alpha is not gated on this.** At ten shows and a couple of hundred tickets
  the expected loss is a few dollars and the tail is one or two disputes,
  landing as a negative balance of tens of dollars that later sales recover.
  Unpleasant, visible, survivable.
- **Growth is gated on it.** Do not scale past a few hundred tickets a month
  until the fund covers a bad month. That is a rule that can be kept without
  anyone donating anything.
- **Keep the ten days.** With no float, a successful reversal is the difference
  between $20.40 and $33. Do not shorten the hold under pressure from acts
  waiting to be paid; explain it instead.
- **Radar rules** are free and cut fraud at source.
- **Do NOT raise the reserve to build the fund faster.** Doubling to 54c still
  only reaches one dispute's worth around ticket 60, and it spends the thing
  this project has been most careful about — the buyer's total.

Reserve policy and tax segregation for a 501(c)(3) are an accountant's
territory, not this runbook's. What is written here is the mechanics; the
treatment is a question for someone qualified.

### KYC finishes after the member leaves, and the v1 webhook does not say so

Recorded 2026-08-28, from Stripe's Accounts v2 migration guide.

Onboarding completion is **asynchronous**. A venue finishes the hosted flow and
Stripe verifies them minutes or days later, by which time they have closed the
tab. `/api/stripe/connect/return` checks readiness at the moment they come
back, correctly finds them not ready, and marks nothing. Something has to ask
again later.

The intended backstop was the v1 `account.updated` webhook, and **for a
recipient-only account that backstop does not exist.** Stripe's guide says v2
`Accounts` emit v1 events "depending on the updated configuration", and names
the **merchant** configuration as the one that emits v1 `account.updated`. A
recipient capability going active announces itself only on the v2 thin event:

```
v2.core.account[configuration.recipient].capability_status_updated
```

So for every artist and promoter — recipient-only by design — nothing was ever
going to flip `stripeConnectOnboarded` after they left the page. Every one of
their shows would settle `PLATFORM` indefinitely, reporting no fault, because
nothing is faulty: the question is simply never asked again.

**Closed by making `stripe-connect-health` reconcile rather than complain.**
Every 6 hours it asks Stripe the real readiness question for each profile that
has an account and is not marked onboarded, and promotes the ones that have
gone active — payout capability for everyone, **plus** `card_payments` for a
venue. Promote-only, never demote. It needs no dashboard configuration and it
keeps working if an event is missed or a destination is deleted.

That cron previously only sent email, and its query included
`onboarded: false, accountId: not null` — which is the ordinary state of every
member who has started and not finished. It therefore alerted every six hours
about people doing nothing wrong. It now emails only for genuinely corrupt
state (onboarded with no account id), which no code path can produce.

**A v2 event destination is still worth adding, and is no longer load-bearing.**
It buys latency: minutes instead of up to six hours. Two things to get right,
both of which Stripe's own support notes people get wrong:

- Create it as an **API v2** destination — a v1 webhook endpoint does not
  receive thin events at all, so our existing `/api/stripe/webhook` cannot.
- Scope it to **"Your account"**, not "Connected accounts". `v2.core.account.*`
  events for connected accounts arrive on the platform's own scope, which is
  the opposite of the v1 intuition.

Subscribe to the `configuration.recipient` **and** `configuration.merchant`
variants — a venue needs both, and only the merchant one has any v1 equivalent.

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

`scripts/stripe-payout-rehearsal.mjs` rehearses the Stripe behaviours the app's
design depends on, across **all three settlement modes**. It **refuses any key
that is not `sk_test_`**, so it cannot touch live money.

```bash
STRIPE_SECRET_KEY=sk_test_… npm run stripe:rehearsal
```

A test-mode account already exists on the iHYPE Stripe account, so the key comes
from Stripe Dashboard → Developers → API keys with the **Test mode** toggle on.

**It does not create connected accounts, and cannot.** Stripe will not transfer
to, or charge on, an account that has not completed onboarding, so the accounts
are a prerequisite rather than something the script can arrange:

| Env var | What it needs | Which steps |
|---|---|---|
| `REHEARSAL_CONNECT_ACCOUNTS=acct_…,acct_…,acct_…` | three accounts with `transfers` **active** | 2, 3, 6 |
| `REHEARSAL_MERCHANT_ACCOUNT=acct_venue` | one account with `card_payments` **active** | 7 |

The second is a strictly higher bar than the first — a merchant needs the full
service agreement and the merchant configuration requested during onboarding.
That difference is not an inconvenience of the script; it is the same
distinction `isConnectPayoutReady()` and the venue-direct branch turn on, so an
account that cannot satisfy step 7 also cannot take a `VENUE_DIRECT` sale.

**What good looks like:** every check passes AND the last line reads *"All three
settlement modes rehearsed"*. In particular:

- the three transfers sum to exactly the captured amount, and replaying one with
  the same idempotency key returns the *same* transfer id rather than paying
  twice (steps 2-3);
- on a **destination** charge the act receives their *share* and not the whole
  charge — the 2026-07-14 bug, asserted directly — and a refund with
  `reverse_transfer`/`refund_application_fee` reverses the act's transfer in
  full rather than leaving the platform to fund the refund alone (step 6);
- on a **venue-direct** charge the PaymentIntent is **invisible to a
  platform-scoped lookup** — that failure is the pass, and it is the only
  positive proof the merchant role actually moved — while the application fee
  carrying the artist's 70% and the promoter's 10% appears as a platform
  `application_fee` object where the payout cron can reach it (step 7).

**A skip is not a pass, and the exit code says so.** Steps 6 and 7 skip when the
accounts they need do not exist, and the script then exits **2**, not 0, naming
the modes it could not rehearse. What ran in that case is the `PLATFORM`
fallback — the mode a real sale is *least* likely to take. This is deliberate:
a green tick over an unrun stage is a mistake this repository has already made
twice, and an exit code is harder to skim past than a log line.

**What it cannot do:** it has no database, so it does not exercise
`triggerShowPayouts()`'s own state transitions — the thing that decides which
entries get paid. That is step 2.

---

### Test cards, and the one that matters most

From the Accounts v2 marketplace blueprint, 2026-08-28. Use these in step 2 —
"buy a ticket" without naming a card only ever exercises the happy path.

| Card | What it does | Why walk it |
|---|---|---|
| `4000 0000 0000 0077` | succeeds, funds available immediately | the blueprint's own card; skips the pending-balance wait, so a transfer can be attempted in the same sitting |
| `4242 4242 4242 4242` | succeeds, funds pending | the realistic case — proves the payout cron waits rather than failing |
| `4000 0000 0000 0259` | succeeds, then **disputes as fraudulent** | **the one that matters.** Everything about this settlement design is an argument about who eats a chargeback. Nothing has ever tested that claim. |
| `4000 0000 0000 0002` | declined | the order must not reserve capacity for a sale that did not happen |

Any future expiry (12/31) and any three-digit CVC.

**Walk `…0259` on a VENUE_DIRECT sale specifically.** The whole case for the
mode is that the dispute is debited from the venue and, under Stripe-managed
risk, an unrecoverable shortfall is Stripe's rather than iHYPE's. Confirm in
the dashboard that the disputed amount and the 15 USD fee land on the **venue's**
balance and not the platform's. If they land on the platform, the settlement
model is wrong and every number in this runbook is wrong with it.

Then walk it again on a `DESTINATION` sale, where the opposite should be true
and the platform *should* be debited — that is the exposure the 1.5% reserve
line exists to fund, and it should be visible.

### Two things the checkout surface does that nobody has decided

Both seen in the blueprint's own checkout screenshot, both true of our code,
neither a bug.

**1. On a venue-direct sale the fan sees the VENUE, not iHYPE.** The blueprint's
page reads "Pay Powdur" — the connected account's name — because on a direct
charge the connected account *is* the merchant. That is the mode working as
designed, and it is worth stating plainly because the owner's instruction
during the `on_behalf_of` discussion was "let's keep iHYPE as the name on the
purchase". That instruction was about destination charges and still holds
there; venue-direct deliberately moved the merchant role, and the name moves
with it.

The consequence is a real one and it lands on the venue: an unfamiliar name on
a card statement is the most common single trigger for a "I don't recognise
this" chargeback, and on this mode the venue pays for it. The obvious mitigation
is `payment_intent_data.statement_descriptor_suffix` carrying the show or the
venue's trading name. **It is deliberately not implemented yet**, because the
concatenated descriptor must be 1-22 characters *including the connected
account's own prefix*, which we do not know at session-creation time — so a long
venue prefix plus our suffix is rejected, and a rejected descriptor fails the
whole Checkout Session and loses the sale. Cheap fix, real downside, needs one
test against a real connected account before shipping. Do it during step 2.

**2. We compute tax ourselves; the blueprint uses Stripe Tax.** Its screenshot
shows a live "Tax — enter address to calculate" line. Our session sends a
single line item at `financials.totalChargeCents`, so the Stripe page shows one
number and the itemisation lives only in `TicketSaleCard` before the fan leaves
the app. `calculateTicketTaxes` is our own.

That is defensible for a fixed-price ticket at a known venue address, and it is
also the part of the money path with the least evidence behind it. The venue is
the one remitting on a venue-direct sale, so a wrong figure is a wrong figure in
someone else's tax filing. Enabling `automatic_tax` would move both the
calculation and the rate-table maintenance to Stripe — worth pricing before the
first multi-state show rather than after.

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
