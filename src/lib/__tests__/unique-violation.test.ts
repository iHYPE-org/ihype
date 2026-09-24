/** A lost double-tap race is the state the member asked for (row 513). */
import { describe, expect, it } from 'vitest';
import { isUniqueViolation } from '@/lib/unique-violation';

describe('isUniqueViolation', () => {
  it('recognises Prisma P2002 and nothing else', () => {
    expect(isUniqueViolation({ code: 'P2002' })).toBe(true);
    expect(isUniqueViolation({ code: 'P2025' })).toBe(false);
    expect(isUniqueViolation(new Error('boom'))).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
  });
});
