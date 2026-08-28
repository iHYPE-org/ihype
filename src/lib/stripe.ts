import Stripe from 'stripe';
import { readRuntimeEnv } from '@/lib/runtime-env';
import { calculateDestinationChargeSplit, calculateDirectChargeApplicationFee } from '@/lib/ticketing';
import { log } from '@/lib/logger';

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = readRuntimeEnv('STRIPE_SECRET_KEY');
    if (!key?.startsWith('sk_')) throw new Error('STRIPE_SECRET_KEY is not configured with a valid secret key.');
    /* Moves with the SDK, and is not free to choose. `Stripe.LatestApiVersion`
       is a SINGLE-LITERAL type in each release, so bumping the `stripe` package
       forces this string forward and typecheck fails until it matches — which
       is how the 22.3.2 -> 22.5.0 bump in #753 turned up as a red PR rather
       than a silent behaviour change.
       Worth knowing that it IS a behaviour change and not a version label: an
       API version fixes response shapes and defaults, so what actually
       verifies this is the Stripe-side rehearsal in
       docs/runbooks/money-path-rehearsal.md, not this file compiling. Live mode
       still holds zero PaymentIntents, so nothing in production has ever
       depended on the old version's shapes. */
    _stripe = new Stripe(key, { apiVersion: '2026-07-29.dahlia' });
  }
  return _stripe;
}

export function isStripeConfigured(): boolean {
  return Boolean(readRuntimeEnv('STRIPE_SECRET_KEY')?.startsWith('sk_'));
}

export async function getOrCreateStripeCustomer({
  userId,
  email,
  name,
  existingCustomerId
}: {
  userId: string;
  email: string;
  name: string | null;
  existingCustomerId: string | null | undefined;
}): Promise<string> {
  const stripe = getStripe();
  if (existingCustomerId) return existingCustomerId;

  const customer = await stripe.customers.create({
    email,
    name: name ?? undefined,
    metadata: { userId }
  });
  return customer.id;
}

export async function createPaymentMethodSetupSession({
  userId,
  stripeCustomerId,
  returnPath,
}: {
  userId: string;
  stripeCustomerId: string;
  returnPath: string;
}): Promise<string> {
  const stripe = getStripe();
  const baseUrl = readRuntimeEnv('NEXT_PUBLIC_APP_URL') ?? 'http://localhost:3000';
  const session = await stripe.checkout.sessions.create(
    {
      mode: 'setup',
      customer: stripeCustomerId,
      setup_intent_data: { metadata: { userId } },
      metadata: { purpose: 'ticket_payment_method', userId },
      success_url: `${baseUrl}${returnPath}${returnPath.includes('?') ? '&' : '?'}payment_method=saved`,
      cancel_url: `${baseUrl}${returnPath}${returnPath.includes('?') ? '&' : '?'}payment_method=cancelled`,
    },
    { idempotencyKey: `payment-method-setup:${userId}:${Date.now()}` },
  );

  if (!session.url) throw new Error('Stripe did not return a payment-method setup URL.');
  return session.url;
}

