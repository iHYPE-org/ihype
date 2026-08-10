import { describe, expect, it } from 'vitest';
import {
  IMPERSONATOR_CLAIM,
  readImpersonatorId,
  refusalMessage,
  refusalStatus,
  refuseImpersonation,
} from '@/lib/impersonation';

const OPERATOR = 'op_1';

describe('refuseImpersonation', () => {
  it('allows an ordinary member', () => {
    expect(refuseImpersonation({ id: 'u_1', role: 'FAN' }, OPERATOR)).toBeNull();
    expect(refuseImpersonation({ id: 'u_2', role: 'ARTIST' }, OPERATOR)).toBeNull();
    expect(refuseImpersonation({ id: 'u_3', role: 'VENUE' }, OPERATOR)).toBeNull();
    expect(refuseImpersonation({ id: 'u_4', role: 'ADVERTISER' }, OPERATOR)).toBeNull();
  });

  // The one that matters. An operator who assumed another admin's session
  // would hold ADMIN regardless of the allowlist — clampAdminRole cannot help,
  // because the minted token carries a genuinely admin email.
  it('never allows another administrator', () => {
    expect(refuseImpersonation({ id: 'u_5', role: 'ADMIN' }, OPERATOR)).toBe('target-is-admin');
  });

  it('refuses a missing account', () => {
    expect(refuseImpersonation(null, OPERATOR)).toBe('not-found');
    expect(refuseImpersonation(undefined, OPERATOR)).toBe('not-found');
  });

  it('refuses yourself', () => {
    expect(refuseImpersonation({ id: OPERATOR, role: 'ADMIN' }, OPERATOR)).toBe('target-is-admin');
    expect(refuseImpersonation({ id: OPERATOR, role: 'FAN' }, OPERATOR)).toBe('target-is-self');
  });
});

describe('refusal responses', () => {
  // A missing account and an admin account must be indistinguishable from
  // outside, or the error text becomes an oracle for which accounts are admins.
  it('does not reveal which accounts are administrators', () => {
    expect(refusalMessage('target-is-admin')).toBe(refusalMessage('not-found'));
    expect(refusalStatus('target-is-admin')).toBe(refusalStatus('not-found'));
  });

  it('tells you plainly when the target is yourself', () => {
    expect(refusalMessage('target-is-self')).toMatch(/already signed in/i);
    expect(refusalStatus('target-is-self')).toBe(409);
  });
});

describe('readImpersonatorId', () => {
  it('reads a real operator id', () => {
    expect(readImpersonatorId({ [IMPERSONATOR_CLAIM]: 'op_9' })).toBe('op_9');
  });

  // Anything that is not a non-empty string must read as "not impersonating".
  // A number or an object reaching a user lookup would be a type error at best
  // and a query on attacker-shaped input at worst.
  it('treats anything else as absent', () => {
    expect(readImpersonatorId({})).toBeNull();
    expect(readImpersonatorId(null)).toBeNull();
    expect(readImpersonatorId(undefined)).toBeNull();
    expect(readImpersonatorId({ [IMPERSONATOR_CLAIM]: '' })).toBeNull();
    expect(readImpersonatorId({ [IMPERSONATOR_CLAIM]: 42 })).toBeNull();
    expect(readImpersonatorId({ [IMPERSONATOR_CLAIM]: true })).toBeNull();
    expect(readImpersonatorId({ [IMPERSONATOR_CLAIM]: { id: 'op_9' } })).toBeNull();
    expect(readImpersonatorId({ [IMPERSONATOR_CLAIM]: ['op_9'] })).toBeNull();
  });

  it('ignores unrelated claims', () => {
    expect(readImpersonatorId({ sub: 'u_1', role: 'ADMIN' })).toBeNull();
  });
});
