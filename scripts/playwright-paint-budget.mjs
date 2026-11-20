/**
 * Independent render-performance gate for the REAL Workerd dev instance.
 *
 * Lighthouse has repeatedly reported NO_FCP with Chromium in the same CI
 * session while Playwright could render those routes. Never call that a
 * performance pass; instead, require a real browser paint entry. This is a
 * broad outage/blank-screen gate, not a replacement for production RUM or LCP.
 */
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';

export const PAINT_PAGES = ['/', '/login', '/info'];
export const FIRST_PAINT_LIMIT_MS = 20_000;

export async function checkBrowserFirstPaint({ baseUrl, pages = PAINT_PAGES } = {}) {
  const results = [];
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    for (const path of pages) {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
        reducedMotion: 'reduce',
      });
      try {
        const page = await context.newPage();
        const response = await page.goto(`${baseUrl}${path}`, {
          waitUntil: 'domcontentloaded', timeout: 30_000,
        });
        await page.waitForFunction(
          () => performance.getEntriesByType('paint').some(entry => entry.name === 'first-contentful-paint'),
          null, { timeout: 20_000 },
        );
        const metrics = await page.evaluate(() => {
          const firstPaint = performance.getEntriesByType('paint')
            .find(entry => entry.name === 'first-contentful-paint');
          const navigation = performance.getEntriesByType('navigation')[0];
          return {
            fcpMs: firstPaint?.startTime ?? null,
            responseEndMs: navigation?.responseEnd ?? null,
            visibleChars: (document.body?.innerText ?? '').trim().length,
          };
        });
        const ok = response?.status() === 200
          && typeof metrics.fcpMs === 'number' && metrics.fcpMs > 0
          && metrics.fcpMs < FIRST_PAINT_LIMIT_MS
          && metrics.visibleChars > 20;
        results.push({ path, status: response?.status(), ...metrics, ok });
      } catch (error) {
        results.push({ path, ok: false, error: error instanceof Error ? error.message : String(error) });
      } finally {
        await context.close();
      }
    }
  } catch (error) {
    results.push({ path: 'browser-start', ok: false, error: error instanceof Error ? error.message : String(error) });
  } finally {
    await browser?.close();
  }
  writeFileSync('playwright-first-paint-report.json', JSON.stringify({
    generatedAt: new Date().toISOString(),
    firstPaintLimitMs: FIRST_PAINT_LIMIT_MS,
    results,
  }, null, 2));
  return { ok: results.length === pages.length && results.every(item => item.ok), results };
}
