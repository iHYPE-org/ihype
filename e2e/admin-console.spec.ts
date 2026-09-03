import { expect, test } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

import { canSeedSession, seedSessionCookie, sessionCookieName } from './fixtures/session';
import {
  generateDeviceToken,
  getDeviceCookieName,
  hashDeviceToken,
  signDeviceCookieValue,
} from '../src/lib/admin-device';

/**
 * The admin console, driven for the first time.
 *
 * Nothing had ever rendered a single `/admin` page in a browser, and the
 * reason was the harness rather than the console: the layout's device gate
 * reads `ADMIN_DEVICE_SECRET` through `readRuntimeEnv`, `e2e-workerd.mjs` did
 * not forward it, so every admin URL redirected to `/admin/device-register`
 * and any spec would have measured the redirect. It is forwarded now, and this
 * is what makes that forwarding load-bearing rather than a capability nothing
 * uses.
 *
 * Two gates have to be satisfied and BOTH are real controls, so the spec
 * satisfies them the way the product does rather than working around them:
 *
 *   1. `isAdminSession()` reads the session role, and `auth()`'s jwt callback
 *      clamps that role to ADMIN only for an address in `DEFAULT_ADMIN_EMAILS`.
 *      A freshly seeded `admin-probe@example.com` with `role: 'ADMIN'` is
 *      clamped straight back down and lands on the map — measured, and it is
 *      the correct behaviour. So the fixture seeds the real admin address
 *      against the scratch database.
 *   2. The device gate wants a registered `AdminDevice` row whose `tokenHash`
 *      matches the signed cookie.
 *
 * What is asserted is the CONTRACT of the tab split, not its contents: every
 * tab answers, each marks itself current, an unknown tab falls back rather
 * than rendering an empty console, and the feature board leads the overview.
 * Asserting particular panels would break on every legitimate move of one.
 */

const ADMIN_EMAIL = 'admin@ihype.org';
const TABS = ['overview', 'activity', 'support', 'finance', 'system'] as const;

function canReachConsole(): boolean {
  return canSeedSession() && Boolean(process.env.ADMIN_DEVICE_SECRET);
}

test.describe('admin console', () => {
  test.skip(
    !canReachConsole(),
    'needs a seeded database, AUTH_SECRET and ADMIN_DEVICE_SECRET (forwarded by scripts/e2e-workerd.mjs)',
  );

  test('every domain tab renders, and an unknown one falls back to Overview', async ({ browser }) => {
    const seeded = await seedSessionCookie(ADMIN_EMAIL, { role: 'ADMIN' });

    const prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? '' }),
    });
    const deviceToken = generateDeviceToken();
    try {
      /* Own the state this asserts on: a device row left by an earlier run
         belongs to a token this run does not hold. */
      await prisma.adminDevice.deleteMany({ where: { userId: seeded.user.id } });
      await prisma.adminDevice.create({
        data: { userId: seeded.user.id, tokenHash: hashDeviceToken(deviceToken), label: 'e2e' },
      });
    } finally {
      await prisma.$disconnect();
    }

    const context = await browser.newContext();
    const secure = process.env.PLAYWRIGHT_AUTH_COOKIE_SECURE === 'true';
    const domain = new URL(process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000').hostname;
    await context.addCookies([
      { name: sessionCookieName(), value: seeded.cookie, domain, path: '/', secure },
      {
        name: getDeviceCookieName(),
        value: signDeviceCookieValue(deviceToken),
        domain,
        path: '/',
        secure,
      },
    ]);
    const page = await context.newPage();

    const failures: string[] = [];
    page.on('pageerror', (error) => failures.push(String(error)));

    for (const tab of TABS) {
      /* Never `networkidle` here: AdminPulse polls, so the network never goes
         idle and the wait can only time out. */
      await page.goto(`/admin?tab=${tab}`, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.admin-tabstrip')).toBeVisible();
      /* The gate redirects rather than 403s, so a URL check is what proves we
         are actually on the console and not looking at the map. */
      expect(new URL(page.url()).pathname, `${tab} redirected away`).toBe('/admin');
      await expect(page.locator('.admin-tabstrip a[aria-current="page"]')).toHaveCount(1);
      /* Each domain owns at least one panel; an empty tab is a move that lost
         its contents. */
      expect(await page.locator('h2').count(), `${tab} rendered no panels`).toBeGreaterThan(0);
    }

    await page.goto('/admin?tab=not-a-tab', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.admin-tabstrip a[aria-current="page"]')).toHaveText('Overview');

    /* The board leads the overview, and every capability in the catalogue is
       on it — a board that silently renders a subset is the failure mode the
       lib's own header is about. */
    await page.goto('/admin?tab=overview', { waitUntil: 'domcontentloaded' });
    const { FEATURE_CATALOGUE } = await import('../src/lib/admin-feature-board');
    await expect(page.locator('.admin-feature-card')).toHaveCount(FEATURE_CATALOGUE.length);
    /* Worst first: whatever the environment, the top card must not be an OK
       one while a blocked one exists further down. */
    const states = await page.locator('.admin-feature-card').evaluateAll((cards) =>
      cards.map((card) => card.className.replace(/.*admin-feature-(\w+).*/, '$1')),
    );
    const rank = ['blocked', 'attention', 'unknown', 'off', 'idle', 'ok'];
    const ranks = states.map((state) => rank.indexOf(state));
    expect(ranks, 'the board is not ordered worst-first').toEqual([...ranks].sort((a, b) => a - b));

    expect(failures, 'the console threw in the browser').toEqual([]);
    await context.close();
  });
});
