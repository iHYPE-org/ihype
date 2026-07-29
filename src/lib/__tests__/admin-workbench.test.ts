import { describe, expect, it } from 'vitest';
import { formatAge, orderByUrgency, type WorkbenchQueue } from '@/lib/admin-workbench';

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
