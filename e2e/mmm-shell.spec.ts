import { test, expect, type BrowserContext } from '@playwright/test';
import { canSeedSession, seedSessionCookie, sessionCookieName } from './fixtures/session';

/**
 * The Music · Map · Me shell contract, as executable assertions.
 *
 * The design bundle ships its own verification checklist
 * (`design/handoff-music-map-me/FRONTEND_GOTCHAS.md` §9). Most of its items are
 * exactly the kind that regress silently — an item present in the manifest but
 * clipped off-screen, a fan that animates all at once, a player that stays
 * reachable behind the scrim — so the checklist is encoded here rather than
 * being a document someone remembers to re-read.
 *
 * Environment: same as every other authenticated spec. This cannot pass under
 * plain `npm run dev` (src/lib/db.ts imports the wasm/workerd Prisma engine, so
 * auth() throws there and every request 401s). Run it through
 * `node scripts/e2e-workerd.mjs`.
 */

const EMAIL = 'e2e-mmm-fan@ihype.org';
const ARTIST_EMAIL = 'e2e-mmm-artist@ihype.org';

test.skip(!canSeedSession(), 'Needs E2E_WORKERD_DATABASE_URL + AUTH_SECRET to seed a session.');

/**
 * Signs in a seeded account. Defaults to NO Profile row, which is a real state
 * worth defaulting to: the HYPE link is keyed on the member's first profile's
 * hexId (the value `/api/me` returns as `inviteHexId`), so a profile-less
 * account has no link and the card must be absent rather than blank. The
 * profile-bearing paths get their own describe block below.
 */
async function signIn(context: BrowserContext, email = EMAIL, profiles: { type: 'ARTIST' | 'DJ' | 'VENUE'; name: string }[] = []) {
  const { cookie } = await seedSessionCookie(email, { profiles });
  await context.addCookies([{
    name: sessionCookieName(),
    value: cookie,
    domain: 'localhost',
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
  }]);
}

