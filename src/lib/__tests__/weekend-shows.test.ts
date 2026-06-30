import { describe, it, expect } from 'vitest';
import { weekendWindow } from '@/lib/growth-util';

describe('weekendWindow', () => {
  it('targets the coming Fri–Sun when called mid-week', () => {
    // 2026-06-30 is a Tuesday → coming weekend is Jul 3 (Fri) – Jul 5 (Sun).
    const { start, end } = weekendWindow(new Date('2026-06-30T12:00:00Z'));
    expect(start.toISOString().slice(0, 10)).toBe('2026-07-03');
    expect(end.toISOString().slice(0, 10)).toBe('2026-07-05');
    expect(end.getUTCHours()).toBe(23);
  });

  it('starts at "now" once the weekend has already begun', () => {
    // 2026-07-04 14:00 is a Saturday → start clamps to now, end is that Sunday.
    const now = new Date('2026-07-04T14:00:00Z');
    const { start, end } = weekendWindow(now);
    expect(start.getTime()).toBe(now.getTime());
    expect(end.toISOString().slice(0, 10)).toBe('2026-07-05');
  });

  it('treats Sunday as the final day of the current weekend', () => {
    const now = new Date('2026-07-05T10:00:00Z'); // Sunday
    const { start, end } = weekendWindow(now);
    expect(start.getTime()).toBe(now.getTime());
    expect(end.toISOString().slice(0, 10)).toBe('2026-07-05');
  });

  it('produces a human range label', () => {
    expect(weekendWindow(new Date('2026-06-30T12:00:00Z')).label).toMatch(/Jul/);
  });
});
