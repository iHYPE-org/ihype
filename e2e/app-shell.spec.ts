import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { canSeedSession, seedSessionCookie, sessionCookieName } from './fixtures/session';

/**
 * The signed-in app shell's chrome contract, as executable assertions.
 *
 * The handoff calls these "rules, not pixel suggestions", and every one of them
 * is the kind of thing that regresses silently: nothing throws when a header
 * remounts, when the scroll container stops being the only scroller, or when a
 * drawer stops trapping focus. Until this file existed the whole contract was
 * held up by comments and by where one component happened to be mounted.
 *
 * Environment: like every other authenticated spec here, this cannot pass under
 * plain `npm run dev` — src/lib/db.ts imports the wasm/workerd Prisma engine on
 * purpose, so auth()'s jwt callback throws there and every request 401s. Run it
 * via `node scripts/e2e-workerd.mjs` (CI's "Mandatory authenticated E2E suite").
 * See the long note at the top of e2e/auth.spec.ts.
 *
 * Unlike the other authenticated specs, this one does NOT depend on the
 * hand-maintained session-cookie secret — it seeds its own user and signs its
 * own cookie (see e2e/fixtures/session.ts). A contract suite that skips when a
 * secret is missing protects nothing, and its own greenness would be the lie.
 */

const FAN_EMAIL = 'e2e-shell-fan@ihype.org';
const CREATOR_EMAIL = 'e2e-shell-creator@ihype.org';

// The geometry table from the handoff. Header hidden shifts strip to 0 and
// content to 52; the player offsets content bottom by 118 and the drawer by 120.
const HEADER_H = 82;
const STRIP_H = 52;
const CHROME_H = HEADER_H + STRIP_H; // 134

test.skip(!canSeedSession(), 'Needs E2E_WORKERD_DATABASE_URL + AUTH_SECRET to seed a session.');

async function signIn(context: BrowserContext, email: string, profiles: { type: 'ARTIST' | 'DJ' | 'VENUE'; name: string }[] = []) {
  const { cookie } = await seedSessionCookie(email, { profiles });
  await context.addCookies([{
    name: sessionCookieName(),
    value: cookie,
    domain: new URL(process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000').hostname,
    path: '/',
    secure: process.env.PLAYWRIGHT_AUTH_COOKIE_SECURE === 'true',
  }]);
}

/**
 * Waits for the shell to actually be mounted, not merely for the URL to change.
 *
 * `.shell-root` is checked with toBeAttached, not toBeVisible: every one of its
 * children is fixed- or absolutely-positioned (that IS the chrome contract), so
 * the wrapper itself has a zero-height box and Playwright correctly reports it
 * as hidden. The content region is the one with real dimensions.
 */
async function waitForShell(page: Page) {
  await expect(page.locator('.shell-root')).toBeAttached({ timeout: 20000 });
  await expect(page.locator('.shell-content')).toBeVisible({ timeout: 20000 });
}

function box(page: Page, selector: string) {
  return page.locator(selector).evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return { top: rect.top, height: rect.height, width: rect.width, bottom: window.innerHeight - rect.bottom };
  });
}

