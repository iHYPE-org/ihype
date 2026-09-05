import Stripe from 'stripe';
import { readRuntimeEnv } from '@/lib/runtime-env';
import { calculateDestinationChargeSplit, calculateDirectChargeApplicationFee } from '@/lib/ticketing';
import { log } from '@/lib/logger';
import { planAdSettlement, type AdSettlementPlan } from '@/lib/ad-settlement-plan';
export { STRIPE_MINIMUM_CHARGE_CENTS } from '@/lib/ad-settlement-plan';

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = readRuntimeEnv('STRIPE_SECRET_KEY');
    if (!key?.startsWith('sk_')) throw new Error('STRIPE_SECRET_KEY is not configured with a valid secret key.');
    /* Moves with the SDK, and is not free to choose. `Stripe.LatestApiVersion`
       is a SINGLE-LITERAL type in each release, so bumping the `stripe` package
       forces this string forward and typecheck fails until it matches — which
       is how the 22.3.2 -> 22.5.0 bump in #753, and the 22.5.0 -> 22.6.0 bump
       that moved this to 2026-08-26.dahlia, both turned up as a red PR rather
       than a silent behaviour change.
       Worth knowing that it IS a behaviour change and not a version label: an
       API version fixes response shapes and defaults, so what actually
       verifies this is the Stripe-side rehearsal in
       docs/runbooks/money-path-rehearsal.md, not this file compiling. Live mode
       still holds zero PaymentIntents, so nothing in production has ever
       depended on the old version's shapes.
       NOT re-rehearsed against Stripe for 2026-08-26.dahlia: that needs a real
       `sk_test_` key, and this sandbox carries the 11-character placeholder.
       Both versions are in the same `dahlia` train, where breaking changes
       arrive with a new NAME rather than a new date, so the exposure is small
       — but small is not measured. Run `npm run stripe:rehearsal` from the
       operator's machine before the first live sale, which the runbook already
       requires for other reasons. */
    /* `httpClient` is REQUIRED in a Workers runtime, not an optimisation.
       stripe-node picks its transport by sniffing for Node, and OpenNext
       polyfills `process` in workerd — so without this the SDK selects its
       node:https client, which runs on a shim and never completes a request.
       Measured 2026-08-28 in the money-path rehearsal: every ticket purchase
       hung for the SDK's full 80s timeout and answered 500, on the first run
       this code ever made a Stripe call from inside a worker. Nothing in
       production had ever exercised an outbound Stripe call, so nothing had
       ever caught it. The fetch client is Stripe's own documented client for
       Cloudflare Workers, and `fetch` is native in every runtime this app
       has (workerd, Node 18+, vitest). */
    _stripe = new Stripe(key, {
      apiVersion: '2026-08-26.dahlia',
      httpClient: Stripe.createFetchHttpClient(),
    });
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
      /* REQUIRED, and its absence made this route a hard 500 for every member
         (found by the alpha acceptance walk, 2026-08-31). In setup mode
         Checkout offers dynamic payment methods, and without an explicit
         `payment_method_types` it needs a currency to decide which ones the
         account can present — so Stripe answers
         "Missing required param: currency" and nothing is ever saved.
         Verified both ways against real test-mode Stripe with production URLs:
         identical call minus this line fails, plus this line returns a URL.
         Nothing caught it earlier because saving a card is only reachable once
         paid ticketing is on, which it became the day before. */
      currency: 'usd',
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

/**
 * Every merchant-only requirement Stripe would otherwise put in front of the
 * member is PREFILLED here, and that is what keeps the heavier account shape
 * from costing the member anything. Measured 2026-08-28 against a real
 * sandbox: an individual account created bare owes 20 requirement entries;
 * created with these prefills it owes 15 — and those 15 (name, email, phone,
 * address, DOB, SSN last-4, bank account, ToS) are exactly what a bare PAYEE
 * owes under money-laundering rules. The merchant configuration's marginal
 * cost to the member is zero fields. The one merchant field not prefilled is
 * `support.phone`, because we do not know their phone at creation; the hosted
 * flow collects it beside the identity phone they type anyway.
 */
