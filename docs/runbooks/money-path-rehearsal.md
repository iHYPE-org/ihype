# Runbook — rehearse the money path before the first sale

**Status: steps 1 AND 2 executed 2026-08-30 — step 1 clean (25/25, all three
settlement modes), step 2 walked in all three modes and it found what it exists
to find: ONE REAL DEFECT — a cancelled show cannot refund any VENUE_DIRECT
order (see the step-2 section below). Fix that, re-run VENUE_DIRECT stage 4,
walk the dispute card by hand, and step 3 is the only door left.** Live Stripe
still holds zero PaymentIntents and a zero balance.
Nothing has ever been sold through this app, so the first real ticket purchase
is still the first production execution of the capture → split → payout
→ refund path against the LIVE account. This runbook exists so that does not
happen unrehearsed.

### Step 1 complete — 2026-08-30, sandbox `acct_1Ttr6LLuZsyulVGR`

Final run: **25 passed, 0 failed**, exit 0, last line *"All three settlement
modes rehearsed: PLATFORM, DESTINATION, VENUE_DIRECT."* Run by the operator on
their own machine (the remote session's permission layer refused to execute the
script; every harness fix below was written there, pushed to
`claude/stripe-rehearsal-results`, and pulled).

| Check | Result |
|---|---|
| [1] Platform capture: authorizes with no `transfer_data`, manual capture in force, capture succeeds, full 5000 lands on the platform | PASS ×4 |
| [2] 70/20/10 split sums exactly (artist 3500 / venue 1000 / promoter 500), three real transfers created (`tr_1UAE7FLuZsyulVGRLE5mo9jq`, `tr_1UAE7FLuZsyulVGRM2Yg5ux0`, `tr_1UAE7GLuZsyulVGRYdL5Y1Ma`) | PASS ×4 |
| [3] Replaying a transfer with the same idempotency key returns the SAME transfer id — no double-pay | PASS |
| [4] Captured charge refunds in full (5000) | PASS ×2 |
| [5] Ad pre-auth captures only delivered spend (1250 of 5000); unaired hold released outright | PASS ×2 |
| [6] DESTINATION: charge succeeds, no `on_behalf_of`, transfer created, **the act NETS exactly 3500** (5000 transferred, 1500 application fee pulled back), refund with `reverse_transfer`/`refund_application_fee` reverses 5000 of 5000 | PASS ×7 |
| [7] VENUE_DIRECT: fee names the two onward shares (4000 of 5000), direct charge succeeds **on the venue** (`pi_3UAE7VLuZs8WZJKj1PDPEfxT` is invisible to a platform-scoped lookup — that failure is the pass), venue charged the fee, and a real `fee_1UAE7YLuZs8WZJKjbYih0yb0` = 4000 sits on the platform where the payout cron can reach it | PASS ×5 |

**DESTINATION and VENUE_DIRECT RAN rather than skipped — their first execution
anywhere.** What it took to get here; every item is a trap for the next person:

1. **The 2026-08-28 "both prerequisites now exist" note below was wrong, by the
   exact v1-capability trap this runbook documents.** `acct_1U8mdKLuZs8WZJKj`
   and `acct_1U8mdmLuZsguyf6N` showed `transfers: "active"` in the v1 view and
   a real transfer was refused ("destination account needs … stripe_transfers").
   The v2 view showed **no recipient configuration at all** — merchant-only,
   which is also why step 7 worked before step 2 did. Fixed by
   `POST /v2/core/accounts/{id}` requesting
   `configuration.recipient.capabilities.stripe_balance.stripe_transfers`
   (activated instantly — KYC was already verified). Note: v2 core accounts
   404s on this sandbox without a `.preview` Stripe-Version header
   (`2025-09-30.preview` works).
2. **`REHEARSAL_CONNECT_ACCOUNTS` needs THREE ids** (artist/venue/promoter
   slots; auto-detection likewise wants three accounts). The one-account
   command previously written here silently skips step 2. A destination may
   repeat — the working invocation is below.
