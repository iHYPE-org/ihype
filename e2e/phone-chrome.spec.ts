import { test, expect, type BrowserContext } from '@playwright/test';
import { canSeedSession, seedSessionCookie, sessionCookieName } from './fixtures/session';

/**
 * What a signed-in phone actually gets on a legacy (non-`/app`) route.
 *
 * This replaces `mobile-shell.spec.ts`, which exercised the phone swipe shell:
 * a second app shell that kept `/listen`, `/shows` and `/pages` permanently
 * mounted, swiped between them without navigating, and put a full-screen quick
 * grid in front of each. Design System 8 retires all of it — there is no
 * separate mobile build, `templates/simplified-app/` IS the app at every width
 * — so those assertions describe a surface that no longer exists.
 *
 * What survives is what is still real and still phone-specific: the bottom nav,
 * pull-to-refresh, the drawer as the only way around, and the installed-PWA
 * splash.
 */

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

const FAN_EMAIL = 'e2e-phone-chrome@ihype.org';

test.skip(!canSeedSession(), 'Needs E2E_WORKERD_DATABASE_URL + AUTH_SECRET to seed a session.');

async function signIn(context: BrowserContext) {
  const { cookie, user } = await seedSessionCookie(FAN_EMAIL);
  await context.addCookies([{
    name: sessionCookieName(),
    value: cookie,
    domain: new URL(process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000').hostname,
    path: '/',
    secure: process.env.PLAYWRIGHT_AUTH_COOKIE_SECURE === 'true',
  }]);
  // Keep drawer behaviour deterministic: the first-sign-in menu demo has its
  // own coverage and otherwise schedules a close while a test is deliberately
  // interacting with the drawer.
  await context.addInitScript((userId) => {
    window.sessionStorage.setItem('ihype-menu-introduced-this-signin', userId);
  }, user.id);
}

async function dispatchTouch(page: import('@playwright/test').Page, selector: string, type: string, x: number, y: number) {
  await page.evaluate(
    ({ selector, type, x, y }) => {
      const target = document.querySelector(selector);
      if (!target) return;
      const t = new Touch({ identifier: 1, target, clientX: x, clientY: y });
      target.dispatchEvent(
        new TouchEvent(type, { bubbles: true, cancelable: true, touches: type === 'touchend' ? [] : [t], changedTouches: [t] })
      );
    },
    { selector, type, x, y }
  );
}

test.describe('Phone chrome on a legacy route', () => {
  test.beforeEach(async ({ context }) => {
    await signIn(context);
  });

  test('renders the page content directly, inside the one app shell', async ({ page }) => {
    await page.goto('/shows');
    // The tab strip is the landing state now: it used to be hidden behind a
    // full-screen quick grid at this width, belonging to a second shell.
    await expect(page.locator('.section-tabstrip')).toBeVisible();
    await expect(page.locator('.shell-content')).toBeVisible();
    await expect(page.locator('.ihype-mobile-nav')).toBeVisible();
    await expect(page.locator('#main-content')).toBeVisible();
  });

  test('the drawer navigates off the route, and there is exactly one of it', async ({ page }) => {
    test.slow(); // first-hit route compile in dev can be slow
    await page.goto('/shows');
    // Warm /info so a lazy first compile does not eat the navigation timeout.
    await page.request.get('/info');

    // On a shell route the SHELL owns the chrome at every width — its logo tile
    // is the trigger, and the marketing header is stood down. Before the phone
    // swipe shell was retired, a phone got the marketing header's drawer here
    // instead, because the shell stood aside for the swipe shell. One shell,
    // one menu: assert that rather than which one won.
    await page.locator('.shell-logo-tile').click();
    const menu = page.getByRole('dialog', { name: 'iHYPE menu' });
    await expect(menu).toHaveCount(1);

    // role="dialog", not navigation: the drawer is a <nav> carrying an explicit
    // role, and an explicit role wins over the implicit one. And 'Settings',
    // not 'SETTINGS' — the uppercase is text-transform, which never reaches the
    // accessibility tree, while `exact: true` is case-sensitive.
    await menu.getByRole('button', { name: 'Settings', exact: true }).click();
    await menu.locator('a[href="/info"]').click();
    await page.waitForURL('**/info');

    await expect(page.locator('#main-content')).toBeVisible();
  });

  test('pull-to-refresh arms on the shell content and pulls past the trigger', async ({ page }) => {
    await page.goto('/shows');
    // Wait for the SHELL, not just the content: the session resolves on the
    // client, so the first paint is the signed-out fallback tree and React
    // swaps the whole subtree when the shell takes over. Marking a node before
    // that swap tags a element that is about to be thrown away, and the touch
    // then lands on nothing.
    await expect(page.locator('.shell-content')).toBeVisible();
    await expect(page.locator('.section-content')).toHaveCount(1);

    // PullToRefresh's wrapping div is the direct parent of .section-content.
    // Scroll the SHELL's content region, not the window: inside the shell the
    // document never scrolls, which is exactly what the component now reads —
    // it used to read `window.scrollY`, permanently 0 here, so it armed no
    // matter how far down the finger started.
    await page.evaluate(() => {
      window.scrollTo(0, 0);
      document.querySelector('.shell-content')?.scrollTo(0, 0);
      const el = document.querySelector('.section-content')?.parentElement;
      if (el) (el as HTMLElement).dataset.qaPullTarget = 'true';
    });
    const wrapperSelector = '[data-qa-pull-target="true"]';
    const indicator = page.locator('.ptr-indicator');

    await dispatchTouch(page, wrapperSelector, 'touchstart', 200, 100);
    await page.waitForTimeout(100);
    // dy=240 from the start -> pull caps at 90px, past the 64px trigger.
    await dispatchTouch(page, wrapperSelector, 'touchmove', 200, 340);

    // Asserted mid-gesture rather than after release. The post-release state is
    // `refreshing`, which ends when the refresh's network fan-out settles, and
    // that is a race no amount of route-delaying wins reliably: `refreshAll`
    // hits several endpoints and any one of them resolving flips it back.
    // Earlier revisions of this assertion passed alone and failed in a full
    // run. The gesture arming is the behaviour worth protecting.
    await expect(indicator).toHaveJSProperty('offsetHeight', 90);

    await dispatchTouch(page, wrapperSelector, 'touchend', 200, 340);
  });

  test('pull-to-refresh stays disarmed when the shell content is scrolled', async ({ page }) => {
    await page.goto('/shows');
    await expect(page.locator('.shell-content')).toBeVisible();
    await expect(page.locator('.section-content')).toHaveCount(1);
    const scrolled = await page.evaluate(() => {
      const content = document.querySelector('.shell-content');
      if (content) content.scrollTop = content.scrollHeight;
      const el = document.querySelector('.section-content')?.parentElement;
      if (el) (el as HTMLElement).dataset.qaPullTarget = 'true';
      // Read back: a short page cannot be scrolled, and then there is no
      // "mid-page" state for this invariant to be about.
      return content?.scrollTop ?? 0;
    });
    test.skip(scrolled === 0, 'Seeded /shows is shorter than the viewport — nothing to scroll.');
    const wrapperSelector = '[data-qa-pull-target="true"]';

    await dispatchTouch(page, wrapperSelector, 'touchstart', 200, 100);
    await page.waitForTimeout(100);
    await dispatchTouch(page, wrapperSelector, 'touchmove', 200, 340);

    // Pulling down mid-page must scroll, not refresh.
    await expect(page.locator('.ptr-indicator')).toHaveJSProperty('offsetHeight', 0);
    await dispatchTouch(page, wrapperSelector, 'touchend', 200, 340);
  });
});

test.describe('AppSplash (installed-PWA launch splash)', () => {
  test.beforeEach(async ({ context }) => {
    await signIn(context);
  });

  test('renders when display-mode is standalone, then fades on its own', async ({ page }) => {
    await page.addInitScript(() => {
      const orig = window.matchMedia.bind(window);
      // @ts-expect-error -- intentionally faking a narrower MediaQueryList shape for this one query
      window.matchMedia = (query: string) => {
        if (query.includes('display-mode: standalone')) {
          return {
            matches: true,
            media: query,
            addListener() {},
            removeListener() {},
            addEventListener() {},
            removeEventListener() {},
            dispatchEvent: () => true,
          };
        }
        return orig(query);
      };
    });
    await page.goto('/shows');
    await expect(page.locator('.app-splash')).toBeVisible();
    await expect(page.locator('.app-splash')).toHaveCount(0, { timeout: 3000 });
  });

  test('does not render on a normal (non-standalone) load', async ({ page }) => {
    await page.goto('/shows');
    await page.waitForTimeout(300);
    await expect(page.locator('.app-splash')).toHaveCount(0);
  });
});
