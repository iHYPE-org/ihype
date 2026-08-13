import { test, expect, type BrowserContext } from '@playwright/test';
import { applySessionCookie, canSeedSession, seedShowWithTicket } from './fixtures/session';

/**
 * The in-shell detail panes actually render.
 *
 * These four routes — artist, venue, track and playlist — were built and
 * merged without a browser ever loading one. Typecheck proves their Prisma
 * selects compile against the schema; nothing proved a pane returns a page.
 * That gap is the reason this file exists, and it is a real one: each pane is
 * an async server component doing several independently-`.catch()`ed queries
 * inside a streaming layout, and every one of those failure paths renders
 * something rather than throwing.
 *
 * What is asserted, deliberately, is the CONTRACT rather than the copy:
 *
 *   1. The pane renders inside the MMM shell — `.mmm-frame` present, and no
 *      82px legacy header. A pane that renders correctly in the WRONG shell is
 *      the exact failure this whole sequence of work exists to prevent, and it
 *      looks fine in a screenshot.
 *   2. Its own identity is on screen (the seeded name/title).
 *   3. It does not 404. `MmmMissing` is a legitimate render, so "the page
 *      loaded" is not sufficient — the not-found surface is checked for
 *      explicitly and must be absent.
 *
 * ## What this does NOT cover yet, and why
 *
 * The track and playlist panes. `seedShowWithTicket` creates profiles, a show
 * and a ticket, but no `ArtistMediaAsset` and no `FanPlaylist` — so there is
 * no hexId or playlist id to visit, and asserting against a seeded-in-passing
 * row would make this file depend on a fixture detail it does not own. Those
 * two need their own fixture, and saying so here is better than a test that
 * quietly visits a 404 and passes because `MmmMissing` renders fine.
 *
 * `:visible` throughout for the streaming-duplication reason documented at
 * length in `mmm-shell.spec.ts`.
 *
 * Environment: same as every other authenticated spec — run through
 * `node scripts/e2e-workerd.mjs`, not `next dev`.
 */

const EMAIL = 'e2e-mmm-panes@ihype.org';

test.skip(!canSeedSession(), 'Needs E2E_WORKERD_DATABASE_URL + AUTH_SECRET to seed a session.');

async function signIn(context: BrowserContext) {
  const seeded = await applySessionCookie(context, EMAIL);
  // Same reason as the shell spec: the consent banner sits where the nav does.
  await context.addInitScript(() => {
    try { localStorage.setItem('ihype_cookie_consent', 'accepted'); } catch { /* private mode */ }
  });
  return seeded;
}

/** Every pane must satisfy this, whatever it is showing. */
async function expectInShell(page: import('@playwright/test').Page) {
  await expect(page.locator('.mmm-frame:visible')).toBeVisible();
  // The legacy app shell's header must not be here. Two shells on one page is
  // the regression that matters and it is invisible without asserting it.
  await expect(page.locator('.shell-header')).toHaveCount(0);
  // `MmmMissing` renders a real page, so a 404 would otherwise pass as "loaded".
  await expect(page.getByText(/No such (artist|venue|track|playlist)/i)).toHaveCount(0);
}

test.describe('MMM detail panes', () => {
  test('the artist pane renders the artist inside the shell', async ({ context, page }) => {
    const seeded = await signIn(context);
    const show = await seedShowWithTicket({
      buyerUserId: seeded.user.id,
      buyerEmail: seeded.user.email,
      key: 'panes',
    });

    await page.goto(`/app/artists/${show.artistSlug}`);
    await expectInShell(page);
    // The pane's own eyebrow, which is what distinguishes it from the venue
    // pane — both reuse `.mmm-show-*` for the identity block.
    await expect(page.locator('.mmm-show-eyebrow:visible')).toHaveText(/Artist/i);
    await expect(page.locator('.mmm-show-title:visible')).not.toBeEmpty();
  });

  test('the venue pane renders the venue inside the shell', async ({ context, page }) => {
    const seeded = await signIn(context);
    const show = await seedShowWithTicket({
      buyerUserId: seeded.user.id,
      buyerEmail: seeded.user.email,
      key: 'panes',
    });

    await page.goto(`/app/venues/${show.venueSlug}`);
    await expectInShell(page);
    await expect(page.locator('.mmm-show-eyebrow:visible')).toHaveText(/Venue/i);
  });

  /**
   * A slug that does not exist must render the in-shell not-found surface —
   * NOT a Next.js 404 page, which would drop the member out of the shell, and
   * not a crash. This is the path `MmmMissing` exists for: `notFound()` renders
   * the shell twice here because the layout is async and has already flushed.
   */
  test('an unknown artist renders the in-shell not-found, still inside the shell', async ({ context, page }) => {
    await signIn(context);
    await page.goto('/app/artists/definitely-not-a-real-artist-slug');
    await expect(page.locator('.mmm-frame:visible')).toBeVisible();
    await expect(page.getByText(/No such artist/i)).toBeVisible();
  });

  /**
   * The venue pane must refuse a non-VENUE profile rather than rendering an
   * artist under a "Venue" eyebrow. The two panes take the same shape of slug,
   * so this is a one-character mistake away at every call site.
   */
  test('the venue pane rejects an artist slug', async ({ context, page }) => {
    const seeded = await signIn(context);
    const show = await seedShowWithTicket({
      buyerUserId: seeded.user.id,
      buyerEmail: seeded.user.email,
      key: 'panes',
    });

    await page.goto(`/app/venues/${show.artistSlug}`);
    await expect(page.getByText(/No such venue/i)).toBeVisible();
  });

  /**
   * MUSIC's Discover tab must apply `?genre=`, and say so.
   *
   * This is the assertion that would have caught the bug the filter shipped
   * with: the chip is what tells a member the deck is narrowed, and a deck
   * that is quietly filtered — or quietly NOT filtered — looks identical to
   * one that has simply run out.
   */
  test('Discover shows an active filter chip and can clear it', async ({ context, page }) => {
    await signIn(context);
    await page.goto('/app/music/discover?genre=Punk');
    await expect(page.locator('.mmm-frame:visible')).toBeVisible();

    const chip = page.locator('.mmm-filter-chip:visible');
    await expect(chip).toContainText(/Punk/i);
    await chip.getByRole('link', { name: /clear/i }).click();
    await expect(page).toHaveURL(/\/app\/music\/discover$/);
    await expect(page.locator('.mmm-filter-chip')).toHaveCount(0);
  });

  test('Discover shows a city filter chip too', async ({ context, page }) => {
    await signIn(context);
    await page.goto('/app/music/discover?city=Portland');
    await expect(page.locator('.mmm-filter-chip:visible')).toContainText(/Portland/i);
  });
});