export async function createStripeConnectAccount({
  email,
  profileId,
  profileType
}: {
  email: string;
  profileId: string;
  profileType: string;
}): Promise<string> {
  const stripe = getStripe();
  /* ACCOUNTS V2, and v1 is not a fallback — it is CLOSED.
     `stripe.accounts.create({ type: 'express' })` returns an error, not a
     warning: "Stripe no longer recommends Accounts v1 for new Connect
     integrations." Verified 2026-08-26 by running the old call verbatim
     against a Connect-enabled test account. While it stood, no artist, venue
     or promoter could onboard at all, `stripeConnectAccountId` was never set,
     and every payable entry would have sat PENDING forever.

     WHICH CONFIGURATIONS DEPEND ON WHAT THE ACCOUNT HAS TO DO.

     A VENUE is the MERCHANT on its own shows: the ticket charge is created on
     its account (`createVenueDirectCheckoutSession`), so it needs `merchant`
     with `card_payments`. That is only available on the FULL service
     agreement, which means fuller KYC — and it is the whole point rather than
     a cost, because with the merchant role go the disputes, the tax and the
     customer relationship that iHYPE has neither the capital nor the headcount
     to carry.

     An ARTIST or PROMOTER only ever RECEIVES money, so `recipient` alone is
     right and their onboarding stays light. Asking a solo musician to complete
     merchant KYC to be handed 70% of a door split would be asking them to take
     on a role they are not in.

     RECIPIENT-ONLY WAS BRIEFLY THE ANSWER FOR EVERYONE, and this is a
     deliberate partial reversal.

     For a day `merchant` was requested for EVERY account, to support a
     destination charge settled with `on_behalf_of`. That was dropped along
     with `on_behalf_of` itself (owner: "Let's keep iHYPE as the name on the
     purchase"), and the reasoning is worth keeping because it looked like a
     clear win at the time and the same argument will be made again:

       - `on_behalf_of` moved the SETTLEMENT MERCHANT and no risk whatsoever.
         Stripe debits disputes from the platform "with or without" it.
       - It put the act's legal name on the fan's card statement — often not
         the name on the poster — which is the single most common trigger for
         a "I don't recognise this" chargeback. So it plausibly INCREASED the
         disputes iHYPE was going to pay for anyway.
       - `card_payments` is only available on the FULL service agreement, so
         it cost every act heavier KYC than a payee needs.

     Dropping it kept the whole benefit — `transfer_data.destination` still
     routes the act's share atomically — and gave back the lighter onboarding.
     The two are separate Stripe parameters and always were.

     The venue `merchant` configuration below is NOT that idea returning. It
     exists because the venue genuinely IS the merchant on a direct charge, not
     to relabel whose name appears on a charge iHYPE is settling.

     `stripe_balance.stripe_transfers` is the capability a transfer destination
     needs. Do not reach for the legacy `transfers` capability: it is a
     different thing wearing a near-identical name, and `GET /v1/accounts` will
     happily report `transfers: "active"` for an account whose v2 recipient
     capabilities are empty and which Stripe refuses to transfer to. That
     misreading cost real debugging.

     `dashboard` is required whenever the transfers capability is requested,
     and the error saying so arrives only after everything else validates.
     `responsibilities` names the platform for both fees and losses, which is
     what Stripe tells marketplaces on indirect charges to do — and is honest:
     iHYPE carries the chargebacks. */
  const isMerchant = profileType.toUpperCase() === 'VENUE';
  const account = await stripe.v2.core.accounts.create({
    contact_email: email,
    dashboard: 'express',
    /* A venue is a business; an artist signing up alone is usually not. Getting
       this wrong sends the payee through the wrong identity questions and
       strands onboarding partway with no obvious cause. */
    identity: { country: 'us', entity_type: isMerchant ? 'company' : 'individual' },
    configuration: {
      recipient: {
        capabilities: { stripe_balance: { stripe_transfers: { requested: true } } },
      },
      ...(isMerchant
        ? { merchant: { capabilities: { card_payments: { requested: true } } } }
        : {}),
    },
    defaults: {
      currency: 'usd',
      /* MATCHES THE PLATFORM'S OWN CONNECT CONFIGURATION, confirmed at signup
         on 2026-08-27: "Sellers will collect payments directly" and "Stripe
         will manage risk and be liable if sellers can't pay back losses — even
         if those losses result from fraud."
         `losses_collector: 'stripe'` is the whole reason this design is viable
         for a platform with no reserve: when a venue's balance goes negative
         from a dispute and cannot be recovered, STRIPE absorbs it rather than
         iHYPE. Setting `'application'` here — which this line did until today —
         would hand that liability straight back, quietly, on an account that
         looks correctly configured.
         `fees_collector: 'stripe'` because on a direct charge Stripe deducts
         its processing fee from the venue's own side of the transaction. That
         is what makes the venue's 20% arrive whole and iHYPE's application fee
         exactly the two onward shares. It also moves the DISPUTE FEE onto the
         venue — Stripe's table is explicit that `fees_collector: 'application'`
         bills the platform for it and every other value bills the connected
         account. The venue disclosure in PayoutSettingsPanel says so in
         so many words; do not change one without the other.

         THIS DIVERGES FROM STRIPE'S PUBLISHED RECOMMENDATION FOR THE
         DESTINATION-CHARGE ACCOUNTS, DELIBERATELY. Read this before "fixing"
         it, because the docs will look like they are on the other side.

         Stripe says: "If you use destination charges with an Account, we
         recommend that you set both `losses_collector` and `fees_collector` to
         `application`", and separately that assigning losses to Stripe "doesn't
         absolve your platform of responsibility for its own balance". Both are
         true and neither is an argument for `application` HERE:

           - `losses_collector` governs the CONNECTED ACCOUNT's negative
             balance and nothing else. On a destination charge the disputed
             amount hits the PLATFORM balance, which this setting cannot touch
             either way. So `application` would not move a cent of the exposure
             the recommendation is about — it would only decide who eats an
             ARTIST's negative balance, which happens when a refund with
             `reverse_transfer` outruns their balance. `stripe` puts that on
             Stripe. `application` puts it on a platform with no reserve.
           - What the recommendation actually buys is recovery LEVERS —
             account debits, payout pauses, connected-account reserves — all of
             which require platform liability and all of which iHYPE has said
             it does not want and cannot staff.

         So the recommendation optimises for a marketplace that wants control
         and can fund it. This one wants neither. If that ever changes, change
         BOTH values together: Stripe rejects `losses_collector: 'application'`
         with `fees_collector: 'stripe'`. */
      responsibilities: { fees_collector: 'stripe', losses_collector: 'stripe' },
    },
    metadata: { profileId, profileType },
  });
  /* `debit_negative_balances` USED TO BE SET HERE AND IS DELETED, not moved.
   *
   * It made Stripe recover a negative balance from the payee's own bank, which
   * mattered while iHYPE was liable for those balances. It is not merely
   * unnecessary now — it is incompatible: under Stripe-managed risk a platform
   * that is not liable cannot debit its connected accounts at all, and Stripe
   * handles recovery itself.
   *
   * The old call was a v1 `accounts.update` against a v2 account and was
   * flagged in the runbook as never having executed anywhere. It never will.
   * Recorded rather than silently dropped because "make sure we can debit the
   * account" reads like an obviously good idea to anyone who has not read the
   * platform's risk configuration. */

  return account.id;
}