function merchantPrefill(profileType: string, profileName: string) {
  const isVenue = profileType.toUpperCase() === 'VENUE';
  /* Statement descriptor rules: 5-22 chars, and it is what a FAN's bank
     statement shows on a venue-direct sale — so it should name the venue the
     fan bought from, not iHYPE. Sanitised to the character set Stripe accepts;
     the IHYPE prefix keeps short names above the 5-char floor and gives an
     unfamiliar name context, which is the cheapest chargeback prevention
     there is. For an artist the descriptor is inert (nothing ever charges on
     their account) but Stripe requires it regardless. */
  const descriptor = `IHYPE ${profileName}`
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, '')
    .replace(/ +/g, ' ')
    .trim()
    .slice(0, 22);
  return {
    /* MCC is a card-network category code. 7922 is "Theatrical Producers and
       Ticket Agencies" — a venue selling tickets to its own shows. 7929 is
       "Bands, Orchestras, and Miscellaneous Entertainers". Honest for each,
       and never something to ask a musician to look up. */
    mcc: isVenue ? '7922' : '7929',
    statement_descriptor: { descriptor },
  };
}

export async function createStripeConnectAccount({
  email,
  profileId,
  profileType,
  profileName,
  profileUrl,
}: {
  email: string;
  profileId: string;
  profileType: string;
  /** Public display name — becomes the statement descriptor a fan's bank shows. */
  profileName: string;
  /** Absolute URL of the profile's public page, e.g. https://ihype.org/venues/x. */
  profileUrl: string;
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
  const isVenue = profileType.toUpperCase() === 'VENUE';
  const account = await stripe.v2.core.accounts.create({
    contact_email: email,
    /* `full`, NOT `express`, AND EVERY ACCOUNT GETS THE MERCHANT CONFIGURATION.
     * Both of those are forced by Stripe, and both contradict what this file
     * said until 2026-08-28. Measured against a real sandbox — nine
     * combinations, tabulated in docs/runbooks/money-path-rehearsal.md — after
     * the shipped version turned out to create NO account at all:
     *
     *   recipient + merchant, express  ->  "This account configuration is not
     *                                      supported."
     *   recipient only,       express  ->  "Losses collector can only be
     *                                      'application' for the set of
     *                                      configurations this account has."
     *
     * Only `recipient + merchant` with `dashboard: 'full'` and Stripe as both
     * collectors is accepted. Express is refused whenever Stripe manages
     * losses, whatever the Connect setup screen says.
     *
     * WHY AN ARTIST NOW CARRIES `merchant` TOO, having deliberately not.
     *
     * The old reasoning was sound and is worth keeping: a payee is not a
     * merchant, and asking a solo musician for full-service-agreement KYC to
     * be handed 70% of a door split is asking them to take on a role they are
     * not in. It is unavailable, not abandoned. A recipient-only account
     * REQUIRES `losses_collector: 'application'`, and `application` requires
     * accepting the platform-managed-risk agreement — which reads: "You'll be
     * liable for seller losses. Stripe will hold reserves on your account",
     * plus risk underwriting, monitoring, remediation and risk support.
     *
     * That is the whole of what this org cannot do (owner, 2026-08-27: "we
     * don't HAVE a reserve, at all" / "I don't have the headcount"). Heavier
     * onboarding for an act is a real cost; platform liability with no reserve
     * behind it is not a cost, it is the failure. So the trade is made
     * knowingly and in that direction.
     *
     * Note what does NOT follow: an act being merchant-CAPABLE does not make
     * them a merchant. Nothing ever creates a charge on their account —
     * `createVenueDirectCheckoutSession` is called for the venue and only the
     * venue, and the ticket route gates it on `isConnectMerchantReady(venue)`.
     * The capability sits unused, which is the price of the payout working. */
    dashboard: 'full',
    /* A venue is a business; an artist signing up alone is usually not. Getting
       this wrong sends the payee through the wrong identity questions and
       strands onboarding partway with no obvious cause. */
    identity: { country: 'us', entity_type: isVenue ? 'company' : 'individual' },
    configuration: {
      recipient: {
        capabilities: { stripe_balance: { stripe_transfers: { requested: true } } },
      },
      merchant: {
        capabilities: { card_payments: { requested: true } },
        ...merchantPrefill(profileType, profileName),
      },
    },
    defaults: {
      currency: 'usd',
      /* The member's public iHYPE page is their business URL, and the
         description is what they are actually doing here. Both are merchant
         requirements Stripe would otherwise ask the member to type.
         `business_url` is ALSO re-set via update below: measured 2026-08-28,
         the create call accepts it silently and the requirement stays open,
         while the same value through `accounts.update` clears it. */
      profile: {
        business_url: profileUrl,
        product_description: 'Live music performances and ticketed shows on iHYPE.',
      },
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

  /* Re-set the business URL through update. Measured 2026-08-28: the create
     call accepts `defaults.profile.business_url` without error and the
     requirement stays open anyway; the identical value through
     `accounts.update` clears it. Best-effort — if this fails the member types
     one URL during onboarding rather than being blocked here. */
  await stripe.v2.core.accounts
    .update(account.id, { defaults: { profile: { business_url: profileUrl } } })
    .catch(() => {});

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
        /* ALWAYS BOTH, as of 2026-08-28. Every account is created with the
           merchant configuration because Stripe does not accept a
           recipient-only account under this platform's risk settings (see
           `createStripeConnectAccount`), and a link naming fewer
           configurations than the account has collects only those
           requirements — the member completes a flow, is told it is done, and
           a capability never activates. `merchantOnboarding` is kept as a
           parameter so callers keep documenting intent, and so the day a
           recipient-only account becomes possible again there is one place to
           change. */
        configurations: ['recipient', 'merchant'],
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
/**
 * The transfer already made for a payable entry, if one exists.
 *
 * `createPayoutTransfer` is idempotent on `payable-entry:<id>`, but Stripe
 * keeps idempotency keys for 24 hours and the payout job runs daily — so if a
 * transfer succeeded and the RELEASED write that follows it failed (a pooler
 * hiccup is enough), the next run would read the entry as PENDING and Stripe
 * would create a SECOND transfer. Every transfer carries the entry id in its
 * metadata and the show in its transfer group, so the job asks first
 * (security sweep, 2026-09-02).
 */
export async function findPayoutTransfer({
  payableEntryId,
  showId,
}: {
  payableEntryId: string;
  showId: string;
}): Promise<string | null> {
  const stripe = getStripe();
  const transfers = await stripe.transfers.list({ transfer_group: `show:${showId}`, limit: 100 });
  const match = transfers.data.find((transfer) => transfer.metadata?.payableEntryId === payableEntryId);
  return match?.id ?? null;
}

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

export async function cancelTicketPaymentIntent(
  paymentIntentId: string,
  /* A VENUE_DIRECT order's PaymentIntent lives ON the venue's account, so a
     platform-scoped cancel cannot find it — the same scoping that broke the
     refund path (see refundTicketPaymentIntent). RESERVED orders rarely carry
     an intent id at all (Checkout creates it lazily), but when one does, the
     caller passes the order's settlementAccountId for a venue-direct order. */
  stripeAccountId?: string | null,
): Promise<void> {
  const stripe = getStripe();
  await stripe.paymentIntents.cancel(
    paymentIntentId,
    {},
    { idempotencyKey: `cancel:${paymentIntentId}`, ...(stripeAccountId ? { stripeAccount: stripeAccountId } : {}) },
  );
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
  /* The refund's shape follows the order's SETTLEMENT MODE, and the caller
     passes the order's own stored fields rather than a pre-digested boolean.
     The boolean this replaces (`wasDestinationCharge: Boolean(settlementAccountId)`)
     was wrong for VENUE_DIRECT twice over, measured against real Stripe in the
     step-2 rehearsal (2026-08-30): the PaymentIntent lives ON the venue's
     account, so the platform-scoped refund answered "No such payment_intent"
     — every cancelled venue-direct order silently failed to refund — and even
     scoped correctly, `reverse_transfer: true` is rejected on a direct charge
     ("does not have an associated transfer").

     Deliberately NOT inferred from the PaymentIntent. Reading it back would be
     a second network call on a path that already has the answer stored on the
     order, and inferring money behaviour from a remote read is how the
     `charges_enabled` mix-up happened. */
  options: { settlementMode?: string; settlementAccountId?: string | null } = {},
): Promise<string> {
  const stripe = getStripe();
  /* Same discriminants as buildPayableEntries() in ticket-order-state.ts —
     the two files must not disagree about what a mode means. A legacy row
     with an account id but no recorded mode is treated as a destination
     charge, exactly as the old boolean did. */
  const venueIsMerchant = options.settlementMode === 'VENUE_DIRECT';
  const artistWasRouted =
    options.settlementMode === 'DESTINATION' ||
    Boolean(options.settlementAccountId && options.settlementMode !== 'VENUE_DIRECT');
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
       * and no longer does; see the note in `createStripeConnectAccount`. */
      ...(artistWasRouted ? { reverse_transfer: true, refund_application_fee: true } : {}),
      /* On a VENUE-DIRECT refund the refund is debited from the VENUE (they
       * are the merchant), so the platform returns its application fee — the
       * artist's 70% and the promoter's 10% it was carrying — or the venue
       * would be funding the fan's whole refund out of the 20% it kept.
       * There is no transfer to reverse on a direct charge. */
      ...(venueIsMerchant ? { refund_application_fee: true } : {}),
    },
    // The key carries the amount: a partial refund followed by a different
    // partial refund on the same intent is two distinct operations, and
    // sharing a key would silently return the first one's result.
    {
      idempotencyKey: `refund:${paymentIntentId}:${amountCents ?? 'full'}`,
      /* THE HEADER IS THE OTHER HALF OF THE FIX: a direct charge's
       * PaymentIntent exists only on the venue's account. */
      ...(venueIsMerchant && options.settlementAccountId
        ? { stripeAccount: options.settlementAccountId }
        : {}),
    }
  );
  return refund.id;
}

/**
 * Ad campaign checkout — CHARGED UP FRONT (2026-09-02, owner decision; see
 * `ad-settlement-plan.ts`). A Checkout Session in `mode: 'payment'` needs no
 * client-side Stripe.js/Elements integration (the advertiser is redirected to
 * Stripe's own hosted page) — a good fit for a self-serve B2B flow with no
 * card-collection UI in this codebase.
 *
 * This used to set `payment_intent_data.capture_method: 'manual'` so the
 * budget was only AUTHORISED and captured at the end of the run
 * (DESIGN_SYNC row 234). A card authorisation lives about seven days; runs go
 * to ninety and a pause was unbounded, so every campaign longer than a week
 * delivered its impressions and then could not be billed. Now the whole
 * budget is captured at checkout, like the ticket session, and settlement
 * REFUNDS the unspent remainder. There is no manual-capture path left in the
 * codebase; `settleAdCampaign` still knows how to close a hold opened before
 * this change.
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
}): Promise<{ paymentIntentId: string | null; checkoutUrl: string; sessionId: string }> {
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
        metadata: { adId },
      },
      metadata: { adId, purpose: 'ad_campaign' },
      success_url: `${baseUrl}/advertise/dashboard?checkout=success`,
      cancel_url: `${baseUrl}/advertise/dashboard?checkout=cancelled`,
    },
    { idempotencyKey: idempotencyKey ?? `ad-checkout:${adId}` },
  );

  /* THE PAYMENT INTENT IS NULL HERE, ALWAYS, AND THIS USED TO THROW ON IT.
     Checkout creates its PaymentIntent LAZILY — only once the payer submits
     the hosted form — so `session.payment_intent` is null at creation for
     every session in payment mode. Measured against real test-mode Stripe on
     2026-08-31: `payment_intent: null`, session url present. The old
     `throw new Error('Checkout session did not return a payment intent id.')`
     therefore fired on EVERY ad campaign that cleared vetting, so the route
     answered 500 and no advertiser could ever pay. This codebase already knew
     the intent was lazy — scripts/rehearse-money-path.mts says so for tickets
     — but the ad path was written as though it were not.

     The id is picked up later instead: the campaign's PaymentIntent carries
     `metadata.adId` (set through `payment_intent_data` above), and the webhook
     resolves the campaign from that and backfills the column. */
  return {
    paymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : null,
    checkoutUrl: session.url ?? '',
    sessionId: session.id,
  };
}

/**
 * Closes a campaign's money at the end of its run, on cancellation, or after
 * a long pause. Reads the PaymentIntent and lets `planAdSettlement` decide:
 * a campaign charged up front gets `budget - spent` REFUNDED; a hold opened
 * before 2026-09-02 (`requires_capture`) is captured for the spend or
 * released under Stripe's minimum. Idempotent per intent through the keys,
 * and the caller stamps `settledAt` whatever the plan was, which is what stops
 * the daily retry.
 *
 * Returns what actually happened so the advertiser can be told the truth —
 * "refunded $75.00" and "charged $45.00" are different sentences.
 */
export async function settleAdCampaign(
  paymentIntentId: string,
  spentCents: number,
  budgetCents: number,
): Promise<AdSettlementResult> {
  const stripe = getStripe();
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
  const plan = planAdSettlement({
    intentStatus: intent.status,
    amountReceivedCents: intent.amount_received,
    spentCents,
    budgetCents,
  });
  let refundId: string | null = null;
  switch (plan.action) {
    case 'refund': {
      // The refund id is what the advertiser can quote to their bank, so it
      // is returned for the caller to persist rather than left in Stripe.
      const refund = await stripe.refunds.create(
        { payment_intent: paymentIntentId, amount: plan.amountCents, reason: 'requested_by_customer', metadata: { purpose: 'ad_campaign_unspent' } },
        { idempotencyKey: `ad-settle-refund:${paymentIntentId}:${plan.amountCents}` },
      );
      refundId = refund.id;
      break;
    }
    case 'capture':
      await stripe.paymentIntents.capture(
        paymentIntentId,
        { amount_to_capture: plan.amountCents },
        { idempotencyKey: `ad-settle-capture:${paymentIntentId}` },
      );
      break;
    case 'release':
      await stripe.paymentIntents.cancel(paymentIntentId, {}, { idempotencyKey: `ad-settle-cancel:${paymentIntentId}` });
      break;
    case 'none':
      break;
  }
  return { plan, refundId };
}

/** What settlement did, plus the Stripe refund it can be traced by (null when nothing was refunded). */
export type AdSettlementResult = { plan: AdSettlementPlan; refundId: string | null };

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

/**
 * "Secret unreadable" is not "signature invalid", and collapsing them cost a
 * misdiagnosis in production: on 2026-08-30, ~8% of webhook deliveries hit a
 * request whose `getCloudflareContext().env` came back empty, so the secret —
 * which IS set — could not be read for that one invocation. The generic throw
 * below was caught by the route's signature-failure branch, logged to Sentry
 * as "Invalid webhook signature", and answered 400 — a terminal verdict for a
 * transient platform fault. A typed error lets the route answer 503 instead,
 * which Stripe treats as retryable; the retry arrives as a fresh invocation
 * with a fresh context, which is the only retry that can actually help here.
 */
export class WebhookSecretUnavailableError extends Error {
  constructor() {
    super('STRIPE_WEBHOOK_SECRET could not be read from the runtime environment.');
    this.name = 'WebhookSecretUnavailableError';
  }
}

/**
 * Verifies against the platform endpoint's secret and, when one is configured,
 * the Connect endpoint's (`STRIPE_CONNECT_WEBHOOK_SECRET`). A platform endpoint
 * and a "listen to events on connected accounts" endpoint are two endpoints in
 * the Stripe dashboard with two signing secrets; with one secret here, whichever
 * endpoint is not configured is answered 400 forever and its events — venue-
 * direct ticket sales, or the platform's own ad authorizations — never land.
 * Tries the platform secret first; the last signature error is the one thrown.
 */
export function constructWebhookEvent(payload: string, signature: string): Stripe.Event {
  const stripe = getStripe();
  const secrets = [readRuntimeEnv('STRIPE_WEBHOOK_SECRET'), readRuntimeEnv('STRIPE_CONNECT_WEBHOOK_SECRET')]
    .filter((value): value is string => Boolean(value));
  if (secrets.length === 0) throw new WebhookSecretUnavailableError();
  let lastError: unknown = null;
  for (const secret of secrets) {
    try {
      return stripe.webhooks.constructEvent(payload, signature, secret);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Invalid webhook signature.');
}
