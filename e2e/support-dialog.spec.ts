import { expect, test } from '@playwright/test';

// Network mocks must own these requests; offline behavior has its own suites.
test.use({ serviceWorkers: 'block' });

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => localStorage.setItem('ihype_cookie_consent', 'accepted'));
});

for (const sheet of [
  { trigger: /Report a Bug Something broken/i, title: 'Report a bug' },
  { trigger: /Privacy Report a problem/i, title: 'Privacy & your data' },
]) {
  test(`${sheet.title} traps focus and restores its opener`, async ({ page }) => {
    await page.goto('/support');
    const trigger = page.getByRole('button', { name: sheet.trigger });
    await trigger.press('Space');
    const dialog = page.getByRole('dialog', { name: sheet.title, exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeFocused();
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
      expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press('Shift+Tab');
    expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await trigger.press('Enter');
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(trigger).toBeFocused();
  });
}

test('empty bug reports stay in the dialog and announce validation', async ({ page }) => {
  await page.goto('/support');
  await page.getByRole('button', { name: /Report a Bug Something broken/i }).click();
  const dialog = page.getByRole('dialog', { name: 'Report a bug', exact: true });
  await dialog.getByRole('button', { name: 'Send Report', exact: true }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Please describe what happened.');
  await expect(page.getByText('Please fill in all fields.')).toHaveCount(0);
});

test('privacy report action closes sheet and selects support category', async ({ page }) => {
  await page.goto('/support');
  await page.getByRole('button', { name: /Privacy Report a problem/i }).click();
  await page.getByRole('dialog').getByRole('button', { name: /Report a problem Flag/ }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByLabel('Category')).toHaveValue('Privacy / Data');
  await expect(page.getByLabel('Subject', { exact: true })).toHaveValue('Privacy concern');
});

test('legal header uses the shared document date once', async ({ page }) => {
  await page.goto('/info?tab=terms');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Terms and privacy');
  await expect(page.locator('.legal-updated:visible')).toHaveCount(1);
  await expect(page.locator('.legal-updated:visible')).toContainText('September 27, 2026');
  await page.getByRole('tab', { name: 'Transparency', exact: true }).click();
  await expect(page.locator('.legal-updated:visible')).toHaveCount(0);
});

test('bug report failure keeps the description and allows retry', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/bug-report', async route => {
    requests++;
    await route.fulfill({
      status: requests === 1 ? 503 : 200,
      contentType: 'application/json',
      body: requests === 1 ? JSON.stringify({ error: 'Temporarily unavailable' }) : JSON.stringify({ ok: true }),
    });
  });
  await page.goto('/support');
  await page.getByRole('button', { name: /Report a Bug Something broken/i }).click();
  const dialog = page.getByRole('dialog', { name: 'Report a bug', exact: true });
  const description = dialog.getByRole('textbox', { name: 'Description', exact: true });
  await description.fill('QA: the upload screen stopped responding.');
  await dialog.getByRole('button', { name: 'Send Report', exact: true }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Temporarily unavailable');
  await expect(description).toHaveValue('QA: the upload screen stopped responding.');
  await dialog.getByRole('button', { name: 'Send Report', exact: true }).click();
  await expect(dialog).toContainText('Thanks — we logged it and will take a look.');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /Report a Bug Something broken/i }).click();
  await expect(description).toHaveValue('');
});

for (const status of [200, 503]) {
  test(`closing a pending report ignores its late ${status} response after reopening`, async ({ page }) => {
    await page.addInitScript(status => {
      const state = window as Window & { qaReportPending?: boolean; qaFinishReport?: () => void };
      const originalFetch = window.fetch.bind(window);
      window.fetch = (...args) => {
        if (args[0] === '/api/bug-report') {
          state.qaReportPending = true;
          return new Promise<Response>(resolve => {
            state.qaFinishReport = () => resolve(new Response(JSON.stringify(
              status === 200 ? { ok: true } : { error: 'Old request failed' },
            ), { status, headers: { 'Content-Type': 'application/json' } }));
          });
        }
        return originalFetch(...args);
      };
    }, status);
    await page.goto('/support');
    const trigger = page.getByRole('button', { name: /Report a Bug Something broken/i });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Report a bug', exact: true });
    const description = dialog.getByRole('textbox', { name: 'Description', exact: true });
    await description.fill('First report');
    const submitClick = dialog.getByRole('button', { name: 'Send Report', exact: true }).click();
    await expect.poll(() => page.evaluate(() => (window as Window & { qaReportPending?: boolean }).qaReportPending)).toBe(true);
    await page.keyboard.press('Escape');
    await trigger.click();
    await expect(dialog.getByRole('button', { name: 'Send Report', exact: true })).toBeEnabled();
    await description.fill('New report draft');
    await page.evaluate(async () => {
      (window as Window & { qaFinishReport?: () => void }).qaFinishReport?.();
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    await submitClick;
    await expect(description).toHaveValue('New report draft');
    await expect(dialog.getByRole('alert')).toHaveCount(0);
    await expect(dialog).not.toContainText('Thanks — we logged it');
  });
}

test('closing a pending privacy action ignores a late error after reopening', async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/privacy/request', async route => {
    await pending;
    await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Old privacy request failed' }) });
  });
  await page.goto('/support');
  const trigger = page.getByRole('button', { name: /Privacy Report a problem/i });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Privacy & your data', exact: true });
  const requested = page.waitForRequest('**/api/privacy/request', { timeout: 10_000 });
  await dialog.getByRole('button', { name: /Detach identity early/ }).click();
  await requested;
  await page.keyboard.press('Escape');
  await trigger.click();
  await expect(dialog.getByRole('button', { name: /Detach identity early/ })).toBeEnabled();
  const responded = page.waitForResponse('**/api/privacy/request', { timeout: 10_000 });
  release();
  await (await responded).finished();
  await expect(dialog).not.toContainText('Old privacy request failed');
});