/**
 * Whether Stripe will actually accept a transfer to this account.
 *
 * This is the question `stripeConnectOnboarded` is meant to answer, and the
 * old signal answered a different one: the webhook set the flag from
 * `account.charges_enabled`, which is about accepting CARD PAYMENTS. A
 * recipient that has completed onboarding and can receive every transfer we
 * will ever send it still reports `charges_enabled: false`, because iHYPE
 * never asks for `card_payments`. So the flag could not become true, the
 * "Verified" pill in payout settings could never light up, and the Connect
 * health cron would have flagged every correctly-onboarded account as broken.
 *
 * Returns false rather than throwing on a Stripe error: a failed lookup means
 * "not proven ready", and the caller's job is to keep the member's own view
 * honest, not to abort their page.
 */
export async function isConnectPayoutReady(connectAccountId: string): Promise<boolean> {
  try {
    const stripe = getStripe();
    const account = await stripe.v2.core.accounts.retrieve(connectAccountId, {
      include: ['configuration.recipient'],
    });
    const transfers =
      account.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers;
    return transfers?.status === 'active';
  } catch {
    return false;
  }
}

/**
 * Whether Stripe will accept a CHARGE created on this account — the venue-direct
 * question, which is a different one from `isConnectPayoutReady` above.
 *
 * The two capabilities are not a ladder and one does not imply the other. An
 * account can be fully payout-ready (`recipient` complete, transfers active)
 * and completely unable to be the merchant on a charge, because `card_payments`
 * lives on the `merchant` configuration behind the full service agreement and
 * heavier KYC. Only a VENUE is ever asked for it.
 *
 * Using the payout check to gate venue-direct — which is what the ticket route
 * did until 2026-08-28 — picks the mode on the wrong evidence. A venue that
 * completed recipient onboarding only would be selected as merchant, and
 * `createVenueDirectCheckoutSession` would then be rejected by Stripe for a
 * missing capability, failing a purchase whose inventory was already reserved.
 * The failure lands on the fan, at the last step, for a venue's paperwork.
 *
 * Same failure posture as the payout check: false on any error, because "not
 * proven" and "not ready" must lead to the same conservative branch.
 */
export async function isConnectMerchantReady(connectAccountId: string): Promise<boolean> {
  try {
    const stripe = getStripe();
    /* `include` is not optional. Accounts v2 returns an unrequested property as
       null "regardless of their actual value", so omitting it here would read
       null and report every venue as not-ready — a silent, permanent fallback
       to platform settlement that nothing else would flag. */
    const account = await stripe.v2.core.accounts.retrieve(connectAccountId, {
      include: ['configuration.merchant'],
    });
    return account.configuration?.merchant?.capabilities?.card_payments?.status === 'active';
  } catch {
    return false;
  }
}

