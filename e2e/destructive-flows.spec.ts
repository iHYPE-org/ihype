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
    await signIn(context, 'e2e-destructive-rename@ihype.org');
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
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Renamed For Good').first()).toBeVisible();

    // The reload is the assertion that matters: an optimistic UI that never
    // persisted would pass everything above and fail only here.
    await page.reload();
    await expect(page.getByText('Renamed For Good').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Rename Me', { exact: true })).toHaveCount(0);
  });

  test('deleting a playlist takes two taps, and the second one is final', async ({ context, page }) => {
    await signIn(context, 'e2e-destructive-delete@ihype.org');
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

  test('a playlist cannot be deleted by someone who does not own it', async ({ context, page }) => {
    await signIn(context, 'e2e-destructive-owner@ihype.org');
    await page.goto('/app/music/playlists');
    const created = await page.request.post('/api/fan-playlists', {
      data: { name: 'Not Yours' },
    });
    expect(created.ok()).toBeTruthy();
    const playlist = (await created.json()) as { id?: string; playlist?: { id: string } };
    const id = playlist.id ?? playlist.playlist?.id;
    expect(id).toBeTruthy();

    /* Same browser, different member: re-seed the session as someone else and
       aim the DELETE at the first member's playlist. The ownership boundary is
       the API's, so the API is the right layer to attack it at. */
    await signIn(context, 'e2e-destructive-thief@ihype.org');
    const stolen = await page.request.delete(`/api/fan-playlists/${id}`);
    expect([403, 404]).toContain(stolen.status());
  });
});
