import { expect, test, type Page, type TestInfo } from '@playwright/test';

const modules = [
  [/Around you/i, '.deck-map-module'],
  [/Discover/i, '.discover-module'],
  [/Radio/i, '.radio-module'],
  [/(Dashboard|Me)/i, '.dashboard-module'],
  [/Settings/i, '.settings-module'],
  [/Community/i, '.community-module'],
] as const;

const states = [
  { name: 'phone-320', width: 320, height: 720 },
  { name: 'phone-375', width: 375, height: 812 },
  { name: 'phone-390', width: 390, height: 844 },
  { name: 'phone-430', width: 430, height: 932 },
  { name: 'landscape', width: 844, height: 390 },
] as const;

async function openModule(page: Page, label: RegExp, selector: string) {
  const current = await page.locator('.module-deck-preview').getAttribute('data-active-module');
  const expected = selector.replace(/^\./, '').replace(/-module$/, '').replace('deck-map', 'map');
  if (current !== expected) {
    if (expected === 'settings' || expected === 'community') {
      await page.getByRole('button', { name: 'Open account menu' }).click();
      await page.locator('.deck-account-menu').getByRole('button', { name: label }).click();
    } else {
      await page.getByRole('button', { name: /iHYPE module navigator/ }).click();
      await page.locator('.deck-navigator').getByRole('button', { name: label }).click();
    }
  }
  await expect(page.locator(selector)).toBeVisible();
  // Measure the settled module, not an intermediate frame from the intentional
  // scene transition or a late font/layout pass on a busy parallel run.
  await expect.poll(() => page.locator(selector).evaluate((element) => Math.round(element.getBoundingClientRect().left)), { timeout: 2_000 }).toBeGreaterThanOrEqual(-1);
}

async function assertLayoutBudget(page: Page, selector: string) {
  const result = await page.evaluate((moduleSelector) => {
    const root = document.querySelector('.module-deck-preview') as HTMLElement | null;
    const module = document.querySelector(moduleSelector) as HTMLElement | null;
    const heading = module?.querySelector('h1') as HTMLElement | null;
    const player = document.querySelector('.deck-player') as HTMLElement | null;
    if (!root || !module || !heading || !player) return { missing: true };
    const moduleRect = module.getBoundingClientRect();
    const headingRect = heading.getBoundingClientRect();
    const playerRect = player.getBoundingClientRect();
    const lineHeight = Number.parseFloat(getComputedStyle(heading).lineHeight);
    const discoverCopy = module.querySelector('.discover-card-copy') as HTMLElement | null;
    const discoverActions = module.querySelector('.discover-actions') as HTMLElement | null;
    const discoverOverlap = discoverCopy && discoverActions
      ? (() => {
          const copy = discoverCopy.getBoundingClientRect();
          const actions = discoverActions.getBoundingClientRect();
          return Math.max(0, Math.min(copy.right, actions.right) - Math.max(copy.left, actions.left))
            * Math.max(0, Math.min(copy.bottom, actions.bottom) - Math.max(copy.top, actions.top));
        })()
      : null;
    const requiredButtons = Array.from(document.querySelectorAll('.deck-logo,.deck-profile,.deck-player-controls button,.discover-actions button'))
      .filter((element) => (element as HTMLElement).offsetParent !== null)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return { label: element.getAttribute('aria-label') || element.textContent?.trim() || element.className, width: rect.width, height: rect.height };
      })
      .filter((target) => target.width < 43.5 || target.height < 43.5);
    return {
      missing: false,
      documentOverflow: document.documentElement.scrollWidth - window.innerWidth,
      moduleLeft: moduleRect.left,
      moduleRight: moduleRect.right - window.innerWidth,
      headingLines: lineHeight > 0 ? headingRect.height / lineHeight : 0,
      headingViewportShare: headingRect.height / window.innerHeight,
      headingPlayerOverlap: headingRect.bottom - playerRect.top,
      discoverOverlap,
      requiredButtons,
    };
  }, selector);

  expect(result.missing).toBe(false);
  expect(result.documentOverflow, 'document must not overflow horizontally').toBeLessThanOrEqual(1);
  expect(result.moduleLeft, 'module must remain inside the left viewport edge').toBeGreaterThanOrEqual(-1);
  expect(result.moduleRight, 'module must remain inside the right viewport edge').toBeLessThanOrEqual(1);
  expect(result.headingLines, 'module hero is limited to two lines').toBeLessThanOrEqual(2.15);
  expect(result.headingViewportShare, 'module hero must not dominate the phone viewport').toBeLessThanOrEqual(0.17);
  expect(result.headingPlayerOverlap, 'module hero must not collide with the player').toBeLessThanOrEqual(0);
  if (result.discoverOverlap !== null) {
    expect(result.discoverOverlap, 'Discover actions must not overlap artist metadata').toBe(0);
  }
  expect(result.requiredButtons, 'primary mobile controls must meet a 44px target').toEqual([]);
}

