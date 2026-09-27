import { expect, test } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

import { canSeedSession, databaseUrl, seedSessionCookie, sessionCookieName } from './fixtures/session';
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

    /* `databaseUrl()`, not `DATABASE_URL`: CI deliberately points that variable
       at a placeholder (the worker reaches Postgres through Hyperdrive, seeded
       from E2E_WORKERD_DATABASE_URL), so reading it directly could never have
       connected. This spec had never executed — it is not in
       `e2e-workerd.mjs`'s shard allowlist — which is how the divergence
       survived. Every other spec resolves the URL through the fixture. */
    const prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: databaseUrl() }),
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
      /* `.first()`: the page streams under `loading.tsx`, and for a frame the
         strip can be in the document twice while React swaps the streamed
         segment in — measured (a 1,2,1 sequence sampled at 50ms). Strict mode
         fails on that frame; the count assertion below is what proves there is
         exactly one once the page has settled. */
      await expect(page.locator('.admin-tabstrip').first()).toBeVisible();
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
    /* The fold: rows that need a decision are open, the rest are one summary
       line under a closed <details>. Every card is still in the document — a
       fold hides, it does not remove — so the count above holds whether the
       fold is open or shut, and this checks the shut half is really shut. */
    const rest = page.locator('.admin-feature-rest');
    if (await rest.count()) {
      await expect(rest).not.toHaveAttribute('open', /.*/);
      await expect(rest.locator('.admin-feature-card').first()).toBeHidden();
    }
    /* The routine board: four cadences behind one strip, one panel showing. */
    const routine = page.getByTestId('admin-routine');
    await expect(routine).toBeVisible();
    /* The tabs by NAME, not by full text — a tab with work in it carries a
       count badge, and "Monthly1" is what a due restore drill reads as. */
    await expect(routine.locator('[role="tab"] .routine-tab-label')).toHaveText(['Daily', 'Weekly', 'Monthly', 'Automated']);
    await expect(routine.locator('[role="tabpanel"]')).toHaveCount(1);
    await routine.getByRole('tab', { name: 'Automated' }).click();
    await expect(routine.locator('.routine-row[data-kind="job"]').first()).toBeVisible();
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

/**
 * ONE PASSKEY OPENS THE CONSOLE (2026-09-27; owner: "When I log into the admin
 * account on my iOS device, it takes me on a long run around to authenticate
 * and ultimately doesn't let me in. I want to be able to use a passkey").
 *
 * Driven with Chromium's CDP virtual authenticator, the mechanism
 * `passkey.spec.ts` uses. Two roads, both ending on the console:
 *   1. signed in, device never seen → the register page asks for the passkey
 *      once, with no error on screen;
 *   2. signed out → `/admin` → sign in with the passkey → the console, with no
 *      register page in between, because the sign-in bound the device.
 */
test.describe('admin console — passkey only', () => {
  test.skip(
    !canReachConsole(),
    'needs a seeded database, AUTH_SECRET and ADMIN_DEVICE_SECRET (forwarded by scripts/e2e-workerd.mjs)',
  );

  test('a passkey registers the device, and a passkey sign-in opens /admin directly', async ({ browser }) => {
    const seeded = await seedSessionCookie(ADMIN_EMAIL, { role: 'ADMIN' });
    const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl() }) });
    try {
      // Own the state: no devices, and no passkeys the virtual authenticator does not hold.
      await prisma.adminDevice.deleteMany({ where: { userId: seeded.user.id } });
      await prisma.passkey.deleteMany({ where: { userId: seeded.user.id } });
    } finally {
      await prisma.$disconnect();
    }

    const context = await browser.newContext();
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('WebAuthn.enable');
    await cdp.send('WebAuthn.addVirtualAuthenticator', {
      options: {
        protocol: 'ctap2', transport: 'internal', hasResidentKey: true,
        hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true,
      },
    });
    const secure = process.env.PLAYWRIGHT_AUTH_COOKIE_SECURE === 'true';
    const domain = new URL(process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000').hostname;
    await context.addCookies([{ name: sessionCookieName(), value: seeded.cookie, domain, path: '/', secure }]);

    await page.goto('/app/me/settings');
    await page.getByRole('button', { name: /add a passkey/i }).click();
    await expect(page.getByText(/passkey added/i)).toBeVisible({ timeout: 10000 });

    // 1. Signed in, device never seen: one passkey, no error.
    await page.goto('/admin', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/admin\/device-register/);
    await expect(page.getByRole('heading', { name: 'Confirm it is you' })).toBeVisible();
    await expect(page.getByText(/Error:/)).toHaveCount(0);
    await page.getByRole('button', { name: 'Continue with passkey' }).click();
    await expect(page.locator('.admin-tabstrip').first()).toBeVisible({ timeout: 15000 });
    expect(new URL(page.url()).pathname).toBe('/admin');

    // 2. Signed out on a device the console has never seen: the passkey
    // sign-in is the only ceremony.
    await context.clearCookies();
    const visited: string[] = [];
    page.on('framenavigated', (frame) => { if (frame === page.mainFrame()) visited.push(new URL(frame.url()).pathname); });
    await page.goto('/admin', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fadmin/);
    // Best-effort click: the conditional ceremony can win the race (see passkey.spec.ts).
    await page.getByRole('button', { name: /sign in with passkey/i }).click({ timeout: 5000 }).catch(() => {});
    await expect(page.locator('.admin-tabstrip').first()).toBeVisible({ timeout: 15000 });
    expect(new URL(page.url()).pathname).toBe('/admin');
    expect(visited, 'the sign-in should have bound the device').not.toContain('/admin/device-register');

    await context.close();
  });
});