3. **Step 2 needs AVAILABLE balance** — every `pm_card_visa` charge lands as
   pending. The script now self-funds via the `4000 0000 0000 0077`
   bypass-pending card, grossed up for Stripe's fee on the top-up itself
   (funding the bare shortfall left it ~3% short), and then POLLS the balance:
   the Balance API lags the charge by several seconds, and the first version
   triple-funded against a stale reading and still hit "insufficient funds".
4. **Three readback/assertion bugs in the script itself, all invisible until
   it executed**: `charges.retrieve(id, { stripeAccount })` sent the header as
   a request parameter (options are the THIRD argument) and aborted step 7; a
   charge's `transfer` and `application_fee` attach moments AFTER the
   PaymentIntent confirms, so immediate readbacks reported both missing while
   both demonstrably existed on Stripe a minute later (now polled); and step
   6's original assertion expected `transfer.amount === 3500`, which
   contradicts Stripe's documented mechanics — with `application_fee_amount`
   the FULL charge transfers to the destination and the fee is pulled back, so
   the act's share is the NET (now asserted as 5000 − 1500 = 3500). The old
   reversal check also passed vacuously (`undefined === undefined`) when no
   transfer had been found.
5. **Key hygiene**: one aborted attempt was the environment carrying the
   literal `sk_test_…` placeholder pasted from this runbook's own example;
   another was the MAIN account's test-mode key — connected accounts are
   per-environment, so only the sandbox's own secret key can reach them.

**Open question carried to step 2**: if a transfer FAILS (e.g.
`balance_insufficient`), does Stripe replay the saved error for a retry with
the same idempotency key? `createPayoutTransfer` keys on the payable entry id,
so a transiently-failed payout retried by the cron needs this answered before
anyone trusts the retry path. (Step 2 did not answer it — no transfer failed
transiently during its runs. Still open.)

### Step 2 walked — 2026-08-30, all three modes, scratch Postgres + real worker

`npm run rehearse:money` executed against the real worker build (`wrangler
dev` on the OpenNext bundle, local Postgres 16 behind the Hyperdrive binding,
`REHEARSAL_PAY_MODE=api`) in all three settlement modes, resetting the scratch
database between runs. Per-mode results:

| Mode | Result | What it proved |
|---|---|---|
| PLATFORM (no accounts) | **24 passed, 0 failed** | Capture → `TicketOrder` CAPTURED, one ticket per seat, payables sum exactly and start PENDING, 28¢ reserve charged, HYPE-link 10% attributes to a real profile, cancellation refunds for real (`re_3UAEdNLuZsyulVGR1hIUnvQY`) and voids order/tickets/payables, a scanned order is skipped not refunded, the cron **skips** every un-onboarded payee rather than paying to nowhere, and a second cron run releases nothing. |
| DESTINATION (`REHEARSAL_ARTIST_ACCOUNT`) | 24 passed, 2 failed — both environment | The whole refund leg on a real destination charge: `reverse_transfer` works, order/tickets/payables VOID, reserve charged. The 2 fails are the release leg for venue+promoter payables, whose payees cannot be onboarded here: both sandbox accounts are merchant-capable, and attaching one to the venue flips the app into VENUE_DIRECT. Correct skip behaviour, not a defect. |
| VENUE_DIRECT (`REHEARSAL_VENUE_ACCOUNT` + `REHEARSAL_ARTIST_ACCOUNT`) | 21 passed, 5 failed — **4 are ONE REAL DEFECT**, 1 environment | **The release leg is PROVEN**: two payables went PENDING→RELEASED with real transfer ids (`tr_1UAEXHLuZsyulVGRolk9DUXc`, `tr_1UAEXILuZsyulVGRe8jBfJpI`) and the second cron run released 0 — the double-pay check, against real Stripe AND the real database. No reserve charged (venue bears the risk), venue share correctly not a payable. The 5th fail: the promoter payable skips because no third onboarded account exists to give the promoter. |

**THE DEFECT — a cancelled show cannot refund any VENUE_DIRECT order.** The
only refund path that exists (`/api/shows/[showId]/cancel`) failed every
venue-direct order (`ordersFailed: 1`, order stays CAPTURED, tickets VALID,
payables PENDING), twice over:

1. `refundTicketPaymentIntent()` runs PLATFORM-scoped, and a venue-direct
   PaymentIntent lives on the VENUE's account. Stripe answers
   `No such payment_intent: 'pi_3UAEW9LuZs8WZJKj0xyH8y3v'` — the account token
   is right there in the id. The refund needs the `stripeAccount` header, from
   the order's own `settlementAccountId`.
2. Even scoped correctly, the cancel route passes
   `wasDestinationCharge: Boolean(order.settlementAccountId)` — true for
   venue-direct too — so it would send `reverse_transfer: true` on a DIRECT
   charge, which has no transfer. Measured directly: `Cannot reverse transfer
   on charge … because it does not have an associated transfer.` The flags are
   mode-specific: a venue-direct refund wants `refund_application_fee: true`
   (return the platform's fee so the venue is not left funding the fan's full
   refund out of its 20%) and NO `reverse_transfer`.

The fix is a money-path change (`refundTicketPaymentIntent` gains a
settlement-mode/account parameter; the cancel route passes the order's) and
wants its own PR with VENUE_DIRECT stage 4 re-run against it.

**Harness fixes made on the way (in `scripts/rehearse-money-path.mts`):**
`payViaApi` searched Checkout Sessions platform-scoped only, so a venue-direct
session — created ON the venue's account, exactly as step 1 proves — was never
found and every purchase failed; it now searches both scopes and creates the
synthetic PaymentIntent in the scope the session lives in. And that synthetic
PI now mirrors the real session's shape per mode (`transfer_data` + fee for
DESTINATION, fee-only for VENUE_DIRECT), because a plain PI made the refund
leg fail on Stripe's side for the harness's reasons rather than the app's.

