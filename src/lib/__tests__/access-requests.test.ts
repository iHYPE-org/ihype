import { describe, expect, it } from 'vitest';
import {
  canApproveAccessRequest,
  describeAccessRequestState,
  generateInviteCode,
  normaliseRequestEmail,
  orderAccessRequests,
} from '@/lib/access-requests';

describe('access request state', () => {
  it('separates a stored decision from what the operator is looking at', () => {
    expect(describeAccessRequestState('PENDING', false)).toBe('waiting');
    expect(describeAccessRequestState('APPROVED', false)).toBe('approved');
    expect(describeAccessRequestState('DECLINED', false)).toBe('declined');
  });

  it('reports an address that now has an account as signed up, whatever the stored status', () => {
    // The self-clearing property the workbench queue has always had: somebody
    // who got in another way is not waiting on anyone, and must not be sent a
    // fresh single-use code.
    expect(describeAccessRequestState('PENDING', true)).toBe('signed-up');
    expect(describeAccessRequestState('APPROVED', true)).toBe('signed-up');
  });

  it('keeps a declined request declined even if that person later signs up', () => {
    // Otherwise a decision the operator made would silently disappear from the
    // record the moment the person got in by another door.
    expect(describeAccessRequestState('DECLINED', true)).toBe('declined');
  });

  it('offers approval only for a request that is actually waiting', () => {
    expect(canApproveAccessRequest('waiting')).toBe(true);
    expect(canApproveAccessRequest('signed-up')).toBe(false);
    expect(canApproveAccessRequest('approved')).toBe(false);
    expect(canApproveAccessRequest('declined')).toBe(false);
  });
});

describe('orderAccessRequests', () => {
  const at = (iso: string) => new Date(iso);

  it('puts what is actionable first, oldest wait first inside that', () => {
    const rows = [
      { id: 'newer-waiting', state: 'waiting' as const, createdAt: at('2026-09-05T00:00:00Z') },
      { id: 'declined', state: 'declined' as const, createdAt: at('2026-08-01T00:00:00Z') },
      { id: 'oldest-waiting', state: 'waiting' as const, createdAt: at('2026-09-01T00:00:00Z') },
      { id: 'approved', state: 'approved' as const, createdAt: at('2026-08-15T00:00:00Z') },
      { id: 'signed-up', state: 'signed-up' as const, createdAt: at('2026-08-10T00:00:00Z') },
    ];
    expect(orderAccessRequests(rows).map((r) => r.id)).toEqual([
      'oldest-waiting',
      'newer-waiting',
      'approved',
      'signed-up',
      'declined',
    ]);
  });

  it('does not mutate the array it was given', () => {
    const rows = [
      { state: 'declined' as const, createdAt: at('2026-08-01T00:00:00Z') },
      { state: 'waiting' as const, createdAt: at('2026-09-01T00:00:00Z') },
    ];
    orderAccessRequests(rows);
    expect(rows[0].state).toBe('declined');
  });
});

describe('normaliseRequestEmail', () => {
  it('lower-cases and trims, so one person is one row', () => {
    expect(normaliseRequestEmail('  Someone@Example.COM ')).toBe('someone@example.com');
  });

  it('refuses anything that is not usably an address', () => {
    // A row with no reachable address is one nobody could ever action.
    expect(normaliseRequestEmail('')).toBeNull();
    expect(normaliseRequestEmail('nobody')).toBeNull();
    expect(normaliseRequestEmail('@example.com')).toBeNull();
    expect(normaliseRequestEmail('someone@')).toBeNull();
    expect(normaliseRequestEmail('two words@example.com')).toBeNull();
    expect(normaliseRequestEmail(null)).toBeNull();
    expect(normaliseRequestEmail(42)).toBeNull();
    expect(normaliseRequestEmail(`${'a'.repeat(200)}@example.com`)).toBeNull();
  });
});

describe('generateInviteCode', () => {
  it('mints an upper-case 12-character hex code', () => {
    const code = generateInviteCode();
    expect(code).toMatch(/^[0-9A-F]{12}$/);
  });

  it('does not repeat itself', () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateInviteCode()));
    expect(codes.size).toBe(50);
  });
});