export async function createConnectOnboardingUrl({
  connectAccountId,
  returnUrl,
  refreshUrl,
  merchantOnboarding = false,
}: {
  connectAccountId: string;
  returnUrl: string;
  refreshUrl: string;
  /** True for a VENUE, which is the merchant on its own shows and so needs the
   *  `merchant` configuration collected too. See createStripeConnectAccount. */
  merchantOnboarding?: boolean;
}): Promise<string> {
  const stripe = getStripe();
  /* v2 link for a v2 account — v1's `accountLinks.create` cannot onboard one,
     so this moved with the account creation above and not separately. The
     `configurations` list has to match what the account was created with. */
  const link = await stripe.v2.core.accountLinks.create({
    account: connectAccountId,
    use_case: {
      type: 'account_onboarding',
      account_onboarding: {
        /* Must match what the account was created with. A link naming a
           configuration the account does not have collects the wrong
           requirements and the capability never activates — silently, after a
           flow the member completed and believes is finished.
           `merchant` is requested for venues only; see
           `createStripeConnectAccount`. */
        configurations: merchantOnboarding ? ['recipient', 'merchant'] : ['recipient'],
        refresh_url: refreshUrl,
        return_url: returnUrl,
      },
    },
  });
  return link.url;
}

/**
 * The ticket purchase — a DESTINATION CHARGE settled on behalf of the act when
 * one is settlement-ready, and a platform-settled charge when not.
 *
 * ## Why the act's share is routed by Stripe rather than paid out later
 *
 * On a destination charge Stripe moves the whole charge to the destination and
 * pulls `application_fee_amount` back to the platform. So the act's 70% never
 * passes through iHYPE's balance: it does not depend on a payout cron running,
 * on a later transfer succeeding, or on the platform being solvent in between.
 *
 * iHYPE remains the SETTLEMENT MERCHANT — `on_behalf_of` is deliberately not
 * set. The fan buys from iHYPE, sees iHYPE on their statement, and the act's
 * share is still routed atomically. Those are separate parameters; only the
 * second one is worth having. See `createStripeConnectAccount` for why the
 * first was tried and dropped.
 *
 * ## The warning that came with the old code, which still applies
 *
 * A destination charge supports exactly ONE connected account, and omitting
 * `transfer_data.amount` sends the ENTIRE charge to it — this codebase's
 * 2026-07-14 bug, which routed 100% of every sale to a single party. The fix is
 * not to route the whole charge but to claim the rest back as an application
 * fee, computed by `calculateDestinationChargeSplit` as `total - destination`:
 * that and `venue + promoter + tax + fee` are equal only while every component
 * is accounted for, and a subtraction cannot silently omit one. An addition
 * that forgot the tax would not fail — it would quietly overpay the act out of
 * money owed to a tax authority.
 *
 * ## What it does not do
 *
 * It does not move dispute liability, and nothing available in Stripe does
 * while the split is still routed: Stripe debits disputes from the PLATFORM
 * account on a destination charge "with or without on_behalf_of". iHYPE
 * carries chargebacks; recovery is a best-effort transfer reversal, and the
 * fund behind it starts empty. See docs/runbooks/money-path-rehearsal.md.
 *
 * ## The fallback is not an error path
 *
 * `destinationAccountId` is optional. With no settlement-ready account this
 * behaves exactly as it did before — platform-settled, split afterwards through
 * `AccountsPayableEntry` — which is why that machinery stays. A fan is never
 * blocked by the act's paperwork.
 */