test.describe('App shell — chrome contract', () => {
  test.beforeEach(async ({ context }) => {
    await signIn(context, FAN_EMAIL);
  });

  test('rule 2: the content region is the only scroll container', async ({ page }) => {
    await page.goto('/shows?tab=local');
    await waitForShell(page);

    const overflow = await page.evaluate(() => ({
      html: getComputedStyle(document.documentElement).overflowY,
      body: getComputedStyle(document.body).overflowY,
      content: getComputedStyle(document.querySelector('.shell-content')!).overflowY,
      contentPosition: getComputedStyle(document.querySelector('.shell-content')!).position,
    }));
    expect(overflow.html).toBe('hidden');
    expect(overflow.body).toBe('hidden');
    expect(overflow.content).toBe('auto');
    expect(overflow.contentPosition).toBe('absolute');
  });

  test('the vertical geometry table holds', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/shows?tab=local');
    await waitForShell(page);

    const header = await box(page, '.shell-header');
    expect(header.top).toBe(0);
    expect(Math.round(header.height)).toBe(HEADER_H);

    const strip = await box(page, '.shell-context-strip');
    expect(Math.round(strip.top)).toBe(HEADER_H);
    expect(Math.round(strip.height)).toBe(STRIP_H);

    const content = await box(page, '.shell-content');
    expect(Math.round(content.top)).toBe(CHROME_H);

    const zIndexes = await page.evaluate(() => ({
      header: getComputedStyle(document.querySelector('.shell-header')!).zIndex,
      strip: getComputedStyle(document.querySelector('.shell-context-strip')!).zIndex,
    }));
    expect(zIndexes.header).toBe('60');
    expect(zIndexes.strip).toBe('59');
  });

  test('rule 1: the chrome does not remount on navigation', async ({ page }) => {
    // The contract's first rule, and the one with no other protection: moving
    // AppShell out of the root layout into a route-group layout would break it
    // while every other check stayed green. Tag the live DOM nodes, navigate,
    // and see whether the same nodes are still there.
    await page.goto('/shows?tab=local');
    await waitForShell(page);
    await page.evaluate(() => {
      document.querySelector('.shell-header')!.setAttribute('data-e2e-probe', 'header');
      document.querySelector('.shell-content')!.setAttribute('data-e2e-probe', 'content');
    });

    await page.locator('.shell-context-strip a', { hasText: 'Recommended' }).click();
    await expect(page).toHaveURL(/tab=foryou/, { timeout: 15000 });

    // The header must be the very same element. The content region is allowed
    // to keep its identity too — only `children` inside it may be replaced.
    await expect(page.locator('.shell-header[data-e2e-probe="header"]')).toHaveCount(1);
    await expect(page.locator('.shell-content[data-e2e-probe="content"]')).toHaveCount(1);
  });

  test('scroll resets on forward navigation and restores on Back', async ({ page }) => {
    await page.goto('/shows?tab=foryou');
    await waitForShell(page);

    // Give the region something to scroll on EVERY route, so the assertion is
    // about the shell rather than about how much content a sparse database
    // happens to have. A style tag rather than an injected node: this survives
    // soft navigation (it lives in <head>, which React never replaces), so the
    // Back leg is still scrollable when we return to it.
    await page.addStyleTag({ content: '.shell-content-inner { min-height: 4000px; }' });
    await page.evaluate(() => { document.querySelector('.shell-content')!.scrollTop = 900; });
    expect(await page.evaluate(() => document.querySelector('.shell-content')!.scrollTop)).toBe(900);

    await page.locator('.shell-context-strip a', { hasText: 'My Tickets' }).click();
    await expect(page).toHaveURL(/tab=tickets/, { timeout: 15000 });
    await expect
      .poll(() => page.evaluate(() => document.querySelector('.shell-content')!.scrollTop), { timeout: 5000 })
      .toBe(0);

    await page.goBack();
    await expect(page).toHaveURL(/tab=foryou/, { timeout: 15000 });
    // Back restores the remembered offset for that URL exactly.
    await expect
      .poll(() => page.evaluate(() => document.querySelector('.shell-content')!.scrollTop), { timeout: 5000 })
      .toBe(900);
  });

  test('rules 3 + 4: header auto-hides on mobile scroll, never on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 780 });
    await page.goto('/me/dashboard');
    await waitForShell(page);

    const scrollBy = (y: number) => page.evaluate((top) => {
      const node = document.querySelector('.shell-content')! as HTMLElement;
      const filler = document.createElement('div');
      filler.style.height = '3000px';
      node.querySelector('.shell-content-inner')!.append(filler);
      node.scrollTop = top;
      node.dispatchEvent(new Event('scroll'));
    }, y);

    // Below the 24px threshold: still visible.
    await scrollBy(10);
    await expect(page.locator('.shell-root')).toHaveAttribute('data-header-hidden', 'false');

    await scrollBy(400);
    await expect(page.locator('.shell-root')).toHaveAttribute('data-header-hidden', 'true', { timeout: 5000 });

    // Returning to the top restores it.
    await scrollBy(0);
    await expect(page.locator('.shell-root')).toHaveAttribute('data-header-hidden', 'false', { timeout: 5000 });

    // Desktop chrome is always visible, however far the region scrolls.
    await page.setViewportSize({ width: 1280, height: 900 });
    await scrollBy(800);
    await expect(page.locator('.shell-root')).toHaveAttribute('data-header-hidden', 'false', { timeout: 5000 });
  });
});