**Operational notes for the next run:** the app's own per-IP purchase rate
limit accumulates across runs (state persists in wrangler's `--persist-to`
directory) — restart `wrangler dev` with a fresh persist dir when a run
starts answering 429; reset the scratch database between runs
(`stripeConnectAccountId` is unique, so re-seeding trips on the previous
run's rows); and in this sandbox the runner needed the Stripe SDK routed
through the egress proxy plus the env file force-applied over a stale
inherited `STRIPE_SECRET_KEY` (node `--env-file` lets pre-existing
environment win).

**Deliberately not done here:** the dispute walk (`4000 0000 0000 0259` on a
venue-direct and then a destination sale, checking WHOSE balance is debited in
the dashboard) — that is a judgement about money made by a person, per the
card table below.

Rehearsal residue: the sandbox balance drifts negative between runs (each
run's refunds pull from the same pool the top-ups feed). Harmless — the
self-funding step absorbs it.

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

**Both prerequisites now exist (checked 2026-08-28, via the Stripe MCP).** The
test-mode sandbox (`acct_1Ttr6LLuZsyulVGR`, "New business sandbox") holds two
connected accounts with `card_payments` AND `transfers` active,
`charges_enabled`, `payouts_enabled`, and a verified test bank account:
`acct_1U8mdKLuZs8WZJKj` and `acct_1U8mdmLuZsguyf6N`. (Four more sit at
`transfers: inactive` with KYC outstanding — rehearsal/probe residue; fine to
leave.)

**CORRECTED 2026-08-30 — that check trusted the v1 capability view, which this
runbook's own BLOCKER 2 section says lies about v2 accounts, and it lied
here.** Both accounts were merchant-only in the v2 view (no recipient
configuration) and refused real transfers until
`configuration.recipient.capabilities.stripe_balance.stripe_transfers` was
requested via `POST /v2/core/accounts/{id}` — see the step-1-complete section
at the top. Both now genuinely carry it. The working invocation (note THREE
connect-account slots — the script requires three; repeating one is fine):

```bash
STRIPE_SECRET_KEY=sk_test_… \
REHEARSAL_MERCHANT_ACCOUNT=acct_1U8mdKLuZs8WZJKj \
REHEARSAL_CONNECT_ACCOUNTS=acct_1U8mdmLuZsguyf6N,acct_1U8mdKLuZs8WZJKj,acct_1U8mdmLuZsguyf6N \
npm run stripe:rehearsal
```

It could not be run from the sandboxed session that wrote this note: the
session held no raw `sk_test_` key, and the Stripe MCP's write surface
deliberately excludes payment-creation operations.

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

### The webhook must be subscribed to five more events

Added to the handler 2026-08-28 from Stripe's destination-charge and hosted-
onboarding guides. **Code alone is not enough — each has to be ticked on the
endpoint in the dashboard, or the handler never runs.** The registered set was
`payment_intent.*` plus `account.updated`; `checkout.session.completed` and
`.expired` were being handled in code and are worth re-confirming too.

| Event | Why |
|---|---|
| `checkout.session.async_payment_succeeded` | **Money taken, nothing delivered.** `checkout.session.completed` means the customer AUTHORIZED, not that the payment cleared — for ACH, SEPA, Pay by Bank, Boleto or BLIK the outcome is 2-14 days later. Our `payment_status === 'paid'` guard correctly refused to issue a ticket before the funds arrived, and nothing then issued one after. |
| `checkout.session.async_payment_failed` | The seat is held forever otherwise. The session already COMPLETED, so `checkout.session.expired` never fires for it. |
| `charge.dispute.created` | Reports the dispute with a note on which side it lands. Deliberately does not act — see below. |
| `charge.updated` | Detects a **skipped transfer**: if the destination loses its transfer capability during an async payment, Stripe leaves the money on the platform and sets `transfer_data` to null. `DESTINATION` mode writes no payable row for the act, so this is otherwise invisible in every table we have. |

We do not pin `payment_method_types`, so Checkout offers whatever the account
has enabled. If bank debits are on, these paths are live today.

**The dispute handler reports and does not recover, on purpose.** Where a
dispute lands depends on the settlement mode and the two cases are opposites:
`VENUE_DIRECT` debits the venue, and under Stripe-managed risk an
unrecoverable shortfall is Stripe's; `DESTINATION` and `PLATFORM` debit iHYPE.
Stripe's guidance for the second is to recover by reversing the transfer to the
act — real money taken back from a musician, sometimes for a show they played.
That is not a decision an unattended webhook should make.

### Onboarding: two settings worth deciding before the first venue

From Stripe's hosted-onboarding guide.

**`collection_options.fields` is unset, so onboarding is INCREMENTAL.** The
default collects only `currently_due`. Passing `eventually_due` collects
everything up front. Incremental gets a venue onboarded faster; up-front avoids
the failure mode where a venue is verified in March, hits a revenue threshold in
July, and has payouts disabled mid-season for information nobody asked for. For
a venue that will be the merchant of record on real ticket sales, up-front is
probably right. It is one parameter on the account link.

**The return URL means "left the flow", not "finished it".** Stripe says so
outright: it "doesn't mean that all information has been collected". Our return
route now retrieves the account and checks the real capability rather than
trusting the redirect, and an unfinished member is sent to payout settings — but
the reason it must never be trusted is worth keeping written down, because
trusting it is the obvious implementation.

### Stripe's docs confirm the dispute split, first-party

Quoted 2026-08-28. This had rested on a support conversation; it is now
documented, and it is the single claim the settlement design depends on:

> For disputes on payments created using **direct charges**, Stripe debits the
> disputed amount from the **connected account's balance, not your platform's
> balance.** Stripe can bill the dispute fee to either the platform or the
> connected account, depending on the connected account's configuration.

> For disputes where payments were created on your platform using **destination
> charges or separate charges and transfers, with or without `on_behalf_of`**,
> your platform balance is automatically debited for the disputed amount and
> fee.

So `VENUE_DIRECT` moves the dispute to the venue, and `DESTINATION` /
`PLATFORM` leave it with iHYPE. Both halves of the model are confirmed rather
than assumed, and the reserve line is charged on exactly the two modes that
carry the exposure.

Two side notes worth keeping:

**`debit_negative_balances` governs the EXTERNAL account, not the balance.**
The doc says Stripe debits a connected account's external (bank) account "only
if `debit_negative_balances` is set to true". That is a narrower thing than the
risk-management page's "you can't directly debit connected account balances"
under Stripe-managed risk, and the two are easy to conflate. It changes nothing
here — we are not the losses collector, so recovery is Stripe's — but do not
read this paragraph as an argument for re-adding the call.

**A destination charge uses the PLATFORM's payment-method configuration.** The
doc: "Connected accounts using indirect charges without `on_behalf_of` use the
payment method configurations that you set up for charges on your platform."
Since `DESTINATION` deliberately omits `on_behalf_of`, the methods a fan is
offered on that mode are iHYPE's, and on `VENUE_DIRECT` they are the venue's.
That is the switch that decides whether the async bank-debit path is reachable
at all — see the `checkout.session.async_payment_*` handlers.

### MEASURED: the account configuration we ship cannot be created

Probed against a real test-mode sandbox, 2026-08-28, with nine combinations.
This is the first time `createStripeConnectAccount` has been executed against
Stripe at all, and **both of its account shapes are rejected**:

```
recipient + merchant, stripe/stripe, express   (VENUE)
  -> "This account configuration is not supported."
recipient only,       stripe/stripe, express   (ARTIST / PROMOTER)
  -> "Losses collector can only be 'application' for the set of
      configurations this account has."
```

So no artist and no venue could onboard. `stripeConnectAccountId` would never
be set and every payable would sit PENDING forever — the same shape as the
2026-07-14 bug, reported by nothing, because nothing is faulty.

**What the probe established:**

| configuration | dashboard | responsibilities | result |
|---|---|---|---|
| recipient + merchant | `full` | stripe / stripe | **OK** — transfers + card_payments both `restricted` pending KYC |
| merchant only | `full` | stripe / stripe | OK |
| recipient + merchant | `express` | stripe / stripe | not supported |
| merchant only | `express` | stripe / stripe | not supported |
| recipient only | `full` | stripe / stripe | dashboard must be `none` or `express` |
| recipient only | `express` or `none` | stripe / stripe | losses must be `application` |
| recipient only | `express` or `none` | application / application | refused, pointing at the platform profile |

Two conclusions:

**1. A merchant account needs `dashboard: 'full'`, not `'express'`.** Express is
refused whenever Stripe manages losses. Note this contradicts the Connect setup
screen, which said sellers use the Express Dashboard, and contradicts the
`dashboard: 'express'` this codebase ships. A venue getting the full Stripe
Dashboard is arguably right — it is a business with an accountant — but it is
not what was designed.

**2. A recipient-only account is currently impossible**, and the two errors
contradict each other: recipient-only *requires* `application`, and
`application` is refused with *"Please review the responsibilities of managing
losses for connected accounts at /settings/connect/platform-profile"*.

That wording matters. It is the phrasing of an **unfinished profile**, not a
forbidden value — and the platform profile has an outstanding **"Negative
balance liability acknowledgement"** action. The working hypothesis is that
completing it unblocks `application` for recipient accounts, which would keep
artist onboarding light. Until it is completed the choice is:

- give artists the merchant configuration too — one code change, but every
  musician completes full-service-agreement KYC to be *paid*, and becomes a
  merchant they are not; or
- accept `application` losses for recipient accounts — artists stay light,
  iHYPE carries an artist's negative balance, which arises only when a refund
  with `reverse_transfer` outruns their balance.

**RESOLVED, 2026-08-28: the acknowledgement must NOT be signed, so option one
is forced.** Its text was read and it is the platform-managed-risk agreement:

> You'll be liable for seller losses. Stripe will hold reserves on your account
> to cover the total value of negative account balances.

…followed by onboarding review, risk underwriting, risk monitoring systems,
risk actions, seller communication, seller remediation, and support for payment
and risk inquiries. That is the entire list of things this org has said it
cannot do ("we don't HAVE a reserve, at all" / "I don't have the headcount"),
and Stripe would begin holding reserves against the platform balance on
signature. Do not acknowledge it.

So every connected account carries the merchant configuration, and the shipped
configuration is now:

```
configuration: { recipient: { stripe_transfers }, merchant: { card_payments } }
dashboard:     'full'
defaults:      { fees_collector: 'stripe', losses_collector: 'stripe' }
identity:      entity_type company for a VENUE, individual otherwise
```

Verified by creating both shapes against the sandbox: `acct_…` for an
individual artist and for a company venue, each returning `transfers=restricted`
and `card_payments=restricted` — the correct state for an account whose KYC has
not been completed yet.

**MEASURED, same day: the heavier onboarding costs an individual artist zero
extra fields.** The fear driving the recipient-only design was full merchant
KYC for musicians. Measured against the sandbox, an individual account created
bare owes 20 requirement entries; with the platform prefilling the five
merchant-only fields (`mcc`, `statement_descriptor`, `support.phone`,
`business_url`, `product_description`) it owes 15 — and those 15 (name, email,
phone, address, DOB, SSN **last four**, bank account, ToS) are exactly what a
bare payee owes under KYC rules at any processor. `createStripeConnectAccount`
now prefills all of them from the profile (the support phone is collected in
the hosted flow beside the identity phone the member types anyway).

Two mechanics found doing it: `defaults.profile.business_url` is silently
ignored on CREATE and honoured on UPDATE, so the function sets it twice; and
the requirements list recomputes **asynchronously**, so a read immediately
after a write can still show entries the write satisfied — do not treat that
as the prefill failing.

A COMPANY venue still owes real business KYC (EIN, registered name, owners,
representative — ~38 entries). That is inherent to being a business taking
card payments anywhere, not something this design added.

What the heavier onboarding does NOT mean: an act being merchant-CAPABLE does
not make them a merchant. Nothing creates a charge on an act's account —
`createVenueDirectCheckoutSession` is called for the venue only, gated on
`isConnectMerchantReady(venue)`. The capability sits unused, and that is the
price of the payout working at all.

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

**`npm run dev` CANNOT run this rehearsal — measured 2026-08-28.** `src/lib/db.ts`
deliberately loads the wasm/workerd Prisma engine, which does not load under
`next dev` ("The loaded wasm module was unexpectedly undefined"). The app has to
run as the real worker build, which also makes the rehearsal representative:
what runs is byte-for-byte what deploys.

```bash
# 1. A scratch database, migrated to head. The Postgres USER NEEDS A PASSWORD —
#    wrangler's local Hyperdrive rejects a passwordless connection string.
createdb ihype_rehearsal
DATABASE_URL=postgresql://user:pass@…/ihype_rehearsal DIRECT_URL=… npx prisma migrate deploy

# 2. Build and serve the worker with rehearsal vars. STRIPE_ALLOW_TEST_MODE_REHEARSAL
#    is what lets a production BUILD accept a sk_test_ key (payments.ts documents it;
#    lint-source fails the build if wrangler.toml ever defines it). Use Cloudflare's
#    published always-pass Turnstile TEST secret, or purchases fail the bot check.
npm run cf:build
# then wrangler dev against a stripped config carrying:
#   DATABASE_URL, AUTH_SECRET/NEXTAUTH_SECRET, AUTH_URL=http://localhost:8787,
#   STRIPE_SECRET_KEY=sk_test_…, STRIPE_WEBHOOK_SECRET=whsec_<any local value>,
#   CRON_SECRET, FEATURE_ENABLE_TICKET_PAYMENTS="true",
#   STRIPE_ALLOW_TEST_MODE_REHEARSAL="true",
#   TURNSTILE_SECRET_KEY="1x0000000000000000000000000000000AA"
# (scripts/e2e-workerd.mjs is the reference for deriving the config)

# 3. Forward webhooks, or nothing ever captures. `stripe listen` if you have the
#    CLI; otherwise a poller that re-signs /v1/events to localhost with
#    stripe.webhooks.generateTestHeaderString works identically.
stripe listen --forward-to localhost:8787/api/stripe/webhook

# 4. Run it. PLAYWRIGHT_AUTH_COOKIE_SECURE=true — the production build expects
#    the __Secure- cookie name even over http (same as the e2e harness).
PLAYWRIGHT_AUTH_COOKIE_SECURE=true REHEARSAL_BASE_URL=http://localhost:8787 \
DATABASE_URL=… STRIPE_SECRET_KEY=sk_test_… STRIPE_WEBHOOK_SECRET=… \
AUTH_SECRET=… CRON_SECRET=… npm run rehearse:money
```

**REHEARSAL_PAY_MODE=api** exists for machines that cannot point a browser at
checkout.stripe.com (this sandbox's TLS-re-signing proxy is one). Checkout
creates its PaymentIntent lazily — only the hosted form creates it — so API mode
makes the money real directly (a genuine confirmed PaymentIntent, really
refunded later) and synthesizes only the `checkout.session.completed` envelope,
delivered with the same signature scheme as real delivery. On a machine with a
working browser, prefer the default mode, which exercises the real event.

**Then run the walk rather than performing it:**

```bash
DATABASE_URL=… STRIPE_SECRET_KEY=sk_test_… AUTH_SECRET=… CRON_SECRET=… \
  npm run rehearse:money
```

`scripts/rehearse-money-path.mts` performs all seven stages below and asserts
each one against the database. It refuses a non-`sk_test_` key, and refuses a
`DATABASE_URL` that looks like a managed host without "scratch" or "rehearsal"
in its name — it creates orders, voids tickets and moves capacity, and there is
no undo. It does not start Postgres, the app or `stripe listen`: those are three
long-lived processes and a script that owns them is a worse version of three
terminal windows. It checks for each and names the command.

Set `REHEARSAL_VENUE_ACCOUNT` to rehearse `VENUE_DIRECT`, or
`REHEARSAL_ARTIST_ACCOUNT` alone for `DESTINATION`. With neither it exercises
`PLATFORM` and says so — **one run covers one mode**, and the assertions differ
per mode because which shares become payables differs per mode.

Everything up to the first purchase has been exercised (2026-08-28): preflight
refusals, provisioning against a real migrated Postgres, and seeding. Two
schema mistakes were found and fixed doing that — the show needs `isTicketed`
plus non-null `venuePayoutPercent`/`artistPayoutPercent`, which are nullable
with no default, so a show created without them looks complete and answers 400
to every purchase. **From the purchase onward the script is unrun**, because
that needs the running app and a test key. Expect to fix something on the first
real pass; fix it in the script rather than working around it, or the next
person walks it by hand again.

The stages, and what each proves:

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
4. **Cancel a second show** (organizer flow, `reason` one of
   artist/venue/low-sales/other). Buyer-initiated refunds were REMOVED
   2026-08-12 — all sales are final — so cancellation is the only refund path
   that exists, and the original stage here tested a deleted route for two
   weeks. → the unscanned order and its tickets and payables `VOID`, a real
   `stripeRefundId` recorded, the main show's payables untouched.
5. **Scan a ticket first** on one of the cancelled show's orders.
   → that order is SKIPPED by the cancellation, not refunded: still `CAPTURED`,
   no refund id. A scanned ticket is a person who walked in.
6. **End the show** — `status = ENDED` and `startsAt` at least **11 days** back:
   `triggerShowPayouts` holds every payout `PAYOUT_HOLD_DAYS` (10) past the show
   date so the dispute window mostly closes first. Backdating by a day measures
   the hold working, not the payout failing. Then run the cron:
   `curl -H "Authorization: Bearer $CRON_SECRET" localhost:8787/api/cron?job=show-payouts`.
   An entry whose payee has no Connect account is counted `skipped` and stays
   PENDING — correct behaviour, and also why the release leg is only PROVEN
   when a real onboarded account is attached.
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

The one stage the script deliberately does not automate is the **dispute**:
`4000 0000 0000 0259` needs the Stripe dashboard checked afterwards to see
which balance was debited, and that is a judgement about money rather than an
assertion. Walk it by hand, per the card table above.

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
