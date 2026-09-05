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
 *   1. Open the wallet. The worker registers and claims the page on activate.
 *   2. Open it AGAIN once a controller exists — the warmer posts WARM_TICKETS
 *      to `navigator.serviceWorker.controller`, which is null on the very first
 *      load, so the first visit warms nothing (and must not be asserted on).
 *   3. Wait for the ticket page to be in the `ihype-tickets` cache.
 *   4. Cut the network and navigate to a ticket the browser has never rendered.
 */
const EMAIL = 'e2e-offline-fan@ihype.org';
const TICKETS_CACHE = 'ihype-tickets';

test.describe('the offline ticket wallet', () => {
  test.skip(!canSeedSession(), 'needs a seeded database and AUTH_SECRET');

  test('a warmed ticket opens with no signal, on first view', async ({ page, context }) => {
    const session = await applySessionCookie(context, EMAIL, { profiles: [] });
    const seeded = await seedShowWithTicket({ buyerUserId: session.user.id, buyerEmail: session.user.email });
    const ticketPath = `/app/me/tickets/${seeded.serializedId}`;

    await page.goto('/app/tickets');
    await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller), null, { timeout: 30_000 });

    // Second load: now the warmer has a controller to post to.
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
});
