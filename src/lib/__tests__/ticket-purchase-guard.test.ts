import { describe, expect, it } from 'vitest';
import {
  MAX_TICKETS_PER_SHOW_PER_ACCOUNT,
  isSuspiciousPurchase,
  resolvePurchaseAllowance,
} from '@/lib/ticket-purchase-guard';

describe('resolvePurchaseAllowance', () => {
  it('allows a first purchase up to the cap', () => {
    expect(resolvePurchaseAllowance(0, 1).allowed).toBe(true);
    expect(resolvePurchaseAllowance(0, MAX_TICKETS_PER_SHOW_PER_ACCOUNT).allowed).toBe(true);
  });

  it('refuses one more than the cap in a single order', () => {
    const result = resolvePurchaseAllowance(0, MAX_TICKETS_PER_SHOW_PER_ACCOUNT + 1);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(MAX_TICKETS_PER_SHOW_PER_ACCOUNT);
  });

  it('counts tickets already held across earlier orders', () => {
    // The whole point: the per-order cap alone let one account repeat until it
    // held far more than the cap for a single show.
    expect(resolvePurchaseAllowance(6, 2).allowed).toBe(true);
    expect(resolvePurchaseAllowance(6, 3).allowed).toBe(false);
    expect(resolvePurchaseAllowance(8, 1).allowed).toBe(false);
  });

  it('reports how many remain, so the buyer can adjust rather than guess', () => {
    const result = resolvePurchaseAllowance(6, 5);
    expect(result.remaining).toBe(2);
    expect(result.reason).toContain('2 more');
    expect(result.reason).toContain('8 per person');
  });

  it('says something different when the account is already at the cap', () => {
    const result = resolvePurchaseAllowance(8, 1);
    expect(result.remaining).toBe(0);
    expect(result.reason).toContain('already have 8');
  });

  it('gets the singular right — an error that reads as broken English reads as a bug', () => {
    expect(resolvePurchaseAllowance(7, 2).reason).toContain('1 more ticket');
    expect(resolvePurchaseAllowance(7, 2).reason).not.toContain('1 more tickets');
    expect(resolvePurchaseAllowance(1, 99).reason).toContain('7 more tickets');
  });

  it('refuses a non-positive quantity without claiming a cap was hit', () => {
    expect(resolvePurchaseAllowance(0, 0).allowed).toBe(false);
    expect(resolvePurchaseAllowance(0, 0).reason).toContain('at least one');
  });

  it('treats a negative or nonsense held count as zero rather than granting extra', () => {
    // A bad count must never open MORE headroom than the cap allows.
    expect(resolvePurchaseAllowance(-5, 8).allowed).toBe(true);
    expect(resolvePurchaseAllowance(-5, 9).allowed).toBe(false);
    expect(resolvePurchaseAllowance(Number.NaN, 9).allowed).toBe(false);
  });

  it('honours a custom cap, for a future per-show override', () => {
    expect(resolvePurchaseAllowance(0, 4, 4).allowed).toBe(true);
    expect(resolvePurchaseAllowance(0, 5, 4).allowed).toBe(false);
    expect(resolvePurchaseAllowance(2, 2, 4).allowed).toBe(true);
  });
});

describe('isSuspiciousPurchase', () => {
  it('flags anything that did not pass the human check', () => {
    expect(isSuspiciousPurchase({ accountAgeMinutes: 10_000, humanVerified: false })).toBe(true);
  });

  it('flags a brand-new account even when it passed', () => {
    expect(isSuspiciousPurchase({ accountAgeMinutes: 2, humanVerified: true })).toBe(true);
  });

  it('does not flag an established, verified buyer', () => {
    expect(isSuspiciousPurchase({ accountAgeMinutes: 60, humanVerified: true })).toBe(false);
    expect(isSuspiciousPurchase({ accountAgeMinutes: null, humanVerified: true })).toBe(false);
  });
});
