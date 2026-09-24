import { test, expect, type BrowserContext } from '@playwright/test';
import { applySessionCookie, canSeedSession } from './fixtures/session';

/**
 * THE DESTRUCTIVE FLOWS — rename and delete, the paths where a silent bug
 * costs a member their data rather than a retry.
 *
 * Playlist delete is deliberately two-tap in the UI (Delete → confirm Delete),
 * and that choreography is part of what these tests pin: a regression that
 * collapses it to one tap would still "work" — it would just make destruction
 * accidental, which is worse than broken.
 *
 * The playlist under test is CREATED through the API with the page's own
 * session, then destroyed through the real controls. Creation-through-UI lives
 * in the full player's add-to-playlist flow and needs a playing track; setting
 * that stage here would test playback, not deletion. What must be real here is
 * the destructive half, so that is the half driven by clicks.
 *
 * Runs in its own shard — see DEFAULT_TEST_SHARDS in scripts/e2e-workerd.mjs;
 * that list is an allowlist, and a spec not on it silently never runs.
 */

const EMAIL = 'e2e-destructive@ihype.org';

async function signIn(context: BrowserContext, email = EMAIL) {
  test.skip(!canSeedSession(), 'AUTH_SECRET and a scratch DATABASE_URL are required.');
  await applySessionCookie(context, email, {});
}

test.describe('playlist rename and delete', () => {
  test('renaming a playlist persists across a reload', async ({ context, page }) => {
    /* Run-unique, so a rerun against the same database does not find last
       run's "Renamed For Good" rows and pass the first check below before
       this run's rename has landed (2026-09-24, DESIGN_SYNC row 513). */
    await signIn(context, `e2e-destructive-rename-${Date.now().toString(36)}@ihype.org`);
    await page.goto('/app/music/playlists');

    const created = await page.request.post('/api/fan-playlists', {
      data: { name: 'Rename Me' },
    });
    expect(created.ok()).toBeTruthy();
    await page.reload();

    await expect(page.getByText('Rename Me').first()).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Rename Rename Me' }).click();
    const field = page.getByLabel('Rename Rename Me');
    await field.fill('Renamed For Good');
    const saved = page.waitForResponse(
      (response) => /\/api\/fan-playlists\/[^/]+$/.test(new URL(response.url()).pathname) && response.request().method() === 'PATCH',
      { timeout: 15_000 },
    );
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    expect((await saved).ok(), 'the rename must be accepted').toBe(true);
    await expect(page.getByText('Renamed For Good').first()).toBeVisible();

    // The reload is the assertion that matters: an optimistic UI that never
    // persisted would pass everything above and fail only here.
    await page.reload();
    await expect(page.getByText('Renamed For Good').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Rename Me', { exact: true })).toHaveCount(0);
  });

  test('deleting a playlist takes two taps, and the second one is final', async ({ context, page }) => {
    await signIn(context, `e2e-destructive-delete-${Date.now().toString(36)}@ihype.org`); // run-unique, as above
    await page.goto('/app/music/playlists');

    const created = await page.request.post('/api/fan-playlists', {
      data: { name: 'Doomed Playlist' },
    });
    expect(created.ok()).toBeTruthy();
    await page.reload();
    await expect(page.getByText('Doomed Playlist').first()).toBeVisible({ timeout: 15_000 });

    /* First tap arms; it must NOT delete. The row flips to its confirm state,
       which is asserted by the playlist still existing after tap one. */
    await page.getByRole('button', { name: 'Delete Doomed Playlist' }).click();
    await expect(page.getByText('Doomed Playlist').first()).toBeVisible();

    // Second tap — the confirm Delete inside the armed row.
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByText('Doomed Playlist')).toHaveCount(0, { timeout: 15_000 });

    // Gone from the server, not just the screen.
    await page.reload();
    await expect(page.getByText('Doomed Playlist')).toHaveCount(0, { timeout: 15_000 });
  });

  test('a playlist cannot be deleted by someone who does not own it', async ({ browser, context, page }) => {
    await signIn(context, 'e2e-destructive-owner@ihype.org');
    await page.goto('/app/music/playlists');
    const created = await page.request.post('/api/fan-playlists', {
      data: { name: 'Not Yours' },
    });
    expect(created.ok()).toBeTruthy();
    const playlist = (await created.json()) as { id?: string; playlist?: { id: string } };
    const id = playlist.id ?? playlist.playlist?.id;
    expect(id).toBeTruthy();

    /* A different member aims the DELETE at the first member's playlist. The
       ownership boundary is the API's, so the API is the right layer to
       attack it at.

       In its OWN browser context, never by re-seeding this one: the owner's
       page still has reads in flight after `goto`, and the middleware
       refreshes the session cookie on each response, so a late response
       re-set the OWNER's cookie over the thief's and the DELETE went out as
       the owner — a 200 that read like a broken ownership check (the
       2026-09-24 final scan, retry passing). The route deletes only
       `where: { id, userId: session.user.id }`; a jar of the thief's own is
       what makes the request the thief's. */
    const thief = await browser.newContext({ baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000' });
    try {
      await signIn(thief, 'e2e-destructive-thief@ihype.org');
      const stolen = await thief.request.delete(`/api/fan-playlists/${id}`);
      expect([403, 404]).toContain(stolen.status());
    } finally {
      await thief.close();
    }
    // And the owner still has it.
    const mine = await page.request.get('/api/fan-playlists');
    expect(JSON.stringify(await mine.json())).toContain(id!);
  });
});
