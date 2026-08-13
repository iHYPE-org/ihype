import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { applySessionCookie, canSeedSession } from './fixtures/session';

/**
 * Automated gate 6 of `docs/alpha-launch-runbook.md`, which listed this suite
 * and its viewports in detail while `npm run test:e2e:responsive` did not
 * exist and no responsive spec existed either.
 *
 * That is the same failure as the `full-ci` label doing nothing for weeks: a
 * procedure that reads as covered, is cited as covered, and executes nothing.
 * A launch runbook is exactly the wrong document to have one in.
 *
 * ## What it asserts, and why these three things
 *
 * 1. **No horizontal overflow.** This is THE phone bug — one wide element and
 *    the whole page slides, which no unit test and no static check can see.
 *    `audit:mobile` measures it against production; this measures it against
 *    the build in front of you, at every width the runbook names.
 * 2. **Controls meet the 44x44 floor.** MOBILE.md sets it for every control,
 *    desktop included, and `mobile-fit.css` implements it as a floor gated on
 *    `(pointer: coarse)`. A floor nothing checks is a suggestion.
 * 3. **The surface actually rendered.** Learned tonight: four panes shipped
 *    rendering a blank shell, returning 200, passing every static check. So
 *    "the frame painted" is never enough — content has to be asserted.
 *
 * ## The variants
 *
 * 320/375/390/430 are the runbook's widths; 375 is MOBILE.md's design width
 * and 320 is the narrowest phone still in use. Landscape, light mode, reduced
 * motion and 200% text are each a real accessibility setting that changes
 * layout, and each has broken a shell before: reduced motion is token-level in
 * `globals.css`, light mode is where the missing RGB triplets painted every
 * composed-alpha surface near-black, and 200% text is what
 * `--ihype-text-scale` drives through the ROOT font size.
 *
 * Environment: authenticated, so workerd — `node scripts/e2e-workerd.mjs`,
 * never `next dev`. `npm run test:e2e:responsive` does this for you.
 */

const EMAIL = 'e2e-responsive@ihype.org';

/** The runbook's widths. Height is a common phone height for each. */
const WIDTHS = [
  { w: 320, h: 568, label: '320 (narrowest in use)' },
  { w: 375, h: 812, label: '375 (MOBILE.md design width)' },
  { w: 390, h: 844, label: '390' },
  { w: 430, h: 932, label: '430' },
];

/** "Every module" — MAP, MUSIC and ME are the whole signed-in app. */
const MODULES = [
  { path: '/app/map', name: 'MAP' },
  { path: '/app/music/discover', name: 'MUSIC' },
  { path: '/app/me', name: 'ME' },
];

test.skip(!canSeedSession(), 'Needs E2E_WORKERD_DATABASE_URL + AUTH_SECRET to seed a session.');

/**
 * `hasTouch` is REQUIRED, not a nicety.
 *
 * Every floor in `mobile-fit.css` is gated on `(pointer: coarse)` — width is
 * deliberately not the trigger, because a narrow desktop window is still a
 * mouse and an iPad at 1024px is still a finger. Playwright's default context
 * is `pointer: fine`, so without this the floors never apply and the tap-target
 * check below fails on controls that are correct on a real phone. Resizing the
 * viewport does not make a browser a touch device.
 */
test.use({ hasTouch: true });

async function signIn(context: BrowserContext) {
  await applySessionCookie(context, EMAIL);
  await context.addInitScript(() => {
    try { localStorage.setItem('ihype_cookie_consent', 'accepted'); } catch { /* private mode */ }
  });
}

/**
 * The page must not scroll sideways.
 *
 * Measured on the scrolling element rather than `window`, because inside this
 * shell the document does not scroll — `.shell-content` and `.mmm-pane` do.
 * A 1px tolerance absorbs sub-pixel rounding at fractional device ratios,
 * which is noise rather than a bug a member could ever see.
 */
async function expectNoHorizontalOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(() => {
    const roots = [document.documentElement, document.body, ...document.querySelectorAll('.mmm-pane, .shell-content')];
    let worst = 0;
    for (const node of roots) {
      const el = node as HTMLElement;
      worst = Math.max(worst, el.scrollWidth - el.clientWidth);
    }
    return worst;
  });
  expect(overflow, `${label}: ${overflow}px of horizontal overflow`).toBeLessThanOrEqual(1);
}

/**
 * Every visible control clears 44x44.
 *
 * Deliberately reports EVERY offender rather than failing on the first: one
 * undersized control is usually a family of them, and fixing them one CI run
 * at a time is how a gate becomes something people stop running.
 */
