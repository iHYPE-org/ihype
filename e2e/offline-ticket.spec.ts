import { test, expect } from '@playwright/test';
import { applySessionCookie, canSeedSession, seedShowWithTicket } from './fixtures/session';

/**
 * The one moment the offline wallet exists for: a fan at the door with no
 * signal, opening a ticket they have not opened before.
 *
 * Item 34 of the acceptance walk proves `OfflineTicketWarmer` is MOUNTED on the
 * wallet. Nothing proved the service worker then SERVED the ticket page with
 * the network gone — and it did not, for any ticket, until 2026-09-03 (see the
 * `OfflineTicketWarmer` row in CLAUDE.md: the ticket URL sat behind the
 * network-only gate, so the cache the feature is named for was never written).
 * A walk item cannot measure this: it needs a browser with a registered worker
 * and a network that can be cut, which is what this spec is.
 *
 * Sequence, and why each step is there:
 *   1. Open the wallet ONCE. This used to need two loads and the second one
 *      was the bug, not the method: the warmer posted to
 *      `navigator.serviceWorker.controller`, which is null on the first load
 *      of a session, so a fan who opened the wallet once and left for the
 *      venue had cached nothing. It waits for `serviceWorker.ready` now
 *      (2026-09-10), and asserting on a single load is what proves that.
 *   2. Wait for the ticket page to be in the `ihype-tickets` cache.
 *   3. Cut the network and navigate to a ticket the browser has never rendered.
 */
const EMAIL = 'e2e-offline-fan@ihype.org';
const TICKETS_CACHE = 'ihype-tickets';

test.describe('the offline ticket wallet', () => {
  test.skip(!canSeedSession(), 'needs a seeded database and AUTH_SECRET');

  test('a warmed ticket opens with no signal, on first view', async ({ page, context }) => {
    const session = await applySessionCookie(context, EMAIL, { profiles: [] });
    const seeded = await seedShowWithTicket({ buyerUserId: session.user.id, buyerEmail: session.user.email });
    const ticketPath = `/app/me/tickets/${seeded.serializedId}`;

    /* ONE load. The worker registers and claims the page on activate, and the
       warmer waits for `serviceWorker.ready` rather than reading `controller`,
       so it no longer matters that the controller is null while this first
       navigation is being served. */
    await page.goto('/app/tickets');
    await expect(page.getByText(seeded.serializedId).first()).toBeVisible();
    /* `expect.poll` over `page.evaluate`, NOT `waitForFunction` with an async
       predicate: waitForFunction treats the returned Promise as a truthy
       value and resolves at once, so the first draft of this spec went
       offline before the worker had stored anything and measured the
       fallback page. */
    await expect.poll(
      () => page.evaluate(async ({ path, cacheName }) => {
        const cache = await caches.open(cacheName);
        return Boolean(await cache.match(path));
      }, { path: ticketPath, cacheName: TICKETS_CACHE }),
      { timeout: 30_000, message: 'the ticket page never reached the ihype-tickets cache' },
    ).toBe(true);

    await context.setOffline(true);
    try {
      await page.goto(ticketPath);
      // The QR page names the code beside the QR and in the image's alt text.
      await expect(page.getByText(seeded.serializedId).first()).toBeVisible();
      await expect(page.getByRole('img', { name: new RegExp(seeded.serializedId) })).toBeVisible();
      // And not the offline fallback page, which would also be a 200 from the worker.
      await expect(page.getByText(/you.re offline/i)).toHaveCount(0);
    } finally {
      await context.setOffline(false);
    }
  });

  test('the wallet itself is never cached — it lists live rows only', async ({ page, context }) => {
    const session = await applySessionCookie(context, EMAIL, { profiles: [] });
    await seedShowWithTicket({ buyerUserId: session.user.id, buyerEmail: session.user.email });
    await page.goto('/app/tickets');
    await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller), null, { timeout: 30_000 });
    await page.goto('/app/tickets');
    /* The 2026-09-02 sweep took the LIST out of the precache on purpose: it is
       a private page whose rows change, and a stale cached list at the door
       would show a ticket that has since been transferred. Only the detail
       pages are stored. */
    const listCached = await page.evaluate(async (cacheName) => {
      const cache = await caches.open(cacheName);
      const keys = await cache.keys();
      return keys.some((request) => new URL(request.url).pathname === '/app/tickets');
    }, TICKETS_CACHE);
    expect(listCached).toBe(false);
  });

  test('a fan can ask for the tickets again and is told what was saved', async ({ page, context }) => {
    /* The automatic warm covers most members and covers none of the cases
       that strand one: a browser that evicted the cache (Safari clears unused
       site storage after seven days, and a ticket bought a month ahead is
       exactly that), or a transfer, which REISSUES every serializedId in the
       order so the page cached under the old id is a dead link. Before this
       control there was no way to ask again, and no way to find out. */
    const session = await applySessionCookie(context, EMAIL, { profiles: [] });
    const seeded = await seedShowWithTicket({ buyerUserId: session.user.id, buyerEmail: session.user.email });
    const ticketPath = `/app/me/tickets/${seeded.serializedId}`;

    await page.goto('/app/tickets');
    await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller), null, { timeout: 30_000 });

    // Drop what the automatic warm stored, so the press is what refills it.
    await page.evaluate(async (cacheName) => {
      const cache = await caches.open(cacheName);
      for (const request of await cache.keys()) await cache.delete(request);
    }, TICKETS_CACHE);

    await page.getByRole('button', { name: /save tickets to this phone/i }).click();

    /* The count comes from the worker, not from the fact that a postMessage
       was sent — a tick over an empty cache is the failure this asserts
       against. */
    await expect(page.getByText(/will open with no signal/i)).toBeVisible({ timeout: 30_000 });
    const cachedAgain = await page.evaluate(async ({ path, cacheName }) => {
      const cache = await caches.open(cacheName);
      return Boolean(await cache.match(path));
    }, { path: ticketPath, cacheName: TICKETS_CACHE });
    expect(cachedAgain, 'pressing save did not put the ticket back in the cache').toBe(true);
  });
});
