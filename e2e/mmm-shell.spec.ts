import { test, expect, type BrowserContext } from '@playwright/test';
import { applySessionCookie, canSeedSession } from './fixtures/session';

/**
 * The Music · Map · Me shell contract, as executable assertions.
 *
 * The design bundle ships its own verification checklist — now
 * `design/design-system-v8/ADHERENCE.md` rules 6-28. Most of its items are
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
async function signIn(context: BrowserContext, email = EMAIL, profiles: { type: 'ARTIST' | 'VENUE'; name: string }[] = []) {
  await applySessionCookie(context, email, { profiles });
  // Pre-accept cookie consent. Not cosmetic: the consent dialog is pinned to the
  // bottom of the viewport, which is exactly where this shell puts its logo
  // trigger and fan, so at phone width it intercepts every click on the nav.
  // Seeding the same localStorage key CookieConsent reads keeps these tests
  // about the shell instead of about the banner. The overlap itself is a real
  // product question and is recorded in DESIGN_SYNC row 268, not hidden here.
  await context.addInitScript(() => {
    try { localStorage.setItem('ihype_cookie_consent', 'accepted'); } catch { /* private mode */ }
  });
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
    // Real class names, checked against the components: AppShellHeader renders
    // `.shell-header`, AppShellContextStrip `.shell-context-strip`,
    // MobileBottomNav `.ihype-mobile-nav`, GlobalMediaPlayer `.site-dock`. A
    // guessed name would make this pass whether or not the chrome rendered.
    //
    // `toBeHidden`, not `toHaveCount(0)`: the last two render from the ROOT
    // layout and are therefore always in the DOM on this route — mmm.css stands
    // them down with `display: none`. What matters is that none of it is
    // presented or focusable, and toBeHidden covers absent AND hidden.
    await expect(page.locator('.shell-header')).toBeHidden();
    await expect(page.locator('.shell-context-strip')).toBeHidden();
    await expect(page.locator('.ihype-mobile-nav')).toBeHidden();
    await expect(page.locator('.site-dock')).toBeHidden();
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
  //
  // Measured only once the fan has SETTLED. The items transition out from behind
  // the logo over .42s with a per-index delay, and `toBeVisible()` resolves the
  // moment opacity lifts — so reading boundingBox() straight after it samples a
  // pill still in flight, near the logo, and the hit test then returns the logo.
  // That is the test measuring an animation, not the layout being wrong.
  test('every MUSIC item is on screen and hit-testable', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/app/map');
    await page.getByRole('button', { name: /Open iHYPE navigation/i }).click();
    await page.getByRole('button', { name: 'MUSIC' }).click();

    const labels = ['Discover', 'Radio', 'Charts', 'Recommended', 'Playlists'];
    for (const label of labels) {
      await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
    }

    // One poll over the whole set: each pill fully inside the viewport, and the
    // point at its own centre hitting itself rather than something above it.
    await expect.poll(async () => page.evaluate((names) => {
      const problems: string[] = [];
      for (const name of names) {
        const node = [...document.querySelectorAll('.mmm-nav-item')]
          .find((candidate) => candidate.textContent?.trim() === name);
        if (!node) { problems.push(`${name}: not rendered`); continue; }
        const box = node.getBoundingClientRect();
        if (box.width === 0 || box.height === 0) { problems.push(`${name}: zero box`); continue; }
        if (box.left < 0) problems.push(`${name}: off the left edge (${Math.round(box.left)})`);
        if (box.top < 0) problems.push(`${name}: off the top edge (${Math.round(box.top)})`);
        if (box.right > window.innerWidth) problems.push(`${name}: overflows right (${Math.round(box.right)} > ${window.innerWidth})`);
        if (box.bottom > window.innerHeight) problems.push(`${name}: overflows bottom (${Math.round(box.bottom)} > ${window.innerHeight})`);
        const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
        const hitText = hit?.textContent?.trim() ?? '';
        if (hitText !== name) problems.push(`${name}: centre hits "${hitText}"`);
      }
      return problems;
    }, labels), { timeout: 10_000 }).toEqual([]);
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

  // The requirement is that a typo does not silently render Discover. Asserted on
  // what the page SHOWS, not on the status code: `notFound()` throws after the
  // layout has already flushed (it is async — it awaits auth and a DB read), so
  // Next streams the not-found UI with a 200 and cannot retroactively set 404.
  // Testing the status here would be testing Next's streaming behaviour, not
  // this route's.
  test('an unknown MUSIC tab shows not-found, not a silent fallback to Discover', async ({ page }) => {
    await page.goto('/app/music/nonsense');
    await expect(page.getByRole('heading', { name: /skipped soundcheck/i })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Discover' })).toHaveCount(0);
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

/**
 * The cookie-consent collision (DESIGN_SYNC row 268, item f).
 *
 * Every other test in this file pre-accepts consent so it can be about the
 * shell. That is exactly why this one must exist: the dialog is pinned to the
 * bottom of the viewport and, at phone width, is `100vw - 32px` wide — the same
 * corner the 76px logo trigger occupies. It swallowed every pointer event aimed
 * at the nav, so a first-time visitor could not open the navigation at all
 * until they dismissed the banner. Playwright burned 55 click retries on
 * "subtree intercepts pointer events" before timing out.
 *
 * The fix does not move, restyle or hide consent — it is a compliance surface.
 * The dialog publishes how much of the bottom edge it occupies as
 * `--consent-inset` and the shell lifts its own chrome by that much. So this
 * signs in WITHOUT pre-accepting, and asserts both halves: consent is really on
 * screen, and the trigger is really clickable anyway.
 */
test.describe('Music · Map · Me shell — first visit, consent pending', () => {
  test('the nav trigger is clickable with the consent dialog on screen', async ({ page, context }) => {
    // Note the absence of the consent-seeding init script the `signIn` helper
    // adds. A first visit is the state under test.
    await applySessionCookie(context, EMAIL, { profiles: [] });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/app/map');

    // Guard the test itself: if consent stopped rendering, everything below
    // would pass while proving nothing.
    const consent = page.getByRole('dialog', { name: /cookie preferences/i });
    await expect(consent).toBeVisible();

    const trigger = page.getByRole('button', { name: /Open iHYPE navigation/i });
    await expect(trigger).toBeVisible();

    // The real assertion is hit-testing, not visibility: the failure mode was
    // a fully visible trigger sitting underneath a higher z-index dialog.
    await expect.poll(async () => page.evaluate(() => {
      const logo = document.querySelector('.mmm-logo');
      if (!logo) return 'trigger not rendered';
      const box = logo.getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      if (!hit) return 'nothing at the trigger centre';
      return logo.contains(hit) || hit === logo ? 'ok' : `covered by ${hit.className || hit.tagName}`;
    }), { timeout: 10000 }).toBe('ok');

    // And it actually opens, with consent still up.
    await trigger.click();
    await expect(page.getByRole('button', { name: 'MUSIC' })).toBeVisible();
    await expect(consent).toBeVisible();
  });

  test('the trigger returns to its resting position once consent is answered', async ({ page, context }) => {
    // The lift must be tied to the dialog being present, not latched — a stale
    // inset would hold the nav up the page with nothing there to avoid.
    await applySessionCookie(context, EMAIL, { profiles: [] });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/app/map');

    // Distance from the bottom of the viewport, which is what the CSS controls.
    // Measured rather than compared against a constant: the resting value is
    // 26px at the base rule and 22px inside the design's own <=720px
    // breakpoint, so a hardcoded number here asserts the wrong thing on one
    // side of that line — and the breakpoint is the side that matters.
    const gap = () => page.evaluate(() => {
      const box = document.querySelector('.mmm-logo')!.getBoundingClientRect();
      return Math.round(window.innerHeight - box.bottom);
    });

    // Wait for the dialog before measuring: "lifted" is only meaningful once
    // the thing being avoided is actually on screen, and measuring straight
    // after goto() samples the pre-stylesheet frame where the trigger has not
    // been positioned yet.
    await expect(page.getByRole('dialog', { name: /cookie preferences/i })).toBeVisible();

    const lifted = await gap();
    await page.getByRole('button', { name: /Essential only/i }).click();
    await expect(page.getByRole('dialog', { name: /cookie preferences/i })).toHaveCount(0);

    await expect.poll(gap).toBeLessThan(40);
    const resting = await gap();

    // The trigger really had been lifted clear of the dialog, so the assertion
    // above is not vacuously true of a trigger that never moved. A whole
    // banner's height separates the two states.
    expect(lifted).toBeGreaterThan(resting + 80);
  });
});
