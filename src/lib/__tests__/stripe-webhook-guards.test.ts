import { describe, expect, it } from 'vitest';
import {
  adEventIsPlatform,
  amountCoversOrder,
  expectedEventAccount,
  holdCoversBudget,
  livemodeMatchesKey,
  ticketOrderMatchesEvent,
} from '../stripe-webhook-guards';

describe('ticketOrderMatchesEvent', () => {
  const venueDirect = { settlementMode: 'VENUE_DIRECT', settlementAccountId: 'acct_venue' };
  const destination = { settlementMode: 'DESTINATION', settlementAccountId: 'acct_artist' };
  const platform = { settlementMode: 'PLATFORM', settlementAccountId: null };

  it('requires a venue-direct order to arrive from the venue account', () => {
    expect(expectedEventAccount(venueDirect)).toBe('acct_venue');
    expect(ticketOrderMatchesEvent(venueDirect, 'acct_venue')).toBe(true);
    expect(ticketOrderMatchesEvent(venueDirect, 'acct_other')).toBe(false);
    expect(ticketOrderMatchesEvent(venueDirect, undefined)).toBe(false);
  });

  it('refuses a connected-account event for an order that settles on the platform', () => {
    // A destination charge is created on the PLATFORM account; the artist's
    // account is only the transfer target, so no event about it carries `account`.
    expect(expectedEventAccount(destination)).toBeNull();
    expect(ticketOrderMatchesEvent(destination, undefined)).toBe(true);
    expect(ticketOrderMatchesEvent(destination, 'acct_artist')).toBe(false);
    expect(ticketOrderMatchesEvent(platform, null)).toBe(true);
    expect(ticketOrderMatchesEvent(platform, 'acct_anyone')).toBe(false);
  });
});

describe('amountCoversOrder', () => {
  it('accepts the exact charge and more, refuses less or unknown', () => {
    expect(amountCoversOrder(4000, 4000)).toBe(true);
    expect(amountCoversOrder(4001, 4000)).toBe(true);
    expect(amountCoversOrder(50, 4000)).toBe(false);
    expect(amountCoversOrder(null, 4000)).toBe(false);
    expect(amountCoversOrder(undefined, 4000)).toBe(false);
    expect(amountCoversOrder(Number.NaN, 4000)).toBe(false);
  });
});

describe('ad campaign events', () => {
  it('only acts on platform-account events whose hold covers the budget', () => {
    expect(adEventIsPlatform(undefined)).toBe(true);
    expect(adEventIsPlatform(null)).toBe(true);
    expect(adEventIsPlatform('acct_venue')).toBe(false);
    expect(holdCoversBudget(12000, 12000)).toBe(true);
    expect(holdCoversBudget(50, 12000)).toBe(false);
    expect(holdCoversBudget(undefined, 12000)).toBe(false);
  });
});

describe('livemodeMatchesKey', () => {
  it('pairs live events with live keys and test events with test keys', () => {
    expect(livemodeMatchesKey(true, 'sk_live_x')).toBe(true);
    expect(livemodeMatchesKey(true, 'rk_live_x')).toBe(true);
    expect(livemodeMatchesKey(false, 'sk_test_x')).toBe(true);
    expect(livemodeMatchesKey(false, 'sk_live_x')).toBe(false);
    expect(livemodeMatchesKey(true, 'sk_test_x')).toBe(false);
    expect(livemodeMatchesKey(true, undefined)).toBe(false);
  });
});
