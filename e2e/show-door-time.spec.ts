import { expect, test } from '@playwright/test';
import { canSeedSession, seedSessionCookie, seedShowWithTicket } from './fixtures/session';

/**
 * A SHOW'S DOOR TIME IS THE VENUE'S WALL CLOCK (DESIGN_SYNC row 464).
 *
 * This runs against the built worker because that is where the defect lived:
 * `Show.startsAt` is an instant, the readers formatted it with no zone, and a
 * Cloudflare Worker's zone is UTC — so the page that SELLS THE TICKET named the
 * wrong night. A unit test proves `formatDoorTime` does the arithmetic; only
 * driving the real page proves the show page passes it `show.timeZone` and the
 * column survives the query.
 *
 * The instant is chosen so the two readings fall on DIFFERENT DAYS: 02:00 UTC
 * on Sunday 13 December 2026 is 9:00 PM on Saturday the 12th in New York, which
 * is where `seedShowWithTicket` puts its venue. An instant that read the same
 * day in both zones would pass over the bug.
 */
const ORGANISER = 'door-time-organiser@example.com';
const DOORS = new Date('2026-12-13T02:00:00.000Z');

test.describe('a show names the venue clock', () => {
  test.skip(!canSeedSession(), 'needs a seeded database and AUTH_SECRET');

  test('the public show page shows the venue night and names the zone', async ({ page }) => {
    const session = await seedSessionCookie(ORGANISER);
    const show = await seedShowWithTicket({
      buyerUserId: session.user.id,
      buyerEmail: ORGANISER,
      key: 'door-time',
      startsAt: DOORS,
    });

    await page.goto(`/shows/${show.slug}`);
    const when = page.locator('.showpage-inline').first();
    await expect(when).toBeVisible();
    const text = (await when.innerText()).replace(/\s+/g, ' ');

    // The venue's night, not the Worker's.
    expect(text).toContain('Saturday, December 12, 2026');
    expect(text).not.toContain('December 13');
    // And the clock says which clock it is, so a fan four zones away can tell.
    expect(text).toMatch(/9:00\s*PM\s*(EST|GMT-5)/);
  });
});
