import { test, expect } from '@playwright/test';

// Exercises the persistent mobile app shell (Listen/Events/Pages) via /shows,
// the one shell route that needs no auth — visiting any of the 3 shell
// routes on a mobile viewport mounts all 3 sections together, so this still
// covers Listen/Pages' presence in the shell, not just Events.
//
// Explicit mobile viewport/touch overrides (rather than relying on the
// separate "Mobile Safari" project, which only runs locally) so this suite
// runs under the same chromium project CI already uses.
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

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

test.describe('Mobile app shell', () => {
  test('persistent shell activates and shows the grid/home view', async ({ page }) => {
    await page.goto('/shows');
    await expect(page.locator('.mas-root.is-active')).toHaveCount(1);
    await expect(page.locator('.mqg-overlay.is-active')).toHaveCount(1);
    await expect(page.locator('.ihype-mobile-nav')).toBeVisible();
  });

  test('tapping a grid button reveals tab content; back button returns to the grid', async ({ page }) => {
    await page.goto('/shows');
    const gridButtons = page.locator('.mqg-overlay.is-active .mqg-btn:not(.mqg-spacer)');
    await expect(gridButtons.first()).toBeVisible();
    await gridButtons.first().click();
    await expect(page.locator('.mqg-content:not(.is-hidden)')).toHaveCount(1);

    await page.locator('.mqg-content:not(.is-hidden) .mqg-back').click();
    await expect(page.locator('.mqg-overlay.is-active')).toHaveCount(1);
  });

  test('switching tabs resets scroll to top', async ({ page }) => {
    await page.goto('/shows');
    await page.locator('.mqg-overlay.is-active .mqg-btn:not(.mqg-spacer)').first().click();

    const scrollable = await page.evaluate(() => {
      const slot = document.querySelector('.mas-slot');
      return !!slot && slot.scrollHeight > slot.clientHeight + 100;
    });
    test.skip(!scrollable, 'not enough content in this environment to exercise scroll reset');

    await page.evaluate(() => {
      const slot = document.querySelector('.mas-slot');
      if (slot) slot.scrollTop = 300;
    });
    const tabs = page.locator('.mqg-content:not(.is-hidden) .mqg-tabstrip > *');
    await tabs.nth(1).click();
    await expect
      .poll(() => page.evaluate(() => document.querySelector('.mas-slot')?.scrollTop ?? 0))
      .toBe(0);
  });

  test('swiping the grid overlay moves to the next section', async ({ page }) => {
    await page.goto('/shows');
    const overlay = page.locator('.mqg-overlay.is-active');
    const box = await overlay.boundingBox();
    if (!box) throw new Error('grid overlay bounding box not found');

    // Swipe high up in the overlay, above the 4 grid buttons, so the drag
    // doesn't land on (and trigger) a button tap instead.
    const startX = box.x + box.width * 0.85;
    const endX = box.x + box.width * 0.1;
    const y = box.y + box.height * 0.18;

    await dispatchTouch(page, '.mqg-overlay.is-active', 'touchstart', startX, y);
    await dispatchTouch(page, '.mqg-overlay.is-active', 'touchmove', (startX + endX) / 2, y);
    await dispatchTouch(page, '.mqg-overlay.is-active', 'touchend', endX, y);

    await expect(page.locator('.ihype-mobile-nav a[href="/pages"]')).toHaveCSS('color', 'rgb(255, 80, 41)');
  });

  test('swiping inside an open sub-tab does not change section', async ({ page }) => {
    await page.goto('/shows');
    await page.locator('.mqg-overlay.is-active .mqg-btn:not(.mqg-spacer)').first().click();
    const content = page.locator('.mqg-content:not(.is-hidden)');
    await expect(content).toHaveCount(1);

    const box = await content.boundingBox();
    if (!box) throw new Error('open sub-tab content bounding box not found');

    // Same horizontal swipe gesture as the grid-overlay test above, but
    // dispatched on the drilled-in content instead of the grid — this used
    // to also move between Listen/Events/Pages (MobileAppShell's own
    // carousel drag listens on the whole track), which fought with any
    // content that wants to own horizontal drags itself (e.g. Seeds' card
    // deck) and hijacked ordinary interaction with a sub-tab.
    const startX = box.x + box.width * 0.85;
    const endX = box.x + box.width * 0.1;
    const y = box.y + box.height * 0.3;

    await dispatchTouch(page, '.mqg-content:not(.is-hidden)', 'touchstart', startX, y);
    await page.waitForTimeout(50);
    await dispatchTouch(page, '.mqg-content:not(.is-hidden)', 'touchmove', (startX + endX) / 2, y);
    await page.waitForTimeout(50);
    await dispatchTouch(page, '.mqg-content:not(.is-hidden)', 'touchend', endX, y);
    // A regressed version of this fix would react to the swipe asynchronously
    // (setState -> history.pushState -> re-render) — give that a beat before
    // asserting, otherwise a `.not.toHaveCSS` check can pass on a stale
    // pre-update snapshot instead of actually proving nothing changed.
    await page.waitForTimeout(400);

    // Still on Events (/shows) — the swipe inside the sub-tab had no effect.
    await expect(page.locator('.ihype-mobile-nav a[href="/shows"]')).toHaveCSS('color', 'rgb(255, 80, 41)');
    await expect(page.locator('.ihype-mobile-nav a[href="/pages"]')).not.toHaveCSS('color', 'rgb(255, 80, 41)');
  });

  test('pull-to-refresh shows a spinning indicator past the trigger threshold', async ({ page }) => {
    await page.goto('/shows');
    await page.locator('.mqg-overlay.is-active .mqg-btn:not(.mqg-spacer)').first().click();
    await expect(page.locator('.mqg-content:not(.is-hidden)')).toHaveCount(1);

    // PullToRefresh's wrapping div is the direct parent of .mqg-content.
    const target = '.mqg-content:not(.is-hidden)';
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.evaluate((selector) => {
      const el = document.querySelector(selector)?.parentElement;
      if (el) (el as HTMLElement).dataset.qaPullTarget = 'true';
    }, target);
    const wrapperSelector = '[data-qa-pull-target="true"]';

    // Delay the refresh's own network round-trip so the spinner is
    // guaranteed to still be visible when we assert on it below — without
    // this, a fast enough response can flip `refreshing` back to false
    // before the assertion gets a chance to poll for it.
    await page.route('**/api/shows/directory', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.continue();
    });

    await dispatchTouch(page, wrapperSelector, 'touchstart', 200, 100);
    await page.waitForTimeout(100);
    // dy=240 from the original start -> pull caps at 90px, well past the 64px trigger.
    await dispatchTouch(page, wrapperSelector, 'touchmove', 200, 340);
    await page.waitForTimeout(150);
    await dispatchTouch(page, wrapperSelector, 'touchend', 200, 340);

    await expect(page.locator('.pull-to-refresh-spinner.spinning')).toBeVisible({ timeout: 2000 });
  });
});

test.describe('AppSplash (installed-PWA launch splash)', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

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