export async function createTicketCheckoutSession({
  amountCents,
  stripeCustomerId,
  showId,
  showSlug,
  showTitle,
  quantity,
  ticketOrderConfirmationCode,
  destinationAccountId,
  destinationPayoutCents,
}: {
  amountCents: number;
  stripeCustomerId: string;
  showId: string;
  showSlug: string;
  showTitle: string;
  quantity: number;
  ticketOrderConfirmationCode: string;
  /** The act's Connect account, when `isConnectPayoutReady` says so. */
  destinationAccountId?: string | null;
  /** What that account keeps, of FACE VALUE. Required with the account. */
  destinationPayoutCents?: number;
}): Promise<{ checkoutUrl: string; checkoutSessionId: string }> {
  const stripe = getStripe();
  const baseUrl = readRuntimeEnv('NEXT_PUBLIC_APP_URL') ?? 'http://localhost:3000';

  /* Both or neither. An account with no amount would make Stripe transfer the
     ENTIRE charge — the 2026-07-14 bug exactly — so this refuses rather than
     defaulting, and refuses before the fan ever reaches a payment page. */
  const routed = destinationAccountId
    ? calculateDestinationChargeSplit({
        totalChargeCents: amountCents,
        destinationPayoutCents: destinationPayoutCents ?? -1,
      })
    : null;

  const session = await stripe.checkout.sessions.create(
    {
      mode: 'payment',
      customer: stripeCustomerId,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: amountCents,
          product_data: {
            name: `${quantity} × ${showTitle}`,
            metadata: { showId },
          },
        },
      }],
      payment_intent_data: {
        /* `transfer_data` and `application_fee_amount`, and deliberately NOT
           `on_behalf_of` — see the account-creation note above. The routing is
           the part worth having; the settlement-merchant switch moved no risk,
           put an unfamiliar legal name on the fan's statement, and made every
           act complete heavier KYC. iHYPE stays the name on the purchase. */
        ...(routed && destinationAccountId
          ? {
              transfer_data: { destination: destinationAccountId },
              application_fee_amount: routed.applicationFeeCents,
            }
          : {}),
        metadata: {
          confirmationCode: ticketOrderConfirmationCode,
          showId,
          // Recorded on the intent so a reconciliation can tell a destination
          // charge from a platform-settled one without re-deriving it.
          settlementMode: routed ? 'destination' : 'platform',
        },
      },
      metadata: {
        purpose: 'ticket_purchase',
        confirmationCode: ticketOrderConfirmationCode,
        showId,
      },
      success_url: `${baseUrl}/shows/${showSlug}?checkout=success`,
      cancel_url: `${baseUrl}/shows/${showSlug}?checkout=cancelled`,
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    },
    { idempotencyKey: `ticket-checkout:${ticketOrderConfirmationCode}` },
  );
  if (!session.url) throw new Error('Stripe did not return a ticket checkout URL.');
  return { checkoutUrl: session.url, checkoutSessionId: session.id };
}

/**
 * VENUE-DIRECT: the charge is created on the venue's own Stripe account, and
 * the venue is the merchant of record.
 *
 * ## Why this mode exists
 *
 * Owner, 2026-08-27: "I don't have money to give in the case of fraud, I don't
 * have the headcount to handle taxes, I don't have the headcount to handle
 * ticket support. I just want the lowest fees possible to pass on to buyers,
 * and a way to split the payouts."
 *
 * Every other arrangement fails at least one of those. A platform-settled
 * charge makes iHYPE the merchant, so iHYPE carries disputes it cannot fund and
 * a tax obligation it has nobody to file. A full ticketing platform takes the
 * merchant role and 11-17% with it, and cannot split three ways. A direct
 * charge is the only shape that moves the merchant role onto someone with a
 * bank account and an accountant while keeping the 70/20/10 enforced in code.
 *
 * ## The flow runs the opposite way to a destination charge
 *
 * `Stripe-Account` puts the charge on the venue. Stripe deducts its own fee AND
 * the application fee from that account; the venue keeps the remainder. So the
 * platform does not decide what the venue receives — it decides what it TAKES,
 * and `calculateDirectChargeApplicationFee` claims exactly the two onward
 * shares and nothing else. See that function for why it is a sum rather than
 * `total - venue`.
 *
 * ## What moves with the merchant role
 *
 * All of it, and this is the entire point:
 *   - DISPUTES. "Direct charges occur on a connected account, so negative
 *     transactions for direct charges affect the connected account's balance."
 *     iHYPE is not debited. There is no protection reserve on this mode, and
 *     `calculateTicketOrderFinancials({ platformBearsRisk: false })` is what
 *     stops one being charged — a fee with no cost behind it is the one thing
 *     the fee design refuses to do.
 *   - TAX. The venue is the seller, so the venue remits. The application fee
 *     does not grow by a cent when tax is collected.
 *   - STRIPE'S REAL CUT, including the Amex gap `stripe-fees.ts` documents. An
 *     Amex order leaves the venue a few cents under 20%. Tell venues that
 *     rather than letting them find it in a reconciliation.
 *
 * ## What does NOT move
 *
 * Product support. "Where is my ticket", transfers and the QR are iHYPE's,
 * because they are iHYPE's product. Only the money-side support — refunds and
 * disputes, which the venue sees in their own Stripe dashboard — goes with the
 * merchant role.
 *
 * ## Costs worth knowing before extending this
 *
 * Charges live on the CONNECTED ACCOUNT, not the platform. Any later lookup
 * needs the same `stripeAccount` option, webhooks arrive per-account, and
 * platform-level exports will not show these payments. Checkout also renders
 * the VENUE's branding, which is arguably right — a fan recognises the venue
 * they are going to — but it is not iHYPE's.
 */
