import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { applySessionCookie, canSeedSession, seedShowWithTicket } from './fixtures/session';

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
 * motion and 140% text are each a real accessibility setting that changes
 * layout, and each has broken a shell before: reduced motion is token-level in
 * `globals.css`, light mode is where the missing RGB triplets painted every
 * composed-alpha surface near-black, and 140% text is what
 * `--ihype-text-scale` drives through the ROOT font size — 1.4 being
 * `TEXT_SCALE_MAX`, the largest the settings screen will produce.
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

/**
 * "Every module" — MAP, MUSIC and ME are the whole signed-in app in MMM.
 *
 * `frame` is the container that proves the canonical MMM surface rendered.
 */
type Surface = { path: string; name: string; frame: string };

const MODULES: Surface[] = [
  { path: '/app/map', name: 'MAP', frame: '.mmm-frame' },
  { path: '/app/music/discover', name: 'MUSIC', frame: '.mmm-frame' },
  { path: '/app/me', name: 'ME', frame: '.mmm-frame' },
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
 * shell the document does not scroll — `.mmm-pane` does.
 * A 1px tolerance absorbs sub-pixel rounding at fractional device ratios,
 * which is noise rather than a bug a member could ever see.
 */
async function expectNoHorizontalOverflow(page: Page, label: string) {
  const result = await page.evaluate(() => {
    const roots = [document.documentElement, document.body, ...document.querySelectorAll('.mmm-pane')];
    let worst = 0;
    for (const node of roots) {
      const el = node as HTMLElement;
      worst = Math.max(worst, el.scrollWidth - el.clientWidth);
    }
    if (worst <= 1) return { worst, culprits: [] as string[] };

    /**
     * Name what is actually too wide.
     *
     * "704px of horizontal overflow" is true and unusable — it says a page is
     * three times too wide without saying which element did it, and grepping
     * for large widths finds OG metadata and `sizes` attributes rather than the
     * cause. Same failing as the tap-target check reporting `a 105x13`: a
     * measurement nobody can act on is half a finding.
     *
     * Reports the elements whose right edge sits past the viewport, widest
     * first, skipping any whose parent is already an offender — otherwise one
     * wide table names itself plus every ancestor and the real cause is buried.
     */
    const vw = document.documentElement.clientWidth;

    /**
     * Content inside a deliberately scrollable box is not overflow.
     *
     * `.shell-pill-row` is a sideways-scrolling filter strip; its pills sit
     * past the viewport by design and contribute nothing to the page's own
     * scrollWidth. It was named in every single failure report above the real
     * cause, and a report that cries wolf is one people stop reading. The walk
     * stops at the measured roots, because an element inside `.mmm-pane`
     * DOES count toward the number being asserted.
     */
    const measuredRoots = new Set<Element>(roots);
    const insideScroller = (el: Element) => {
      for (let p = el.parentElement; p && !measuredRoots.has(p); p = p.parentElement) {
        const overflowX = getComputedStyle(p).overflowX;
        if (overflowX === 'auto' || overflowX === 'scroll') return true;
      }
      return false;
    };

    const over: { el: Element; right: number; width: number }[] = [];
    for (const el of document.querySelectorAll('body *')) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (rect.right > vw + 1 && !insideScroller(el)) over.push({ el, right: rect.right, width: rect.width });
    }
    const offenders = over.filter((entry) => !over.some((other) => other.el !== entry.el && other.el.contains(entry.el)));
    const describe = (el: Element) => {
      const cls = typeof el.className === 'string' && el.className.trim()
        ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}`
        : '';
      return `${el.tagName.toLowerCase()}${cls}`;
    };
    return {
      worst,
      culprits: offenders
        .sort((a, b) => b.right - a.right)
        .slice(0, 4)
        .map((entry) => `${describe(entry.el)} w=${Math.round(entry.width)} right=${Math.round(entry.right)}`),
    };
  });
  expect(
    result.worst,
    `${label}: ${result.worst}px of horizontal overflow — widest: ${result.culprits.join(' | ') || 'none identified'}`,
  ).toBeLessThanOrEqual(1);
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
      // Half a pixel of tolerance, for the same reason the overflow check
      // carries one: at fractional device pixel ratios a box that IS 44 can
      // measure 43.99, and a gate that fails on that reports "44x44" as an
      // offender — which reads as the check being broken, and is how a check
      // stops being believed. Nothing a finger can tell apart lives in here.
      if (box.height < 43.5 || box.width < 43.5) {
        /**
         * Name the offender well enough to act on.
         *
         * The first legacy run reported `a 105x13` four times — true, and
         * useless: an unclassed anchor cannot be found from that. A report you
         * cannot act on is the same as no report, so fall back to the href and
         * then to the nearest classed ancestor, which together identify any
         * link in the tree.
         */
        const own = typeof el.className === 'string' && el.className.trim()
          ? `.${el.className.trim().split(/\s+/)[0]}`
          : null;
        const href = el.getAttribute('href');
        const nearest = el.closest('[class]');
        const nearestName = nearest && nearest !== el && typeof nearest.className === 'string' && nearest.className.trim()
          ? ` in .${nearest.className.trim().split(/\s+/)[0]}`
          : '';
        const id = own ?? `${el.tagName.toLowerCase()}${href ? `[${href}]` : ''}${nearestName}`;
        // One decimal, so a near-miss reads as a near-miss rather than as a
        // round number that looks like it should have passed.
        const round = (n: number) => Math.round(n * 10) / 10;
        offenders.push(`${id} ${round(box.width)}x${round(box.height)}`);
      }
    }
    return [...new Set(offenders)];
  });
  expect(small, `${label}: controls under 44x44 → ${small.join(', ')}`).toEqual([]);
}

/** A surface that painted its frame but no content is the bug we shipped. */
async function expectRendered(page: Page, label: string, frame = '.mmm-frame') {
  await expect(page.locator(`${frame}:visible`), `${label}: no shell frame`).toBeVisible();
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
        await expectRendered(page, `${mod.name} @${w}`, mod.frame);
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
      await expectRendered(page, `${mod.name} landscape`, mod.frame);
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
      await expectRendered(page, `${mod.name} reduced-motion`, mod.frame);
    }
    await shoot(page, 'reduced-motion-375');
  });

  /**
   * Canonical detail panes need a real row to render at all.
   *
   * These are separated from the static list above because a profile or a show
   * with no seeded record renders the not-found surface, and a not-found page
   * is trivially clean — it would pass every assertion here while measuring
   * nothing. Seeding first is the difference between covering these pages and
   * only appearing to.
   *
   * They matter more than their count suggests: an artist page is the surface a
   * shared link lands on, so it is the first thing most people ever see of
   * iHYPE, and it has never been measured at phone width.
   */
  test('canonical detail panes at 375', async ({ context, page }) => {
    const seededUser = await applySessionCookie(context, EMAIL);
    const show = await seedShowWithTicket({
      buyerUserId: seededUser.user.id,
      buyerEmail: seededUser.user.email,
      key: 'responsive',
    });

    await page.setViewportSize({ width: 375, height: 812 });
    for (const [name, path] of [
      ['Artist', `/app/artists/${show.artistSlug}`],
      ['Venue', `/app/venues/${show.venueSlug}`],
      ['Show', `/app/shows/${show.slug}`],
    ] as const) {
      await page.goto(path);
      await expectRendered(page, `${name} @375`, '.mmm-frame');
      await expectNoHorizontalOverflow(page, `${name} @375`);
      await expectTapTargets(page, `${name} @375`);
      await shoot(page, `mmm-${name}-375`);
    }
  });

  /**
   * The largest text the product can actually produce, driven the way a member
   * drives it.
   *
   * This test used to set `--ihype-text-scale: 2` in an init script and assert
   * nothing about whether it took. It did not, twice over:
   *
   * 1. `AccessibilityControls` writes that same property from stored settings
   *    on mount — default `1` — so the app overwrote the test's value during
   *    hydration and every assertion below ran at 100% text. Green, and
   *    measuring nothing.
   * 2. `TEXT_SCALE_MAX` is **1.4**. 200% is not a state any member can reach,
   *    so even unopposed the test described a scenario the product forbids.
   *
   * Both are fixed by going through the real mechanism — the same localStorage
   * key the settings screen writes — rather than fighting the app for a
   * property it owns. The scale is then ASSERTED before anything is measured:
   * that check is the whole point, because the failure mode here is not a
   * wrong number, it is a gate that quietly stops applying its own premise.
   */
  test('140% text — the product maximum — does not overflow', async ({ page }) => {
    // `--ihype-text-scale` drives the ROOT font size, which is why the
    // 2026-08-12 sweep converted 691 inline px font sizes to rem: px cannot
    // follow it, so before that sweep this setting did nothing on most of the
    // app.
    await page.setViewportSize({ width: 375, height: 812 });
    await page.addInitScript(() => {
      // Mirrors AccessibilityControls' STORAGE_KEY and shape. If either
      // changes, the assertion below fails rather than the coverage vanishing.
      localStorage.setItem('ihype-accessibility-settings', JSON.stringify({
        highContrast: false,
        largeText: false,
        reduceMotion: false,
        underlineLinks: false,
        readableFont: false,
        textScale: 1.4,
      }));
    });
    for (const mod of MODULES) {
      await page.goto(mod.path);
      await expectRendered(page, `${mod.name} 140% text`, mod.frame);

      // The premise, checked. 16px root × 1.4 = 22.4px; anything at or near 16
      // means the setting did not apply and the rest of this test is theatre.
      const rootPx = await page.evaluate(() =>
        parseFloat(getComputedStyle(document.documentElement).fontSize));
      expect(rootPx, `${mod.name}: text scale did not apply — root font-size ${rootPx}px`)
        .toBeGreaterThan(20);

      await expectNoHorizontalOverflow(page, `${mod.name} 140% text`);
    }
    await shoot(page, 'text-140pct');
  });
});