test.describe('App shell — drawer', () => {
  test.beforeEach(async ({ context }) => {
    await signIn(context, FAN_EMAIL);
  });

  test('the logo tile is the only menu affordance, and mirrors drawer state', async ({ page }) => {
    await page.goto('/shows?tab=local');
    await waitForShell(page);

    const tile = page.locator('.shell-logo-tile');
    await expect(tile).toHaveAttribute('aria-expanded', 'false');
    // "There is no hamburger" — nothing else in the chrome opens the menu.
    await expect(page.locator('.shell-header .nav-drawer-trigger')).toHaveCount(0);

    await tile.click();
    await expect(page.locator('.shell-drawer')).toBeVisible();
    await expect(tile).toHaveAttribute('aria-expanded', 'true');
  });

  test('rules 5 + 6: overlay edges line up with the strip and clear the player', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/shows?tab=local');
    await waitForShell(page);
    await page.locator('.shell-logo-tile').click();
    await expect(page.locator('.shell-drawer')).toBeVisible();

    const drawer = await box(page, '.shell-drawer');
    expect(Math.round(drawer.top)).toBe(CHROME_H);
    expect(Math.round(drawer.width)).toBe(308);

    const scrim = await box(page, '.shell-scrim');
    expect(Math.round(scrim.top)).toBe(CHROME_H);

    // An overlay reserves no layout space: the content region is unmoved.
    const content = await box(page, '.shell-content');
    expect(Math.round(content.top)).toBe(CHROME_H);
  });

  test('traps focus, and returns it to the logo tile on Escape', async ({ page }) => {
    await page.goto('/shows?tab=local');
    await waitForShell(page);
    await page.locator('.shell-logo-tile').click();
    await expect(page.locator('.shell-drawer')).toBeVisible();

    // Focus moved into the drawer on open.
    expect(await page.evaluate(() =>
      document.querySelector('.shell-drawer')!.contains(document.activeElement))).toBe(true);

    // Tabbing many times never escapes it.
    for (let i = 0; i < 25; i += 1) await page.keyboard.press('Tab');
    expect(await page.evaluate(() =>
      document.querySelector('.shell-drawer')!.contains(document.activeElement))).toBe(true);

    await page.keyboard.press('Escape');
    await expect(page.locator('.shell-drawer')).toHaveCount(0);
    expect(await page.evaluate(() =>
      document.activeElement?.classList.contains('shell-logo-tile'))).toBe(true);
  });

  test('the scrim dismisses it', async ({ page }) => {
    await page.goto('/shows?tab=local');
    await waitForShell(page);
    await page.locator('.shell-logo-tile').click();
    await expect(page.locator('.shell-drawer')).toBeVisible();
    // Clear of the drawer: it is 308px wide and pinned to the left edge, so a
    // click near the origin lands on the panel, not the scrim.
    await page.locator('.shell-scrim').click({ position: { x: 700, y: 300 } });
    await expect(page.locator('.shell-drawer')).toHaveCount(0);
  });

  test('navigating expands the section that owns the route, single-open', async ({ page }) => {
    await page.goto('/me/dashboard');
    await waitForShell(page);
    await page.locator('.shell-logo-tile').click();

    const heads = page.locator('.shell-drawer-card-head');
    // PAGES owns /me/dashboard, so it is the section that starts expanded, and
    // it is the only one.
    await expect(heads.filter({ hasText: 'Pages' })).toHaveAttribute('aria-expanded', 'true');
    expect(await heads.evaluateAll((nodes) =>
      nodes.filter((n) => n.getAttribute('aria-expanded') === 'true').length)).toBe(1);

    await heads.filter({ hasText: 'Events' }).click();
    await expect(heads.filter({ hasText: 'Events' })).toHaveAttribute('aria-expanded', 'true');
    await expect(heads.filter({ hasText: 'Pages' })).toHaveAttribute('aria-expanded', 'false');
  });
});