export async function createVenueDirectCheckoutSession({
  amountCents,
  venueAccountId,
  artistPayoutCents,
  promoterPayoutCents,
  showId,
  showSlug,
  showTitle,
  quantity,
  ticketOrderConfirmationCode,
}: {
  amountCents: number;
  /** The venue's Connect account. The charge is created ON this account. */
  venueAccountId: string;
  artistPayoutCents: number;
  promoterPayoutCents: number;
  showId: string;
  showSlug: string;
  showTitle: string;
  quantity: number;
  ticketOrderConfirmationCode: string;
}): Promise<{ checkoutUrl: string; checkoutSessionId: string }> {
  const stripe = getStripe();
  const baseUrl = readRuntimeEnv('NEXT_PUBLIC_APP_URL') ?? 'http://localhost:3000';

  const { applicationFeeCents } = calculateDirectChargeApplicationFee({
    artistPayoutCents,
    promoterPayoutCents,
    totalChargeCents: amountCents,
  });

  const session = await stripe.checkout.sessions.create(
    {
      mode: 'payment',
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: amountCents,
          product_data: { name: `${quantity} × ${showTitle}`, metadata: { showId } },
        },
      }],
      payment_intent_data: {
        application_fee_amount: applicationFeeCents,
        metadata: {
          confirmationCode: ticketOrderConfirmationCode,
          showId,
          settlementMode: 'venue_direct',
        },
      },
      metadata: {
        purpose: 'ticket_purchase',
        confirmationCode: ticketOrderConfirmationCode,
        showId,
        settlementMode: 'venue_direct',
      },
      success_url: `${baseUrl}/shows/${showSlug}?checkout=success`,
      cancel_url: `${baseUrl}/shows/${showSlug}?checkout=cancelled`,
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    },
    {
      /* THE HEADER IS THE WHOLE DIFFERENCE. Without `stripeAccount` this is an
         ordinary platform charge with a nonsensical application fee, and iHYPE
         silently becomes the merchant again — the exact failure this mode
         exists to prevent, and one that would look completely normal until the
         first chargeback arrived. */
      stripeAccount: venueAccountId,
      /* Scoped to the account too: the same confirmation code could otherwise
         collide across venues, and an idempotency key is only as safe as its
         uniqueness. */
      idempotencyKey: `ticket-direct:${venueAccountId}:${ticketOrderConfirmationCode}`,
    },
  );
  if (!session.url) throw new Error('Stripe did not return a ticket checkout URL.');
  return { checkoutUrl: session.url, checkoutSessionId: session.id };
}

/**
 * Real per-party payout — one Stripe transfer from the platform balance to
 * a venue or artist Connect account, for exactly their payable share of one
 * captured ticket order (an `AccountsPayableEntry` row). Idempotent per
 * entry via `transfer_group` + the entry's own id as the idempotency key,
 * so a retried payout run can never double-pay the same entry.
 */
export async function createPayoutTransfer({
  amountCents,
  connectAccountId,
  payableEntryId,
  showId,
  description
}: {
  amountCents: number;
  connectAccountId: string;
  payableEntryId: string;
  showId: string;
  description: string;
}): Promise<string> {
  const stripe = getStripe();
  const transfer = await stripe.transfers.create(
    {
      amount: amountCents,
      currency: 'usd',
      destination: connectAccountId,
      transfer_group: `show:${showId}`,
      description,
      metadata: { payableEntryId, showId }
    },
    { idempotencyKey: `payable-entry:${payableEntryId}` }
  );
  return transfer.id;
}

