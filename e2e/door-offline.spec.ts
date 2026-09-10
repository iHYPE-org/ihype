import { test, expect } from '@playwright/test';
import { applySessionCookie, canSeedSession, seedShowWithTicket } from './fixtures/session';

/**
 * The venue's side of the basement: a door phone that downloaded the guest
 * list, lost the network, admitted a fan by code, and told the server once the
 * network came back.
 *
 * Walk item 43 proves the route halves (the list carries hashes only, the
 * venue may scan, a synced scan keeps the door's time). What no walk item can
 * prove is the phone: that the page opens with no signal, that the list read
 * from storage admits the right code, and that the queue drains on `online`.
 * That needs a browser with a registered worker and a network that can be
 * cut, which is what this spec is — the same shape as offline-ticket.spec.ts.
 *
 * The seed makes the buyer the show's CREATOR (`creatorId: buyerUserId`), so
 * the one seeded account can both hold the ticket and work the door.
 */
const EMAIL = 'e2e-door-organiser@ihype.org';
const TICKETS_CACHE = 'ihype-tickets';

test.describe('the door with no signal', () => {
  test.skip(!canSeedSession(), 'needs a seeded database and AUTH_SECRET');
  // Download, cut, admit, refuse, reconnect, drain: six network states in one
  // test, and the drain waits on a 15 s retry because this Chromium never
  // fires `online` (see below). The default 30 s is not enough for all of it.
  test.setTimeout(120_000);

  test('a downloaded list admits a code offline and syncs it when the network returns', async ({ page, context }) => {
    const session = await applySessionCookie(context, EMAIL, { profiles: [] });
    const seeded = await seedShowWithTicket({ buyerUserId: session.user.id, buyerEmail: session.user.email, key: 'door' });
    const doorPath = `/app/me/shows/${seeded.slug}/scan`;

    await page.goto(doorPath);
    await expect(page.getByRole('heading', { level: 1, name: seeded.title })).toBeVisible();
    await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller), null, { timeout: 30_000 });

    // Download the list. The button waits for the worker's registration
    // rather than the controller, so a first load can warm the page.
    await page.getByRole('button', { name: /download for the door/i }).click();
    await expect(page.getByText(/1 ticket on the list/)).toBeVisible();

    // The list on the phone holds a hash of the code, never the code.
    const stored = await page.evaluate((showId) => window.localStorage.getItem(`ihype-door:${showId}:manifest`), seeded.showId);
    expect(stored).toBeTruthy();
    expect(stored!.includes(seeded.serializedId)).toBe(false);
    expect(stored!.includes(seeded.serializedId.slice(2))).toBe(false);

    /* `expect.poll` over `page.evaluate`, not `waitForFunction` with an async
       predicate — see offline-ticket.spec.ts for why. Two things have to be
       stored before the network is cut: the document, and EVERY static asset
       this page loaded — the download button hands the worker that list
       (WARM_ASSETS), because on a first visit the page's own scripts were
       fetched before the worker controlled it. Cutting the network mid-warm
       measured as the error boundary, not the door. */
    await expect.poll(
      () => page.evaluate(async ({ path, cacheName }) => {
        const cache = await caches.open(cacheName);
        if (!(await cache.match(path))) return 'no document';
        const needed = performance.getEntriesByType('resource')
          .map((entry) => new URL(entry.name).pathname)
          .filter((pathname) => pathname.startsWith('/_next/static/'));
        for (const asset of needed) {
          if (!(await caches.match(asset))) return `missing ${asset}`;
        }
        return 'ready';
      }, { path: doorPath, cacheName: TICKETS_CACHE }),
      { timeout: 30_000, message: 'the door page and its assets never reached the caches' },
    ).toBe('ready');

    await context.setOffline(true);
    try {
      await page.goto(doorPath);
      await expect(page.getByRole('heading', { level: 1, name: seeded.title })).toBeVisible();
      await expect(page.getByText(/you.re offline/i)).toHaveCount(0);
      /* Hydrated, and the list read back from storage. Not asserted: the
         "Offline" word — Playwright's offline emulation leaves
         `navigator.onLine` TRUE in this Chromium (measured), so the door
         reaches its list the other way, by the server fetch failing. A real
         phone flips the flag; the product handles both. */
      await expect(page.getByText(/1 on the list/)).toBeVisible({ timeout: 20_000 });

      // The fan shows their code; the door types it (no camera in a headless run).
      await page.getByLabel(/ticket code/i).fill(seeded.serializedId);
      await page.getByRole('button', { name: /^check$/i }).click();
      const verdict = page.getByRole('status').filter({ hasText: /admit/i });
      await expect(verdict).toBeVisible();
      await expect(verdict).toContainText(/syncs when you are back online/i);
      await expect(page.getByText(/1 waiting to sync/)).toBeVisible();

      // The same code again is a duplicate on THIS phone, with no server asked.
      await page.getByLabel(/ticket code/i).fill(seeded.serializedId);
      await page.getByRole('button', { name: /^check$/i }).click();
      await expect(page.getByRole('status').filter({ hasText: /already checked in here/i })).toBeVisible();
    } finally {
      await context.setOffline(false);
    }

    // Back online: the queue drains and the row reads synced. No `online`
    // event fires here (the flag never went false), so this is the periodic
    // retry doing the work — which is also what saves a phone whose WebView
    // never flips the flag.
    await expect(page.getByText(/1 waiting to sync/)).toHaveCount(0, { timeout: 45_000 });
    await expect(page.locator('.mmm-door-log-row[data-sync="synced"]')).toHaveCount(1, { timeout: 30_000 });

    // And the server agrees: the same code presented online is refused as used.
    await page.getByLabel(/ticket code/i).fill(seeded.serializedId);
    await page.getByRole('button', { name: /^check$/i }).click();
    await expect(page.getByRole('status').filter({ hasText: /already/i }).first()).toBeVisible();
  });

  test('a fan cannot open the door for a show they merely hold a ticket to', async ({ page, context }) => {
    const organiser = await applySessionCookie(context, EMAIL, { profiles: [] });
    const seeded = await seedShowWithTicket({ buyerUserId: organiser.user.id, buyerEmail: organiser.user.email, key: 'door-stranger' });
    // A different account: no profile, not the creator.
    await applySessionCookie(context, 'e2e-door-stranger@ihype.org', { profiles: [] });
    await page.goto(`/app/me/shows/${seeded.slug}/scan`);
    /* Asserted on the DOCUMENT, not the status: under the root `loading.tsx`
       boundary a `notFound()` streams a 200 carrying the not-found UI (the
       same shape CLAUDE.md records for `redirect()`), so the status code says
       nothing about what the stranger was shown. */
    await expect(page.getByRole('heading', { level: 1, name: seeded.title })).toHaveCount(0);
    await expect(page.locator('.mmm-door')).toHaveCount(0);
    await expect(page.getByLabel(/ticket code/i)).toHaveCount(0);
  });
});