test.describe('App shell — navigation manifest', () => {
  test('a plain fan sees no creator rows', async ({ page, context }) => {
    await signIn(context, FAN_EMAIL);
    await page.goto('/pages?tab=creator');
    await waitForShell(page);
    await page.locator('.shell-logo-tile').click();
    // PAGES owns this route, so the accordion already opened it — clicking the
    // header here would COLLAPSE it, which is what made this test fail first
    // time round.
    const drawer = page.locator('.shell-drawer');
    await expect(drawer.locator('.shell-drawer-card-head').filter({ hasText: 'Pages' }))
      .toHaveAttribute('aria-expanded', 'true');
    await expect(drawer.getByText('My Dashboard')).toBeVisible();
    await expect(drawer.getByText('Tour Creator')).toHaveCount(0);
    await expect(drawer.getByText('Show Creator')).toHaveCount(0);
    await expect(drawer.getByText('Event Creator')).toHaveCount(0);
  });

  test('an account holding Artist sees exactly that creator', async ({ page, context }) => {
    // Was "Artist and DJ". Show Creator went with the DJ role — radio is
    // computed per listener now (src/lib/stations.ts) and there is nothing for
    // a person to author, so the destination no longer exists in the manifest.
    // The DJ profile is still seeded here on purpose: three such rows survive
    // until the data migration, and holding one must not resurrect a creator
    // or break the gates around it.
    await signIn(context, CREATOR_EMAIL, [
      { type: 'ARTIST', name: 'E2E Artist' },
      { type: 'DJ', name: 'E2E DJ' },
    ]);
    await page.goto('/pages?tab=creator');
    await waitForShell(page);
    await page.locator('.shell-logo-tile').click();

    const drawer = page.locator('.shell-drawer');
    await expect(drawer.getByText('Tour Creator')).toBeVisible();
    await expect(drawer.getByText('Show Creator')).toHaveCount(0);
    // Not a venue — this gate must stay closed.
    await expect(drawer.getByText('Event Creator')).toHaveCount(0);
  });

  test('the context strip marks the active route with aria-current', async ({ page, context }) => {
    await signIn(context, FAN_EMAIL);
    await page.goto('/shows?tab=foryou');
    await waitForShell(page);

    const strip = page.locator('.shell-context-strip');
    await expect(strip.getByText('Events')).toBeVisible();
    await expect(strip.locator('[aria-current="page"]')).toHaveText('Recommended');

    await strip.locator('a', { hasText: 'My Tickets' }).click();
    await expect(page).toHaveURL(/tab=tickets/, { timeout: 15000 });
    await expect(strip.locator('[aria-current="page"]')).toHaveText('My Tickets');
  });
});

test.describe('App shell — scope', () => {
  test('the landing page sends a signed-in member into the shell', async ({ page, context }) => {
    await signIn(context, FAN_EMAIL);
    await page.goto('/');
    // `/` redirects an authenticated member to WORKBENCH_PATH, so a signed-in
    // visitor never sees the marketing landing page at all. That path is now
    // the Music · Map · Me shell rather than `/listen`'s module deck — the
    // cutover recorded in DESIGN_SYNC row 268.
    await expect(page).toHaveURL(/\/app\/map/, { timeout: 15000 });
    await expect(page.locator('.mmm-frame')).toBeVisible({ timeout: 20000 });
    // AppShell must stand aside for /app exactly as it does for /listen —
    // mounting both would put an 82px header back over the map.
    await expect(page.locator('.shell-root')).toHaveCount(0);
    await expect(page.locator('.mas-root.is-active')).toHaveCount(0);
    await expect(page.locator('.site-dock')).toBeHidden();
  });

  test('a marketing route keeps the marketing chrome even when signed in', async ({ page, context }) => {
    await signIn(context, FAN_EMAIL);
    // A recruiting page: public, not in the shell's route registry, and it does
    // not redirect an authenticated visitor.
    await page.goto('/for-artists');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('.shell-root')).toHaveCount(0);
    await expect(page.locator('.site-shell')).toBeAttached();
    expect(await page.evaluate(() =>
      document.documentElement.classList.contains('ihype-shell-locked'))).toBe(false);
  });

  test('an unauthenticated visitor gets no shell and is sent to login', async ({ page }) => {
    await page.goto('/listen');
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
    await expect(page.locator('.shell-root')).toHaveCount(0);
  });
});