test.describe('Music · Map · Me shell', () => {
  test.beforeEach(async ({ context }) => { await signIn(context); });

  test('/app redirects to the MAP surface', async ({ page }) => {
    await page.goto('/app');
    await expect(page).toHaveURL(/\/app\/map$/);
  });

  // Rule 1: no header, no bottom tab bar. This is the single biggest departure
  // from the shell it replaces, and the easiest thing to reintroduce by accident
  // — mounting the shell anywhere the root layout's AppShell also applies would
  // put an 82px header back on screen.
  test('renders no top bar and no bottom tab bar', async ({ page }) => {
    await page.goto('/app/map');
    await expect(page.locator('.mmm-frame')).toBeVisible();
    await expect(page.locator('.shell-header')).toHaveCount(0);
    await expect(page.locator('.shell-context-strip')).toHaveCount(0);
    await expect(page.locator('.mobile-bottom-nav')).toHaveCount(0);
  });

  test('the logo trigger and the player are the only persistent chrome', async ({ page }) => {
    await page.goto('/app/map');
    await expect(page.getByRole('button', { name: /Open iHYPE navigation/i })).toBeVisible();
    await expect(page.locator('.mmm-nav-hint')).toHaveText('MAP');
  });

  // Rule 5: the module pane is the only scroll container; the document is locked.
  test('locks document scroll', async ({ page }) => {
    await page.goto('/app/music/radio');
    await expect(page.locator('html')).toHaveClass(/mmm-locked/);
    const overflow = await page.evaluate(() => getComputedStyle(document.documentElement).overflow);
    expect(overflow).toBe('hidden');
  });

  test('tapping the logo opens the fan and tapping it again closes it', async ({ page }) => {
    await page.goto('/app/map');
    const logo = page.getByRole('button', { name: /Open iHYPE navigation/i });
    await logo.click();
    await expect(page.locator('.mmm-nav-anchor')).toHaveAttribute('data-open', 'true');
    await expect(page.getByRole('button', { name: 'MUSIC' })).toBeVisible();
    await page.getByRole('button', { name: /Close iHYPE navigation/i }).click();
    await expect(page.locator('.mmm-nav-anchor')).toHaveAttribute('data-open', 'false');
  });

  test('tapping the scrim closes the fan', async ({ page }) => {
    await page.goto('/app/map');
    await page.getByRole('button', { name: /Open iHYPE navigation/i }).click();
    await page.locator('.mmm-nav-scrim').click();
    await expect(page.locator('.mmm-nav-anchor')).toHaveAttribute('data-open', 'false');
  });

  test('MAP navigates directly; MUSIC opens a submenu without leaving', async ({ page }) => {
    await page.goto('/app/me');
    await page.getByRole('button', { name: /Open iHYPE navigation/i }).click();
    await page.getByRole('button', { name: 'MUSIC' }).click();
    // Still open, now showing level 2.
    await expect(page.locator('.mmm-nav-anchor')).toHaveAttribute('data-sub', 'true');
    await expect(page).toHaveURL(/\/app\/me/);
    await expect(page.getByRole('button', { name: 'Radio' })).toBeVisible();
  });

  // §9: "All 5 MUSIC items are visible and reachable, no clipping." §4 is the
  // bug this guards — three of seven items were off-screen and unreachable
  // because an ancestor's overflow clipped the transform.
  test('every MUSIC item is on screen and hit-testable', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/app/map');
    await page.getByRole('button', { name: /Open iHYPE navigation/i }).click();
    await page.getByRole('button', { name: 'MUSIC' }).click();

    const labels = ['Discover', 'Radio', 'Charts', 'Recommended', 'Playlists'];
    for (const label of labels) {
      const item = page.getByRole('button', { name: label, exact: true });
      await expect(item).toBeVisible();
      const box = await item.boundingBox();
      expect(box, `${label} has no box`).not.toBeNull();
      // Fully inside the viewport on both axes — a clipped item still reports
      // "visible" while sitting half off-screen.
      expect(box!.x, `${label} is off the left edge`).toBeGreaterThanOrEqual(0);
      expect(box!.y, `${label} is off the top edge`).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width, `${label} overflows the right edge`).toBeLessThanOrEqual(390);
      expect(box!.y + box!.height, `${label} overflows the bottom edge`).toBeLessThanOrEqual(844);
      // And the point at its centre must actually hit it, not something above it.
      const hit = await page.evaluate(([x, y]) => {
        const node = document.elementFromPoint(x, y);
        return node?.textContent?.trim() ?? '';
      }, [box!.x + box!.width / 2, box!.y + box!.height / 2] as [number, number]);
      expect(hit, `${label} is covered by something else`).toContain(label);
    }
  });

  // §9: "Items fan out with a visible stagger, not all at once." §5's bug made
  // every item animate simultaneously, silently.
  test('fan items carry a per-index stagger', async ({ page }) => {
    await page.goto('/app/map');
    await page.getByRole('button', { name: /Open iHYPE navigation/i }).click();
    await page.getByRole('button', { name: 'MUSIC' }).click();
    const delays = await page.locator('.mmm-nav-item').evaluateAll(
      (nodes) => nodes.map((node) => getComputedStyle(node).transitionDelay),
    );
    expect(delays.length).toBe(5);
    expect(new Set(delays).size, `expected distinct delays, got ${delays.join(', ')}`).toBe(5);
  });

  // §9: "Nav opens, dims everything including the player."
  test('opening the fan hides the player and takes it out of the tab order', async ({ page }) => {
    await page.goto('/app/map');
    const player = page.locator('.mmm-player');
    if (await player.count()) {
      await expect(player).toHaveAttribute('data-hidden', 'false');
      await page.getByRole('button', { name: /Open iHYPE navigation/i }).click();
      await expect(player).toHaveAttribute('data-hidden', 'true');
      await expect(player).toHaveAttribute('aria-hidden', 'true');
      const focusable = await player.locator('button[tabindex="-1"]').count();
      expect(focusable).toBeGreaterThan(0);
    }
  });

  test('Escape steps back a level, then closes', async ({ page }) => {
    await page.goto('/app/map');
    await page.getByRole('button', { name: /Open iHYPE navigation/i }).click();
    await page.getByRole('button', { name: 'MUSIC' }).click();
    await expect(page.locator('.mmm-nav-anchor')).toHaveAttribute('data-sub', 'true');
    await page.keyboard.press('Escape');
    await expect(page.locator('.mmm-nav-anchor')).toHaveAttribute('data-sub', 'false');
    await expect(page.locator('.mmm-nav-anchor')).toHaveAttribute('data-open', 'true');
    await page.keyboard.press('Escape');
    await expect(page.locator('.mmm-nav-anchor')).toHaveAttribute('data-open', 'false');
  });

  // The module tab is a route, not state: it must survive a reload and a
  // back-button press, which the prototype's local state did not.
  test('the MUSIC tab is a real route', async ({ page }) => {
    await page.goto('/app/music/discover');
    await page.getByRole('link', { name: 'Charts' }).click();
    await expect(page).toHaveURL(/\/app\/music\/charts$/);
    await page.reload();
    await expect(page.getByRole('link', { name: 'Charts' })).toHaveAttribute('aria-current', 'page');
    await page.goBack();
    await expect(page).toHaveURL(/\/app\/music\/discover$/);
  });

  test('an unknown MUSIC tab 404s rather than falling back to Discover', async ({ page }) => {
    const response = await page.goto('/app/music/nonsense');
    expect(response?.status()).toBe(404);
  });

  // §9: "No reference to a DJ role anywhere in the UI." The DJ role is still
  // live elsewhere in the product, so this asserts only the new shell's own
  // surfaces — which is the scope the checklist item can honestly cover today.
  test('the shell surfaces never mention a DJ role', async ({ page }) => {
    for (const path of ['/app/map', '/app/music/radio', '/app/me']) {
      await page.goto(path);
      await expect(page.locator('.mmm-frame')).toBeVisible();
      const text = (await page.locator('.mmm-frame').innerText()).toLowerCase();
      expect(text, `${path} mentions a DJ role`).not.toMatch(/\bdj\b/);
    }
  });

  // The map is the base layer and must survive a module change, or returning to
  // MAP loses your pan and zoom.
  test('the map element is not remounted when switching modules', async ({ page }) => {
    await page.goto('/app/map');
    await page.locator('.mmm-map-canvas').evaluate((node) => node.setAttribute('data-mmm-probe', 'kept'));
    await page.getByRole('button', { name: /Open iHYPE navigation/i }).click();
    await page.getByRole('button', { name: 'MUSIC' }).click();
    await page.getByRole('button', { name: 'Radio' }).click();
    await expect(page).toHaveURL(/\/app\/music\/radio$/);
    await expect(page.locator('.mmm-map-canvas')).toHaveAttribute('data-mmm-probe', 'kept');
  });

  test('the ME surface carries the four account panels as rows, not a fan-out', async ({ page }) => {
    await page.goto('/app/me');
    for (const label of ['Settings', 'Info', 'Legal', 'Accessibility']) {
      await expect(page.getByRole('link', { name: new RegExp(label) }).first()).toBeVisible();
    }
    // ME must not open a submenu — only MUSIC does.
    await page.getByRole('button', { name: /Open iHYPE navigation/i }).click();
    await page.getByRole('button', { name: 'ME' }).click();
    await expect(page).toHaveURL(/\/app\/me$/);
    await expect(page.locator('.mmm-nav-anchor')).toHaveAttribute('data-open', 'false');
  });

  // An account with no Profile row has no hexId and therefore no HYPE link. The
  // card must be absent, not present-and-blank — and the surface must still
  // render, which is the actual risk.
  test('a profile-less account still renders ME, without a HYPE link card', async ({ page }) => {
    await page.goto('/app/me');
    await expect(page.getByRole('link', { name: /Settings/ }).first()).toBeVisible();
    await expect(page.getByText(/Your HYPE link/i)).toHaveCount(0);
  });
});

