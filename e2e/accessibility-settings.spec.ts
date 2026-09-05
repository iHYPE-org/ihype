import { test, expect, type Page } from '@playwright/test';
import { applySessionCookie, canSeedSession } from './fixtures/session';

/**
 * Settings → Accessibility actually does what its cards say.
 *
 * Owner, 2026-09-05, from production: "Themes flowery through classical don't
 * actually change anything, only dark and light modes" and "Some languages
 * don't actually change anything". Neither could be reproduced in a sandbox,
 * and nothing in CI had ever pressed one of these pills — the responsive spec
 * stamps `data-theme` from an init script, which proves the stylesheet and
 * says nothing about the control. This spec presses the control.
 *
 * What is asserted is the CONTRACT, measured off the document rather than off
 * the pill's own `aria-pressed`: every theme pill puts its name on `<html>`
 * (Light removes the attribute — the default is the ABSENCE of it), the
 * resolved `--bg` token changes for each of the six, the four character
 * themes bring the console's textures back (`--dock-texture` resolves to a
 * url, not `none`), and a language pill changes the words on the page — the
 * heading, the section strip and the dock's tab labels, which are the three
 * places that were still English in every locale before this date.
 */
const EMAIL = 'e2e-accessibility-settings@ihype.org';
const STORAGE_KEY = 'ihype-accessibility-settings';

test.skip(!canSeedSession(), 'Needs E2E_WORKERD_DATABASE_URL + AUTH_SECRET to seed a session.');

async function openAccessibility(page: Page) {
  await page.goto('/app/me/accessibility');
  await expect(page.locator('h1.mmm-settings-title:visible').first()).toBeVisible();
}

function themeGroup(page: Page) {
  return page.locator('[role="group"][aria-label="Theme"]:visible').first();
}

async function resolved(page: Page, token: string) {
  return page.evaluate(
    `getComputedStyle(document.documentElement).getPropertyValue(${JSON.stringify(token)}).trim()`,
  ) as Promise<string>;
}

test.describe('Settings → Accessibility', () => {
  test.beforeEach(async ({ context }) => {
    await applySessionCookie(context, EMAIL, { profiles: [] });
  });

  test('every theme pill changes the ground, and the character themes bring the console back', async ({ page }) => {
    await openAccessibility(page);
    const group = themeGroup(page);
    const pills = group.locator('button');
    await expect(pills).toHaveCount(6);

    const grounds = new Map<string, string>();
    for (const name of ['Dark', 'Flowery', 'Street', 'Metal', 'Classical', 'Light']) {
      await group.getByRole('button', { name, exact: true }).click();
      const attr = await page.evaluate('document.documentElement.getAttribute("data-theme")');
      if (name === 'Light') {
        // 'console' is stored, and the default ground is the attribute's ABSENCE.
        expect(attr, 'Light must remove data-theme, not set one').toBeNull();
      } else {
        expect(attr).toBe(name.toLowerCase());
      }
      const bg = await resolved(page, '--bg');
      expect(bg, `${name} resolved no --bg`).not.toBe('');
      grounds.set(name, bg);

      const dockTexture = await resolved(page, '--dock-texture');
      if (['Flowery', 'Street', 'Metal', 'Classical'].includes(name)) {
        expect(dockTexture, `${name} should paint the console's walnut`).toMatch(/url\(/);
      } else {
        expect(dockTexture, `${name} is an Apple Music look with no texture`).toBe('none');
      }
      // The pill row agrees with the document.
      await expect(group.getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'true');
    }
    // Six pills, six grounds — no two themes paint the same page.
    expect(new Set(grounds.values()).size, [...grounds.entries()].map(([k, v]) => `${k}=${v}`).join(' ')).toBe(6);
  });

  test('a theme survives a reload, applied before the page hydrates', async ({ page }) => {
    await openAccessibility(page);
    await themeGroup(page).getByRole('button', { name: 'Flowery', exact: true }).click();
    await expect.poll(() => page.evaluate(`localStorage.getItem(${JSON.stringify(STORAGE_KEY)})`)).toContain('"theme":"flowery"');
    await page.reload();
    // The bootstrap in layout.tsx stamps the attribute before first paint, so
    // it is there on the very first read after load — no waiting for React.
    expect(await page.evaluate('document.documentElement.getAttribute("data-theme")')).toBe('flowery');
    // Leave the account on the default for the next test.
    await openAccessibility(page);
    await themeGroup(page).getByRole('button', { name: 'Light', exact: true }).click();
  });

  test('picking Español changes the heading, the section strip and the dock', async ({ page }) => {
    await openAccessibility(page);
    const heading = page.locator('h1.mmm-settings-title:visible').first();
    await expect(heading).toHaveText('Accessibility');
    const listenTab = page.locator('.mmm-tab-label:visible', { hasText: /^Listen$/ });
    await expect(listenTab).toHaveCount(1);

    const languages = page.locator('[role="group"][aria-label="Language"]:visible').first();
    await languages.getByRole('button', { name: 'Español', exact: true }).click();

    await expect(heading).toHaveText('Accesibilidad');
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    // The dock's four tabs are drawn by the shell layout, outside the page —
    // so a translation that reached only the page would leave them English.
    await expect(page.locator('.mmm-tab-label:visible', { hasText: /^Escuchar$/ })).toHaveCount(1);
    await expect(page.locator('.mmm-tab-label:visible', { hasText: /^Listen$/ })).toHaveCount(0);
    // And the section strip above the page (ME's Profiles · Info · Settings).
    await expect(page.locator('.mmm-strip-item:visible', { hasText: /^Ajustes$/ })).toHaveCount(1);

    // A server-rendered pane reads the same cookie: the artist counters and
    // panel titles come from getServerT(), not the client dictionary.
    await page.goto('/app/me');
    await expect(page.locator('.mmm-tab-label:visible', { hasText: /^Escuchar$/ })).toHaveCount(1);

    // Back to English so the fixture account does not leak a locale into
    // any other spec that reuses it.
    await openAccessibility(page);
    await page.locator('[role="group"]:visible').filter({ hasText: 'English' }).first()
      .getByRole('button', { name: 'English', exact: true }).click();
    await expect(heading).toHaveText('Accessibility');
  });
});