/**
 * Make sure a ticket's PaymentIntent is captured, and tolerate its already
 * being so.
 *
 * `/api/shows/[showId]/ticketing/open` captures the reserved orders for a show
 * when the organiser opens ticketing — a design that assumes the charge was
 * only AUTHORIZED until then. It was written against `createTicketPaymentIntent`,
 * which used `capture_method: 'manual'` and no longer exists: the live path is
 * `createTicketCheckoutSession`, which sets no capture method at all, so a
 * ticket captures the moment the fan pays.
 *
 * So by the time this runs the intent is normally already `succeeded`, and a
 * bare `capture()` answers `payment_intent_unexpected_state` — turning the
 * whole open-ticketing run into a row of failures for orders where nothing is
 * wrong and the money is already in hand.
 *
 * Treating that state as success is right under either capture mode, because
 * the postcondition this function promises is "captured", not "captured by
 * this call". The caller then finalises the order exactly as it would have.
 *
 * NOTE the open product question this does not answer: whether pre-sale
 * reservations should hold an authorization at all. If they should, the ticket
 * session needs `capture_method: 'manual'` while ticketing is closed AND the
 * webhook must stop finalising those orders on `checkout.session.completed`.
 * That is a deliberate decision, not a repair, so it is not made here.
 */
export async function captureTicketPaymentIntent(paymentIntentId: string): Promise<void> {
  const stripe = getStripe();
  try {
    await stripe.paymentIntents.capture(paymentIntentId, {}, { idempotencyKey: `capture:${paymentIntentId}` });
  } catch (error) {
    /* Re-read rather than pattern-matching the message: the only acceptable
       reason to swallow a capture failure is that the money is genuinely
       captured, and the intent itself is the authority on that. Anything else
       rethrows, so a real failure still stops the run. */
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId).catch(() => null);
    if (intent?.status !== 'succeeded') throw error;
  }
}

export async function cancelTicketPaymentIntent(paymentIntentId: string): Promise<void> {
  const stripe = getStripe();
  await stripe.paymentIntents.cancel(paymentIntentId, {}, { idempotencyKey: `cancel:${paymentIntentId}` });
}

/**
 * Full refund of a captured ticket order. Safe to call against the
 * PaymentIntent directly (rather than needing to reverse a transfer) as
 * long as no payout has happened yet — true by construction here, since
 * `triggerShowPayouts` only ever transfers money for ENDED shows, and this
 * is only ever called for orders more than 48h before their show starts.
 */
/**
 * Refunds a ticket order.
 *
 * `amountCents` is REQUIRED and is not a convenience. Stripe keeps its
 * processing fee on a refund — the money is already gone — so refunding the
 * full charge returns the buyer a fee Stripe never gives back, and the
 * difference comes out of the platform. iHYPE is a nonprofit that absorbs no
 * fee of any kind, so the caller states what is actually being returned:
 * normally face value plus taxes, with the processing fee retained because it
 * was consumed the moment the card was charged.
 *
 * Passing `null` refunds everything, which is a deliberate choice a caller has
 * to make in the open rather than the default it used to be.
 */
export async function refundTicketPaymentIntent(
  paymentIntentId: string,
  amountCents: number | null,
  options: { wasDestinationCharge?: boolean } = {},
): Promise<string> {
  const stripe = getStripe();
  const refund = await stripe.refunds.create(
    {
      payment_intent: paymentIntentId,
      ...(amountCents !== null ? { amount: amountCents } : {}),
      /* PULL THE ACT'S SHARE BACK TOO, on a destination charge.
       *
       * Stripe's default on a charge with `transfer_data.destination` is that
       * the destination KEEPS what it was transferred and the platform eats
       * the whole refund — so a refunded $18 ticket would return $18 to the
       * fan out of a balance that only ever received $6.25 of it, and the act
       * would keep their $12.60 for a show the fan is no longer attending.
       * Every refund would be a net loss of roughly the artist's share.
       *
       * `reverse_transfer` reverses proportionally, and
       * `refund_application_fee` returns the platform's share proportionally
       * as well, so a partial refund unwinds each party by the same fraction.
       * Stripe requires the transfer reversal whenever the application fee is
       * refunded, which is why these two are one flag here rather than two.
       *
       * If the act's balance cannot cover it they go negative — and under the
       * platform's Stripe-managed risk configuration that is STRIPE's loss to
       * recover, not iHYPE's. This used to depend on `debit_negative_balances`
       * and no longer does; see the note in `createStripeConnectAccount`.
       *
       * Deliberately NOT inferred from the PaymentIntent. Reading it back
       * would be a second network call on a path that already has the answer
       * stored on the order, and inferring money behaviour from a remote read
       * is how the `charges_enabled` mix-up happened. */
      ...(options.wasDestinationCharge
        ? { reverse_transfer: true, refund_application_fee: true }
        : {}),
    },
    // The key carries the amount: a partial refund followed by a different
    // partial refund on the same intent is two distinct operations, and
    // sharing a key would silently return the first one's result.
    { idempotencyKey: `refund:${paymentIntentId}:${amountCents ?? 'full'}` }
  );
  return refund.id;
}