async function expectTapTargets(page: Page, label: string) {
  const small = await page.evaluate(() => {
    const offenders: string[] = [];
    const controls = document.querySelectorAll('button, a[href], input:not([type="hidden"]), select, [role="button"], [role="tab"]');
    for (const node of controls) {
      const el = node as HTMLElement;
      const box = el.getBoundingClientRect();
      // Invisible or not laid out: not a target anyone can miss.
      if (box.width === 0 || box.height === 0) continue;
      const style = getComputedStyle(el);
      if (style.visibility === 'hidden') continue;
      // Not reachable, so not a target. MMM's arc rays are the case that found
      // this: they sit in the DOM permanently at `opacity: 0; pointer-events:
      // none` and scaled to 0.55, so they measure 36x36 while the nav is shut
      // and reach full size only when it opens. Measuring a control in its
      // hidden state reports a failure a member could never encounter.
      if (style.opacity === '0' || style.pointerEvents === 'none') continue;
      // A link inside a sentence is not a tap target — it is prose that
      // happens to be clickable, and padding it to 44px would wreck the line
      // it sits in. MOBILE.md's rule is about controls. `display: inline` is
      // what distinguishes the two, and it is the browser's own answer rather
      // than a list of selectors to maintain.
      if (style.display === 'inline') continue;
      if (box.height < 44 || box.width < 44) {
        const id = el.className && typeof el.className === 'string' ? `.${el.className.split(/\s+/)[0]}` : el.tagName.toLowerCase();
        offenders.push(`${id} ${Math.round(box.width)}x${Math.round(box.height)}`);
      }
    }
    return [...new Set(offenders)];
  });
  expect(small, `${label}: controls under 44x44 → ${small.join(', ')}`).toEqual([]);
}

/** A surface that painted its frame but no content is the bug we shipped. */
async function expectRendered(page: Page, label: string) {
  await expect(page.locator('.mmm-frame:visible'), `${label}: no shell frame`).toBeVisible();
  const text = (await page.locator('body').innerText()).trim();
  expect(text.length, `${label}: shell rendered with no readable content`).toBeGreaterThan(20);
}

async function shoot(page: Page, name: string) {
  // Attached to the report so a failure can be looked at rather than guessed
  // at — the runbook asks for screenshot artifacts by name.
  await test.info().attach(name, { body: await page.screenshot({ fullPage: false }), contentType: 'image/png' });
}

test.describe('responsive — runbook gate 6', () => {
  test.beforeEach(async ({ context }) => { await signIn(context); });

  for (const { w, h, label } of WIDTHS) {
    for (const mod of MODULES) {
      test(`${mod.name} at ${label}`, async ({ page }) => {
        await page.setViewportSize({ width: w, height: h });
        await page.goto(mod.path);
        await expectRendered(page, `${mod.name} @${w}`);
        await expectNoHorizontalOverflow(page, `${mod.name} @${w}`);
        await expectTapTargets(page, `${mod.name} @${w}`);
        await shoot(page, `${mod.name}-${w}`);
      });
    }
  }

  test('phone landscape does not overflow', async ({ page }) => {
    // Landscape is not just "wide": the height collapses, which is what pushes
    // fixed chrome into content and is why the runbook names it separately.
    await page.setViewportSize({ width: 812, height: 375 });
    for (const mod of MODULES) {
      await page.goto(mod.path);
      await expectRendered(page, `${mod.name} landscape`);
      await expectNoHorizontalOverflow(page, `${mod.name} landscape`);
    }
    await shoot(page, 'landscape');
  });

  test('light mode renders and does not overflow', async ({ page }) => {
    // The light theme is where the missing per-theme RGB triplets painted
    // every composed-alpha surface near-black over a light page. Both the
    // explicit attribute and the media preference are set: they are different
    // code paths in globals.css and only one of them is `data-theme`.
    await page.emulateMedia({ colorScheme: 'light' });
    await page.addInitScript(() => document.documentElement.setAttribute('data-theme', 'light'));
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/app/music/discover');
    await expectRendered(page, 'MUSIC light');
    await expectNoHorizontalOverflow(page, 'MUSIC light');
    await shoot(page, 'light-375');
  });

  test('reduced motion renders', async ({ page }) => {
    // `prefers-reduced-motion` zeroes the duration/ease tokens at token level,
    // so a surface that animates through them needs no query of its own — but
    // a surface that depends on an animation COMPLETING to become visible
    // breaks here, and only here.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 375, height: 812 });
    for (const mod of MODULES) {
      await page.goto(mod.path);
      await expectRendered(page, `${mod.name} reduced-motion`);
    }
    await shoot(page, 'reduced-motion-375');
  });

  test('200% text does not overflow', async ({ page }) => {
    // `--ihype-text-scale` drives the ROOT font size, which is why the 2026-08-12
    // sweep converted 691 inline px font sizes to rem: px cannot follow it, so
    // before that sweep this setting did nothing on most of the app.
    await page.setViewportSize({ width: 375, height: 812 });
    await page.addInitScript(() => {
      document.documentElement.style.setProperty('--ihype-text-scale', '2');
    });
    for (const mod of MODULES) {
      await page.goto(mod.path);
      await expectRendered(page, `${mod.name} 200% text`);
      await expectNoHorizontalOverflow(page, `${mod.name} 200% text`);
    }
    await shoot(page, 'text-200pct');
  });
});
