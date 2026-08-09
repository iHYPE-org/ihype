import { describe, expect, it } from 'vitest';
import { firstAskByEmail, formatAge, orderByUrgency, stillWaiting, type WorkbenchQueue } from '@/lib/admin-workbench';

function q(over: Partial<WorkbenchQueue> & { id: string }): WorkbenchQueue {
  return {
    label: over.id,
    detail: '',
    href: '/admin',
    count: 0,
    oldestHours: null,
    slaHours: null,
    overdue: false,
    ...over,
  };
}

describe('orderByUrgency', () => {
  it('puts overdue queues above busy ones, and busy above clear', () => {
    const ordered = orderByUrgency([
      q({ id: 'clear' }),
      q({ id: 'busy', count: 4, oldestHours: 2 }),
      q({ id: 'late', count: 1, oldestHours: 90, slaHours: 48, overdue: true }),
    ]);
    expect(ordered.map((x) => x.id)).toEqual(['late', 'busy', 'clear']);
  });

  it('breaks ties by longest wait, so the oldest item is the first thing seen', () => {
    const ordered = orderByUrgency([
      q({ id: 'newer', count: 9, oldestHours: 1 }),
      q({ id: 'older', count: 1, oldestHours: 30 }),
    ]);
    // Count is deliberately not the tiebreak: one person waiting 30 hours is
    // a worse failure than nine who arrived an hour ago.
    expect(ordered.map((x) => x.id)).toEqual(['older', 'newer']);
  });

  it('keeps empty queues in the list', () => {
    // A missing row and a row reading zero look identical while scanning, and
    // only one of them means "nothing to do".
    expect(orderByUrgency([q({ id: 'a' }), q({ id: 'b' })])).toHaveLength(2);
  });

  it('does not mutate its input', () => {
    const input = [q({ id: 'a' }), q({ id: 'b', overdue: true, count: 1 })];
    orderByUrgency(input);
    expect(input.map((x) => x.id)).toEqual(['a', 'b']);
  });
});

describe('formatAge', () => {
  it('renders nothing for an empty queue', () => {
    expect(formatAge(null)).toBe('');
  });

  it('does not round a fresh item up to an hour', () => {
    expect(formatAge(0.4)).toBe('just now');
  });

  it('floors rather than rounds, so nothing is reported as older than it is', () => {
    expect(formatAge(23.9)).toBe('23h');
    expect(formatAge(71)).toBe('2d');
  });

  it('switches to days at 24h', () => {
    expect(formatAge(24)).toBe('1d');
    expect(formatAge(47.9)).toBe('1d');
  });
});

/**
 * The access-request queue's logic, extracted from its two database queries so
 * the part most likely to be wrong is testable. See `pendingAccessRequests`.
 */
describe('firstAskByEmail', () => {
  const at = (iso: string) => new Date(iso);

  it('dates a repeat asker by their FIRST request, not their latest', () => {
    // Rows arrive newest-first, which is the order the query returns them in.
    const map = firstAskByEmail([
      { createdAt: at('2026-08-09T00:00:00Z'), metadata: { email: 'nyla@example.com' } },
      { createdAt: at('2026-08-01T00:00:00Z'), metadata: { email: 'nyla@example.com' } },
    ]);
    expect(map.size).toBe(1);
    expect(map.get('nyla@example.com')?.toISOString()).toBe('2026-08-01T00:00:00.000Z');
  });

  it('treats addresses case-insensitively and trims them', () => {
    const map = firstAskByEmail([
      { createdAt: at('2026-08-09T00:00:00Z'), metadata: { email: '  NYLA@Example.com ' } },
      { createdAt: at('2026-08-02T00:00:00Z'), metadata: { email: 'nyla@example.com' } },
    ]);
    expect([...map.keys()]).toEqual(['nyla@example.com']);
    expect(map.get('nyla@example.com')?.toISOString()).toBe('2026-08-02T00:00:00.000Z');
  });

  it('skips rows with no usable address rather than counting them', () => {
    const map = firstAskByEmail([
      { createdAt: at('2026-08-09T00:00:00Z'), metadata: null },
      { createdAt: at('2026-08-09T00:00:00Z'), metadata: {} },
      { createdAt: at('2026-08-09T00:00:00Z'), metadata: { email: 42 } },
      { createdAt: at('2026-08-09T00:00:00Z'), metadata: { email: 'not-an-address' } },
      { createdAt: at('2026-08-09T00:00:00Z'), metadata: { email: 'ok@example.com' } },
    ]);
    expect([...map.keys()]).toEqual(['ok@example.com']);
  });
});

describe('stillWaiting', () => {
  const asked = () =>
    new Map([
      ['early@example.com', new Date('2026-08-01T00:00:00Z')],
      ['late@example.com', new Date('2026-08-08T00:00:00Z')],
    ]);

  it('reports the oldest outstanding wait, not the newest', () => {
    const result = stillWaiting(asked(), []);
    expect(result.count).toBe(2);
    expect(result.oldest?.toISOString()).toBe('2026-08-01T00:00:00.000Z');
  });

  it('drops people who now have an account, and re-dates the queue', () => {
    const result = stillWaiting(asked(), ['early@example.com']);
    expect(result.count).toBe(1);
    // The queue is no longer a week old just because someone who already
    // signed up asked a week ago.
    expect(result.oldest?.toISOString()).toBe('2026-08-08T00:00:00.000Z');
  });

  it('matches an account whose address differs only in case or spacing', () => {
    // Otherwise a request sits "waiting" forever because someone capitalised
    // their own address when they registered.
    expect(stillWaiting(asked(), ['  Early@Example.COM ', 'LATE@example.com']).count).toBe(0);
  });

  it('ignores null account emails — a passkey account has none', () => {
    expect(stillWaiting(asked(), [null]).count).toBe(2);
  });

  it('is empty and undated when nobody is waiting', () => {
    expect(stillWaiting(new Map(), [])).toEqual({ count: 0, oldest: null });
  });
});