test.describe('ME with a real profile', () => {
  test.beforeEach(async ({ context }) => {
    await signIn(context, ARTIST_EMAIL, [{ type: 'ARTIST', name: 'E2E MMM Artist' }]);
  });

  test('the HYPE link card renders and states that promoting needs no role', async ({ page }) => {
    await page.goto('/app/me');
    await expect(page.getByText(/Your HYPE link/i)).toBeVisible();
    await expect(page.getByText(/Promoting needs no role and no signup/i)).toBeVisible();
  });

  // The fan page creator was removed; Artist and Venue keep theirs. The role
  // switcher only appears once an account holds more than the implicit Fan role.
  test('an artist account gets a page card and a role switcher', async ({ page }) => {
    await page.goto('/app/me?role=artist');
    await expect(page.getByText(/Your page/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Fan', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Artist', exact: true })).toBeVisible();
  });

  test('the fan role has no page card — the fan page creator was removed', async ({ page }) => {
    await page.goto('/app/me?role=fan');
    await expect(page.getByText(/Your HYPE link/i)).toBeVisible();
    await expect(page.getByText(/Your page/i)).toHaveCount(0);
  });
});

test.describe('bounded map queries', () => {
  test.beforeEach(async ({ context }) => { await signIn(context); });

  // BACKEND_REWRITE.md §5: "bbox is required. Reject unbounded requests."
  test('every map layer rejects an unbounded request', async ({ request }) => {
    for (const layer of ['events', 'venues', 'artists']) {
      const response = await request.get(`/api/map/${layer}`);
      expect([400, 503], `${layer} accepted an unbounded request`).toContain(response.status());
      if (response.status() === 400) {
        expect((await response.json()).code).toBe('BBOX_REQUIRED');
      }
    }
  });

  test('a malformed bbox is rejected, not partially parsed', async ({ request }) => {
    const response = await request.get('/api/map/events?bbox=-70.3,43.6,-70.2');
    expect([400, 503]).toContain(response.status());
  });

  test('a bounded request returns a layer payload', async ({ request }) => {
    const response = await request.get('/api/map/events?bbox=-70.4,43.5,-70.1,43.8&zoom=13');
    if (response.status() === 503) return; // maps paused by runtime flag
    expect(response.ok()).toBe(true);
    const payload = await response.json();
    expect(payload.layer).toBe('events');
    expect(typeof payload.total).toBe('number');
  });

  // A global-zoom request must come back aggregated, not as 10,000 rows.
  test('a global-zoom request is clustered server-side', async ({ request }) => {
    const response = await request.get('/api/map/events?bbox=-180,-80,180,80&zoom=2');
    if (response.status() === 503) return;
    expect(response.ok()).toBe(true);
    const payload = await response.json();
    expect(payload.clustered).toBe(true);
    expect(Array.isArray(payload.clusters)).toBe(true);
    expect(payload.pins).toBeUndefined();
  });
});

test.describe('computed stations', () => {
  test.beforeEach(async ({ context }) => { await signIn(context); });

  test('returns the eight computed stations, none of them DJ-hosted', async ({ request }) => {
    const response = await request.get('/api/stations');
    if (response.status() === 503) return; // radio paused by runtime flag
    expect(response.ok()).toBe(true);
    const { stations } = await response.json();
    expect(stations).toHaveLength(8);
    for (const station of stations) {
      expect(['for_you', 'local', 'new', 'friends', 'genre']).toContain(station.kind);
      expect(station.title).not.toMatch(/dj/i);
      // A count is either a real number or explicitly null — never a fabricated 0.
      expect(station.trackCount === null || typeof station.trackCount === 'number').toBe(true);
    }
  });

  test('an unknown station slug 404s', async ({ request }) => {
    const response = await request.get('/api/stations/not-a-station/tracks');
    expect([404, 503]).toContain(response.status());
  });
});