async function attachEvidence(page: Page, testInfo: TestInfo, name: string) {
  await testInfo.attach(name, {
    body: await page.screenshot({ animations: 'disabled', fullPage: false }),
    contentType: 'image/png',
  });
}

test.describe('Module deck responsive regression gate', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('ihype:module-guide-seen', '1');
      window.localStorage.setItem('ihype:preview-active-module', '0');
    });
  });

  for (const state of states) {
    test(`${state.name} keeps every module inside its content budget`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: state.width, height: state.height });
      await page.goto('/ui-preview');
      await expect(page.locator('.module-deck-preview')).toBeVisible();
      for (const [label, selector] of modules) {
        await openModule(page, label, selector);
        await assertLayoutBudget(page, selector);
        if (state.name === 'phone-390') await attachEvidence(page, testInfo, `${state.name}-${selector.replaceAll('.', '').replaceAll('-', '_')}`);
      }
    });
  }

  test('light theme, reduced motion, and 200% text remain usable', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
    await page.goto('/ui-preview');
    await page.evaluate(() => {
      document.documentElement.dataset.theme = 'light';
      document.documentElement.style.fontSize = '200%';
    });
    for (const [label, selector] of modules) {
      await openModule(page, label, selector);
      await assertLayoutBudget(page, selector);
    }
    await attachEvidence(page, testInfo, 'phone-390-light-reduced-motion-200-text');
  });

  test('mobile keeps four primary destinations and moves utilities into the account menu', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/ui-preview');

    await page.getByRole('button', { name: /Open iHYPE module navigator/i }).click();
    await expect(page.locator('.deck-navigator .is-primary-module:visible')).toHaveCount(4);
    await expect(page.locator('.deck-navigator .is-utility-module:visible')).toHaveCount(0);
    await expect(page.locator('.deck-navigator')).toContainText('Me');
    await attachEvidence(page, testInfo, 'phone-390-four-destination-menu');
    await page.getByRole('button', { name: /Close iHYPE module navigator/i }).click();

    await page.getByRole('button', { name: 'Open account menu' }).click();
    await expect(page.locator('.deck-account-menu').getByRole('button', { name: /Community/i })).toBeVisible();
    await expect(page.locator('.deck-account-menu').getByRole('button', { name: /Settings/i })).toBeVisible();
    await expect(page.locator('.deck-account-menu').getByRole('link', { name: /Log out/i })).toBeVisible();
  });

  test('mobile compact player exposes transport controls and an accessible full player', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/ui-preview');

    await expect(page.getByRole('button', { name: 'Previous song' })).toBeVisible();
    await expect(page.getByRole('button', { exact: true, name: 'Play' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Next song' })).toBeVisible();
    await page.getByRole('button', { name: 'Open full player' }).click();
    await expect(page.getByRole('dialog', { name: 'Full music player' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Close full player' })).toBeFocused();
    await expect(page.getByRole('dialog', { name: 'Full music player' })).toContainText('PLAY QUEUE');
    await expect(page.getByRole('dialog', { name: 'Full music player' }).getByRole('button', { name: 'HYPE' })).toBeVisible();
  });
});
