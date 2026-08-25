import { describe, expect, it } from 'vitest';
import {
  TRANSFER_CODE_LENGTH,
  createTransferCode,
  formatTransferCode,
  isTransferCodeLive,
  normalizeTransferCode,
} from '@/lib/ticket-transfer-code';

describe('createTransferCode', () => {
  it('is the documented length and drops every confusable letter', () => {
    for (let i = 0; i < 200; i += 1) {
      const code = createTransferCode();
      expect(code).toHaveLength(TRANSFER_CODE_LENGTH);
      // I, L, O and U must never appear, or the normalizer's confusable
      // mapping would rewrite a legitimately generated code into a different
      // one and no code containing them could ever be claimed.
      expect(code).not.toMatch(/[ILOU]/);
      expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]+$/);
    }
  });

  it('reaches every symbol in the alphabet, so no code space is unreachable', () => {
    /* The rejection-sampling branch in createTransferCode CANNOT fire while the
       alphabet is 32 symbols: the limit computes to exactly 256, so no byte is
       ever out of range. It is there so that changing ALPHABET to a length that
       does not divide 256 cannot quietly bias codes toward its first letters —
       an inert guard today, deliberately kept. A first version of this test
       asserted the branch DID fire and failed for exactly that reason.

       What is worth pinning is the mapping: every byte value must land on a
       symbol, and all 32 must be reachable, or part of the keyspace is dead. */
    const seen = new Set<string>();
    for (let byte = 0; byte < 256; byte += 1) {
      seen.add(createTransferCode(() => new Uint8Array(8).fill(byte))[0]);
    }
    expect(seen.size).toBe(32);
  });

  it('maps a byte to the alphabet rather than to a raw character code', () => {
    // Byte 0 is the first symbol; nothing clever, but it pins the mapping so a
    // future change to ALPHABET has to be deliberate.
    expect(createTransferCode(() => new Uint8Array(8).fill(0))).toBe('00000000');
  });
});

describe('normalizeTransferCode', () => {
  it('accepts what a person actually types', () => {
    expect(normalizeTransferCode('ABCD-2345')).toBe('ABCD2345');
    expect(normalizeTransferCode('abcd2345')).toBe('ABCD2345');
    expect(normalizeTransferCode(' ABCD 2345 ')).toBe('ABCD2345');
  });

  it('applies Crockford confusables, so an l for a 1 still claims the ticket', () => {
    expect(normalizeTransferCode('l2345678')).toBe('12345678');
    expect(normalizeTransferCode('I2345678')).toBe('12345678');
    expect(normalizeTransferCode('O2345678')).toBe('02345678');
  });

  it('refuses anything it cannot read, rather than guessing', () => {
    // Wrong length either way — a claim must not match a DIFFERENT valid code
    // because a character was silently dropped.
    expect(normalizeTransferCode('ABC123')).toBeNull();
    expect(normalizeTransferCode('ABCD23456')).toBeNull();
    // U is not in the alphabet, so it is a typo rather than a confusable.
    expect(normalizeTransferCode('UBCD2345')).toBeNull();
    expect(normalizeTransferCode('ABCD_345')).toBeNull();
    expect(normalizeTransferCode('')).toBeNull();
  });

  it('round-trips a generated code through its own display form', () => {
    for (let i = 0; i < 50; i += 1) {
      const code = createTransferCode();
      expect(normalizeTransferCode(formatTransferCode(code))).toBe(code);
    }
  });
});

describe('isTransferCodeLive', () => {
  const now = new Date('2026-08-25T12:00:00Z');

  it('is live only while unclaimed and unexpired', () => {
    expect(isTransferCodeLive({ expiresAt: new Date('2026-08-26T12:00:00Z'), claimedAt: null }, now)).toBe(true);
    expect(isTransferCodeLive({ expiresAt: new Date('2026-08-24T12:00:00Z'), claimedAt: null }, now)).toBe(false);
    expect(isTransferCodeLive({ expiresAt: new Date('2026-08-26T12:00:00Z'), claimedAt: now }, now)).toBe(false);
  });

  it('treats the exact expiry instant as expired', () => {
    // A boundary that reads either way in a comparison is the kind of thing
    // that lets one extra claim through; pinned deliberately.
    expect(isTransferCodeLive({ expiresAt: now, claimedAt: null }, now)).toBe(false);
  });
});