/**
 * Pre-auth-then-capture ad campaign billing (DESIGN_SYNC row 234). A
 * Checkout Session in `mode: 'payment'` needs no client-side Stripe.js/
 * Elements integration (the advertiser is redirected to Stripe's own
 * hosted page) — a good fit for a self-serve B2B flow with no existing
 * card-collection UI in this codebase. `payment_intent_data.capture_method:
 * 'manual'` means the session's underlying PaymentIntent only ever
 * authorizes the full quoted budget; Stripe creates that PaymentIntent
 * synchronously, so its id is available immediately, before the advertiser
 * ever completes checkout.
 *
 * This is the ONLY manual-capture path in the codebase. This docstring used to
 * say it was "the same shape the ticket checkout session uses"; the ticket
 * session sets no capture method and captures on payment. See
 * `captureTicketPaymentIntent` for what that mismatch broke.
 */
export async function createAdCampaignCheckoutSession({
  adId,
  amountCents,
  title,
  advertiserEmail,
  idempotencyKey,
}: {
  adId: string;
  amountCents: number;
  title: string;
  advertiserEmail: string | null;
  /** Defaults to one session per ad. Pass a fresh value (e.g. a timestamp)
   *  when the advertiser explicitly asks to retry — otherwise Stripe dedupes
   *  against the first (possibly abandoned/expired) session. */
  idempotencyKey?: string;
}): Promise<{ paymentIntentId: string; checkoutUrl: string }> {
  const stripe = getStripe();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://ihype.org';

  const session = await stripe.checkout.sessions.create(
    {
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: amountCents,
            product_data: { name: `iHYPE ad campaign — ${title}` },
          },
          quantity: 1,
        },
      ],
      customer_email: advertiserEmail ?? undefined,
      payment_intent_data: {
        capture_method: 'manual',
        metadata: { adId },
      },
      metadata: { adId },
      success_url: `${baseUrl}/advertise/dashboard?checkout=success`,
      cancel_url: `${baseUrl}/advertise/dashboard?checkout=cancelled`,
    },
    { idempotencyKey: idempotencyKey ?? `ad-checkout:${adId}` },
  );

  if (typeof session.payment_intent !== 'string') {
    throw new Error('Checkout session did not return a payment intent id.');
  }

  return { paymentIntentId: session.payment_intent, checkoutUrl: session.url ?? '' };
}

/**
 * Captures only the actual delivered spend, never the full authorized
 * budget — the point of pre-auth-then-capture. Called at campaign end (the
 * settlement cron) or on early self-serve cancellation, in both cases with
 * whatever `spentCents` really is at that moment. Stripe rejects a capture
 * of 0, so a campaign that ran without ever serving an impression is
 * cancelled (releasing the hold) instead of captured.
 */
export async function settleAdCampaignAuthorization(paymentIntentId: string, spentCents: number): Promise<void> {
  const stripe = getStripe();
  if (spentCents <= 0) {
    await stripe.paymentIntents.cancel(paymentIntentId, {}, { idempotencyKey: `ad-settle-cancel:${paymentIntentId}` });
    return;
  }
  await stripe.paymentIntents.capture(
    paymentIntentId,
    { amount_to_capture: spentCents },
    { idempotencyKey: `ad-settle-capture:${paymentIntentId}` },
  );
}

/**
 * Deletes a Stripe Connect Express account, ending its ability to receive
 * future payouts. Called on account erasure (privacy-actions.ts) so an
 * erased identity can't keep collecting money after "deletion." Stripe
 * refuses deletion while a balance or pending payout exists — that's
 * surfaced to the caller rather than swallowed, since it means a human
 * needs to resolve the balance before the account can actually be closed.
 */
export async function deauthorizeStripeConnectAccount(connectAccountId: string): Promise<void> {
  const stripe = getStripe();
  // v2 accounts close rather than delete; `accounts.del` is the v1 verb and
  // does not apply to an account created by `createStripeConnectAccount`.
  await stripe.v2.core.accounts.close(connectAccountId, {
    applied_configurations: ['recipient'],
  });
}

export function constructWebhookEvent(payload: string, signature: string): Stripe.Event {
  const stripe = getStripe();
  const secret = readRuntimeEnv('STRIPE_WEBHOOK_SECRET');
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET is not configured.');
  return stripe.webhooks.constructEvent(payload, signature, secret);
}
