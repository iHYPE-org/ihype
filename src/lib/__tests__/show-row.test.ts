import { describe, expect, it } from 'vitest';
import { formatShowClock, formatTicketPrice, showRowTrail } from '../show-row';

const now = new Date('2026-09-02T20:00:00Z');
const base = { isTicketed: true, ticketPriceCents: 1800, ticketingOpensAt: new Date('2026-09-01T00:00:00Z') };

describe('showRowTrail', () => {
  it('reads a LIVE show as on stage, whatever its ticketing says', () => {
    expect(showRowTrail({ ...base, status: 'LIVE', isTicketed: false }, now)).toEqual({ label: 'On stage now', tone: 'live' });
  });

  it('says on sale only when the show page would sell a ticket', () => {
    expect(showRowTrail({ ...base, status: 'SCHEDULED' }, now)).toEqual({ label: 'On sale', tone: 'sale' });
    expect(showRowTrail({ ...base, status: 'SCHEDULED', ticketingOpensAt: new Date('2026-09-10T00:00:00Z') }, now)).toEqual({ label: 'Tickets soon', tone: 'quiet' });
    // No opening time set is NOT on sale — the same rule as show-detail.
    expect(showRowTrail({ ...base, status: 'SCHEDULED', ticketingOpensAt: null }, now)).toEqual({ label: 'Tickets soon', tone: 'quiet' });
  });

  it('has nothing to say about an unticketed show', () => {
    expect(showRowTrail({ ...base, status: 'SCHEDULED', isTicketed: false }, now)).toBeNull();
  });
});

describe('formatTicketPrice', () => {
  it('formats whole dollars, cents, free tickets, and no ticket at all', () => {
    expect(formatTicketPrice({ isTicketed: true, ticketPriceCents: 1800 })).toBe('$18');
    expect(formatTicketPrice({ isTicketed: true, ticketPriceCents: 1850 })).toBe('$18.50');
    expect(formatTicketPrice({ isTicketed: true, ticketPriceCents: 0 })).toBe('Free');
    expect(formatTicketPrice({ isTicketed: false, ticketPriceCents: 1800 })).toBeNull();
  });
});

describe('formatShowClock', () => {
  it('gives the time alone, since the row already shows the date', () => {
    expect(formatShowClock(new Date('2026-09-09T19:05:00'))).toMatch(/^7:05\sPM$/);
  });
});
