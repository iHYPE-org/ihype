import type Stripe from 'stripe';
import { describe, expect, it } from 'vitest';
import { summarizePlatformPayoutBank } from '../platform-payout-bank';

function account(overrides: Partial<Stripe.Account> = {}): Stripe.Account {
  return {
    object: 'account',
    payouts_enabled: true,
    external_accounts: {
      object: 'list',
      data: [],
      has_more: false,
      url: '/v1/accounts/acct_test/external_accounts',
    },
    ...overrides,
  } as Stripe.Account;
}

describe('platform payout bank summary', () => {
  it('returns only masked bank details needed by the admin console', () => {
    const result = summarizePlatformPayoutBank(account({
      external_accounts: {
        object: 'list',
        data: [{
          object: 'bank_account',
          bank_name: 'I3 BANK',
          last4: '2121',
          currency: 'usd',
          status: 'verified',
          default_for_currency: true,
          routing_number: 'sensitive-routing-number',
          account: 'acct_test',
          account_holder_name: null,
          account_holder_type: null,
          available_payout_methods: ['standard'],
          country: 'US',
          customer: null,
          fingerprint: null,
          id: 'ba_test',
          metadata: {},
        } as Stripe.BankAccount],
        has_more: false,
        url: '/v1/accounts/acct_test/external_accounts',
      },
      settings: {
        payouts: {
          debit_negative_balances: false,
          schedule: { delay_days: 2, interval: 'daily' },
          statement_descriptor: null,
        },
      } as Stripe.Account.Settings,
    }));

    expect(result).toEqual({
      state: 'connected',
      bankName: 'I3 BANK',
      last4: '2121',
      currency: 'USD',
      accountStatus: 'verified',
      defaultForCurrency: true,
      payoutsEnabled: true,
      payoutInterval: 'daily',
      payoutDelayDays: 2,
    });
    expect(result).not.toHaveProperty('routing_number');
    expect(result).not.toHaveProperty('account');
  });

  it('distinguishes a configured Stripe account with no payout bank', () => {
    expect(summarizePlatformPayoutBank(account({ payouts_enabled: false }))).toEqual({
      state: 'not_connected',
      payoutsEnabled: false,
    });
  });
});
