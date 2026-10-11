import type Stripe from 'stripe';
import { log } from '@/lib/logger';
import { getStripe, isStripeConfigured } from '@/lib/stripe';

export type PlatformPayoutBankStatus =
  | { state: 'unavailable' }
  | { state: 'not_connected'; payoutsEnabled: boolean }
  | {
      state: 'connected';
      bankName: string | null;
      last4: string;
      currency: string;
      accountStatus: string | null;
      defaultForCurrency: boolean;
      payoutsEnabled: boolean;
      payoutInterval: string | null;
      payoutDelayDays: number | null;
    };

/**
 * Reduce Stripe's platform account to the non-sensitive fields the admin UI
 * may display. Routing numbers and full account numbers never cross this
 * boundary, even though Stripe includes them on a bank-account object.
 */
export function summarizePlatformPayoutBank(account: Stripe.Account): PlatformPayoutBankStatus {
  const bank = account.external_accounts?.data.find(
    (externalAccount): externalAccount is Stripe.BankAccount => externalAccount.object === 'bank_account',
  );

  if (!bank) {
    return { state: 'not_connected', payoutsEnabled: account.payouts_enabled };
  }

  const schedule = account.settings?.payouts?.schedule;
  return {
    state: 'connected',
    bankName: bank.bank_name,
    last4: bank.last4,
    currency: bank.currency.toUpperCase(),
    accountStatus: bank.status ?? null,
    defaultForCurrency: bank.default_for_currency ?? false,
    payoutsEnabled: account.payouts_enabled,
    payoutInterval: schedule?.interval ?? null,
    payoutDelayDays: typeof schedule?.delay_days === 'number' ? schedule.delay_days : null,
  };
}

export async function readPlatformPayoutBankStatus(): Promise<PlatformPayoutBankStatus> {
  if (!isStripeConfigured()) return { state: 'unavailable' };

  try {
    // `retrieveCurrent` targets the platform itself; `retrieve(id)` targets a
    // connected seller account. The external-account list is expanded so the
    // UI can identify the default payout destination without a second call.
    const account = await getStripe().accounts.retrieveCurrent({ expand: ['external_accounts'] });
    return summarizePlatformPayoutBank(account);
  } catch (error) {
    log.error(
      '[platform-payout-bank]',
      error instanceof Error ? error : { error: String(error) },
      'Could not read the platform payout bank from Stripe',
    );
    return { state: 'unavailable' };
  }
}
