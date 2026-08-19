import { test, expect, type BrowserContext } from '@playwright/test';
import { applySessionCookie, canSeedSession, seedShowWithTicket } from './fixtures/session';

/**
 * The Music · Map · Me shell contract, as executable assertions.
 *
 * The design bundle ships its own verification checklist
 * (`design/handoff-music-map-me/FRONTEND_GOTCHAS.md` §9). Most of its items are
 * exactly the kind that regress silently — an item present in the manifest but
 * clipped off-screen, a fan that animates all at once, a player that stays
 * reachable behind the scrim — so the checklist is encoded here rather than
 * being a document someone remembers to re-read.
 *
 * Environment: same as every other authenticated spec. This cannot pass under
 * plain `npm run dev` (src/lib/db.ts imports the wasm/workerd Prisma engine, so
 * auth() throws there and every request 401s). Run it through
 * `node scripts/e2e-workerd.mjs`.
 *
 * ## Why so many locators here carry `:visible`
 *
 * `/app`'s layout is async, so these routes STREAM. While a page is still
 * arriving, Next holds a copy of the content in a hidden staging node
 * (`<div hidden id="S:0">`) and moves it into place with a script — so for a
 * window of a few hundred milliseconds the document genuinely contains two of
 * everything, and a bare `.mmm-frame` resolves to two elements on a page that
 * is entirely correct. It shows up as a strict-mode violation naming a path
 * like `[id="S:0"] > .mmm-frame > .mmm-pane`, and it is intermittent, so it
 * reads as flake rather than as a fixable cause.
 *
 * Waiting on some other element first does NOT fix it — the anchor you wait on
 * is duplicated too. `:visible` does, because the staging node is `hidden` and
 * its copy therefore has no box. It also happens to be what these assertions
 * actually mean: a member can only see the live one.
 */

const EMAIL = 'e2e-mmm-fan@ihype.org';
const ARTIST_EMAIL = 'e2e-mmm-artist@ihype.org';

test.skip(!canSeedSession(), 'Needs E2E_WORKERD_DATABASE_URL + AUTH_SECRET to seed a session.');

/**
 * Signs in a seeded account. Defaults to NO Profile row, which is a real state
 * worth defaulting to: the HYPE link is keyed on the member's first profile's
 * hexId (the value `/api/me` returns as `inviteHexId`), so a profile-less
 * account has no link and the card must be absent rather than blank. The
 * profile-bearing paths get their own describe block below.
 */
async function signIn(context: BrowserContext, email = EMAIL, profiles: { type: 'ARTIST' | 'VENUE'; name: string }[] = []) {
  await applySessionCookie(context, email, { profiles });
  // Pre-accept cookie consent. Not cosmetic: the consent dialog is pinned to the
  // bottom of the viewport, which is exactly where this shell puts its logo
  // trigger and fan, so at phone width it intercepts every click on the nav.
  // Seeding the same localStorage key CookieConsent reads keeps these tests
  // about the shell instead of about the banner. The overlap itself is a real
  // product question and is recorded in DESIGN_SYNC row 268, not hidden here.
  await context.addInitScript(() => {
    try { localStorage.setItem('ihype_cookie_consent', 'accepted'); } catch { /* private mode */ }
  });
}

test.describe('Music · Map · Me shell', () => {
  test.beforeEach(async ({ context }) => { await signIn(context); });

  test('/app redirects to the MAP surface', async ({ page }) => {
    await page.goto('/app');
    await expect(page).toHaveURL(/\/app\/map$/);
  });

  // Rule 1: no header, no bottom tab bar. This is the single biggest departure
  // from the shell it replaces, and the easiest thing to reintroduce by accident
  // — mounting the shell anywhere the root layout's AppShell also applies would
  // put an 82px header back on screen.
  test('renders no top bar and no bottom tab bar', async ({ page }) => {
    await page.goto('/app/map');
    await expect(page.locator('.mmm-frame:visible')).toBeVisible();
    // Real class names, checked against the components: AppShellHeader renders
    // `.shell-header`, AppShellContextStrip `.shell-context-strip`,
    // MobileBottomNav `.ihype-mobile-nav`, GlobalMediaPlayer `.site-dock`. A
    // guessed name would make this pass whether or not the chrome rendered.
    //
    // `toBeHidden`, not `toHaveCount(0)`: the last two render from the ROOT
    // layout and are therefore always in the DOM on this route — mmm.css stands
    // them down with `display: none`. What matters is that none of it is
    // presented or focusable, and toBeHidden covers absent AND hidden.
    await expect(page.locator('.shell-header')).toBeHidden();
    await expect(page.locator('.shell-context-strip')).toBeHidden();
    await expect(page.locator('.ihype-mobile-nav')).toBeHidden();
    await expect(page.locator('.site-dock')).toBeHidden();
  });

  test('the logo trigger and the player are the only persistent chrome', async ({ page }) => {
    await page.goto('/app/map');
    await expect(page.getByRole('button', { name: /Open iHYPE navigation/i })).toBeVisible();
    /* The module label that used to sit above the trigger is gone (2026-08-14):
       on a phone it printed over the pane's own content at the bottom of the
       screen, and it named the module the member was already looking at. What
       the rule actually says is that the trigger and the player are the ONLY
       persistent chrome — so assert exactly that, rather than the label. */
    await expect(page.locator('.mmm-nav-hint')).toHaveCount(0);
  });

  // Rule 5: the module pane is the only scroll container; the document is locked.
  test('locks document scroll', async ({ page }) => {
    await page.goto('/app/music/radio');
    await expect(page.locator('html')).toHaveClass(/mmm-locked/);
    const overflow = await page.evaluate(() => getComputedStyle(document.documentElement).overflow);
    expect(overflow).toBe('hidden');
  });

  test('tapping the logo opens the fan and tapping it again closes it', async ({ page }) => {
    await page.goto('/app/map');
    const logo = page.getByRole('button', { name: /Open iHYPE navigation/i });
    await logo.click();
    await expect(page.locator('.mmm-nav-anchor')).toHaveAttribute('data-open', 'true');
    await expect(page.getByRole('button', { name: 'MUSIC', exact: true })).toBeVisible();
    await page.getByRole('button', { name: /Close iHYPE navigation/i }).click();
    await expect(page.locator('.mmm-nav-anchor')).toHaveAttribute('data-open', 'false');
  });

  test('tapping the scrim closes the fan', async ({ page }) => {
    await page.goto('/app/map');
    await page.getByRole('button', { name: /Open iHYPE navigation/i }).click();
    await page.locator('.mmm-nav-scrim').click();
    await expect(page.locator('.mmm-nav-anchor')).toHaveAttribute('data-open', 'false');
  });

  // `ArcNav.d.ts`: "one 66px icon disc each … There is NO second level:
  // Music's sections are tabs at the top of the Music pane."
  //
  // This test used to assert the opposite — that MUSIC opened a five-item
  // level-2 arc and stayed on `/app/me`. That layer was removed as a second,
  // undesigned route to five destinations the Music pane's tab strip already
  // carries. Every module now navigates on the first tap.
  test('every module navigates on the first tap; there is no second level', async ({ page }) => {
    await page.goto('/app/me');
    await page.getByRole('button', { name: /Open iHYPE navigation/i }).click();
    await page.getByRole('button', { name: 'MUSIC', exact: true }).click();
    await expect(page).toHaveURL(/\/app\/music\/discover/);
    // The fan closes behind it, and nothing has grown a sub-level.
    await expect(page.locator('.mmm-nav-anchor')).toHaveAttribute('data-open', 'false');
    await expect(page.locator('.mmm-nav-anchor')).not.toHaveAttribute('data-sub', 'true');
    // The five sections live on the chrome dial instead of a pane tab strip.
    await expect(page.getByRole('tablist', { name: 'Music destinations' })).toBeVisible();
  });

  // §9: "All 5 MUSIC items are visible and reachable, no clipping." §4 is the
  // bug this guards — three of seven items were off-screen and unreachable
  // because an ancestor's overflow clipped the transform.
  //
  // The items moved again: from a level-2 arc, to the Music pane's tab strip,
  // and now to the tuner on the cabinet. So the MECHANISM this checks has
  // changed twice while the requirement has not, and the requirement is what
  // is written here — every destination reachable, none clipped, none covered.
  //
  // A dial shows one station at a time, so "visible" cannot mean "all five are
  // painted at once" any more. It means: five real tabs exist, exactly one is
  // in the tab order (roving tabindex), and stepping the dial actually arrives
  // at each of them with the engraved name on screen and hit-testable. That is
  // a stronger check than the strip version — it proves the control WORKS,
  // where the old one only proved five pills had boxes.
  test('every MUSIC destination is reachable on the dial, unclipped', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/app/music/discover');

    const labels = ['Discover', 'Radio', 'Charts', 'Recommended', 'Playlists'];
    const dial = page.getByRole('tablist', { name: 'Music destinations' });
    await expect(dial).toBeVisible();
    await expect(dial.getByRole('tab', { includeHidden: true })).toHaveCount(labels.length);

    // Roving tabindex: one tab in the order, never five.
    await expect.poll(async () => dial.evaluate((node) =>
      [...node.querySelectorAll('[role="tab"]')].filter((t) => (t as HTMLElement).tabIndex === 0).length,
    )).toBe(1);

    // Step all the way round. Starting at Discover, five steps returns there,
    // which also proves the scale wraps rather than stopping at the last one.
    for (let i = 0; i < labels.length; i += 1) {
      const expected = labels[(i + 1) % labels.length];
      await page.getByRole('button', { name: /Next section in Music/i }).click();

      await expect.poll(async () => dial.evaluate(() => {
        const current = document.querySelector('.tuner-station[data-current="true"]');
        if (!current) return 'no current station';
        const box = current.getBoundingClientRect();
        if (box.width === 0 || box.height === 0) return 'zero box';
        if (box.left < 0) return `off the left edge (${Math.round(box.left)})`;
        if (box.right > window.innerWidth) return `overflows right (${Math.round(box.right)} > ${window.innerWidth})`;
        if (box.bottom > window.innerHeight) return `overflows bottom (${Math.round(box.bottom)})`;
        // The point at its own centre must hit itself, not the cabinet or the
        // player sitting beside it — the covering half of §4's bug.
        const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
        if (!hit || !current.contains(hit) && hit !== current) return `centre hits "${hit?.className ?? 'nothing'}"`;
        return current.textContent?.trim() ?? '';
      }), { timeout: 10_000 }).toBe(expected);
    }
  });

  // §9: "Items fan out with a visible stagger, not all at once." §5's bug made
  // every item animate simultaneously, silently.
  test('fan items carry a per-index stagger', async ({ page }) => {
    await page.goto('/app/map');
    await page.getByRole('button', { name: /Open iHYPE navigation/i }).click();
    // The three discs, not the retired level-2 pills. `ARC` staggers them
    // 60/30/0ms, and §5's bug is still the thing being guarded: the prototype
    // routed the delay through an undeclared custom property, which silently
    // invalidated the whole declaration and fanned everything out at once.
    const delays = await page.locator('.mmm-ray-disc').evaluateAll(
      (nodes) => nodes.map((node) => getComputedStyle(node).transitionDelay),
    );
    expect(delays.length).toBe(3);
    expect(new Set(delays).size, `expected distinct delays, got ${delays.join(', ')}`).toBe(3);
  });

  // §9: "Nav opens, dims everything including the player."
  test('opening the fan hides the player and takes it out of the tab order', async ({ page }) => {
    await page.goto('/app/map');
    const player = page.locator('.mmm-player');
    if (await player.count()) {
      await expect(player).toHaveAttribute('data-hidden', 'false');
      await page.getByRole('button', { name: /Open iHYPE navigation/i }).click();
      await expect(player).toHaveAttribute('data-hidden', 'true');
      await expect(player).toHaveAttribute('aria-hidden', 'true');
      const focusable = await player.locator('button[tabindex="-1"]').count();
      expect(focusable).toBeGreaterThan(0);
    }
  });

  // One press, because there is one level. `MmmNav`'s own comment says it:
  // "Escape closes. There is no level to step back to any more."
  test('Escape closes the fan', async ({ page }) => {
    await page.goto('/app/map');
    await page.getByRole('button', { name: /Open iHYPE navigation/i }).click();
    await expect(page.locator('.mmm-nav-anchor')).toHaveAttribute('data-open', 'true');
    await page.keyboard.press('Escape');
    await expect(page.locator('.mmm-nav-anchor')).toHaveAttribute('data-open', 'false');
  });

  // The module tab is a route, not state: it must survive a reload and a
  // back-button press, which the prototype's local state did not.
  test('the MUSIC destination is a real route', async ({ page }) => {
    await page.goto('/app/music/discover');
    // Discover -> Radio -> Charts. The destinations are stations on the chrome
    // dial now, not links in a pane strip, so this steps rather than clicks.
    const next = page.getByRole('button', { name: /Next section in Music/i });
    await next.click();
    await next.click();
    await expect(page).toHaveURL(/\/app\/music\/charts$/);

    // Survives a reload: the needle is re-homed from the URL, not from state.
    await page.reload();
    await expect(page.getByRole('tab', { name: 'Charts' })).toHaveAttribute('aria-selected', 'true');

    // And Back walks the destinations, which is why the dial pushes rather
    // than replaces.
    await page.goBack();
    await expect(page).toHaveURL(/\/app\/music\/radio$/);
  });

  // The requirement is that a typo does not silently render Discover. Asserted on
  // what the page SHOWS, not on the status code: `notFound()` throws after the
  // layout has already flushed (it is async — it awaits auth and a DB read), so
  // Next streams the not-found UI with a 200 and cannot retroactively set 404.
  // Testing the status here would be testing Next's streaming behaviour, not
  // this route's.
  test('an unknown MUSIC tab shows not-found, not a silent fallback to Discover', async ({ page }) => {
    await page.goto('/app/music/nonsense');
    await expect(page.getByRole('heading', { name: /no such tab/i })).toBeVisible();
    /* There used to be a `link named Discover has count 0` assertion here. It
       became VACUOUS when the destinations stopped being links — an assertion
       that a thing is absent passes for free once the thing cannot exist, and
       a test that cannot fail is worse than no test because it reads as
       coverage. The heading above is what actually proves "not a silent
       fallback to Discover"; the pane rendering not-found is the requirement. */
    // And it stays inside MMM — exactly one shell, not the marketing 404 and
    // not two shells stacked (which is what `notFound()` produced here, since
    // the layout has already flushed by the time it throws).
    await expect(page.locator('.mmm-frame:visible')).toHaveCount(1);
  });

  // §9: "No reference to a DJ role anywhere in the UI." The DJ role is still
  // live elsewhere in the product, so this asserts only the new shell's own
  // surfaces — which is the scope the checklist item can honestly cover today.
  test('the shell surfaces never mention a DJ role', async ({ page }) => {
    for (const path of ['/app/map', '/app/music/radio', '/app/me']) {
      await page.goto(path);
      await expect(page.locator('.mmm-frame:visible')).toBeVisible();
      const text = (await page.locator('.mmm-frame:visible').innerText()).toLowerCase();
      expect(text, `${path} mentions a DJ role`).not.toMatch(/\bdj\b/);
    }
  });

  // The map is the base layer and must survive a module change, or returning to
  // MAP loses your pan and zoom.
  test('the map element is not remounted when switching modules', async ({ page }) => {
    await page.goto('/app/map');
    await page.locator('.mmm-map-canvas').evaluate((node) => node.setAttribute('data-mmm-probe', 'kept'));
    await page.getByRole('button', { name: /Open iHYPE navigation/i }).click();
    await page.getByRole('button', { name: 'MUSIC', exact: true }).click();
    // Radio is a STATION on the chrome dial now — it was a second-level arc
    // item, then a tab in the Music pane. The map's survival is the point of
    // this test and has not changed through any of that.
    await page.getByRole('button', { name: /Next section in Music/i }).click();
    await expect(page).toHaveURL(/\/app\/music\/radio$/);
    await expect(page.locator('.mmm-map-canvas')).toHaveAttribute('data-mmm-probe', 'kept');
  });

  // "Near me" is on every layer (product decision, 2026-08-12). It is the only
  // control that can request location, so while it lived on the artists layer
  // alone a fan browsing events on a phone could never ask for it — the most
  // obvious thing anyone wants from a map.
  test('Near me is reachable on every map layer', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/app/map');
    const nearMe = page.getByRole('button', { name: 'Near me', exact: true });

    // Events is the landing layer and is where this used to be missing.
    await expect(nearMe).toBeVisible();
    for (const label of ['Venues', 'Artists', 'Events']) {
      await page.getByRole('button', { name: label, exact: true }).click();
      await expect(nearMe, `Near me is missing on ${label}`).toBeVisible();
    }
    // The redundant artists count was removed; Near me stays a stable action
    // in the same position without changing shape between layers.
    await expect(page.locator('.mmm-map-near')).not.toHaveAttribute('data-count', 'true');
  });

  // No permission sheet on arrival. /app/map is WORKBENCH_PATH — every sign-in
  // lands here — so a primer that opens on load is a permission wall on launch,
  // which MOBILE.md forbids outright. It also covered the arc nav: the
  // map-not-remounted test below failed with ".primer-scrim intercepts pointer
  // events", which is what a member would have hit too.
  test('arriving on the map raises no permission sheet', async ({ page }) => {
    await page.goto('/app/map');
    await expect(page.locator('.mmm-map-canvas')).toBeVisible();
    await expect(page.locator('.primer-scrim')).toHaveCount(0);
    // And the navigation is reachable, which is the thing the scrim broke.
    await expect(page.getByRole('button', { name: /Open iHYPE navigation/i })).toBeEnabled();
  });

  // Reported from a real iPhone: the layer chips and the date strip painted on
  // top of each other — EVENTS over WED, VENUES over THU. The strip was a
  // SIBLING of `.mmm-map-controls`, which is absolutely positioned, so it sat
  // in normal flow at the top of the map layer directly beneath it.
  //
  // Asserted as a geometric non-overlap rather than as DOM structure: the bug
  // is two boxes sharing pixels, and a later refactor could reintroduce that
  // without restoring the old parentage.
  test('the map date strip never overlaps the layer chips', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/app/map');

    const chips = page.locator('.mmm-map-chips');
    const strip = page.locator('.mmm-date-strip');
    await expect(chips).toBeVisible();
    // Events is the landing layer, so the strip is showing without any input.
    await expect(strip).toBeVisible();

    const [chipBox, stripBox] = await Promise.all([chips.boundingBox(), strip.boundingBox()]);
    expect(chipBox, 'layer chips have no box').not.toBeNull();
    expect(stripBox, 'date strip has no box').not.toBeNull();
    // The strip sits BELOW the chips, with no shared pixels.
    expect(
      stripBox!.y,
      `date strip starts at ${Math.round(stripBox!.y)} but the chips run to ${Math.round(chipBox!.y + chipBox!.height)}`,
    ).toBeGreaterThanOrEqual(chipBox!.y + chipBox!.height);
  });

  // The search bar belongs to the layer that is showing. Asserted on the
  // CONTROL rather than on results: results depend on what is inside the test
  // viewport's bbox, and a test that needs seeded pins to prove a placeholder
  // swapped would fail for reasons that are not this behaviour.
  test('map search follows the layer, and events have none', async ({ page }) => {
    await page.goto('/app/map');
    const field = page.locator('.mmm-map-search .mmm-search-input');

    // Events is the landing layer: a price pin is not something a name finds.
    await expect(field).toHaveCount(0);

    await page.getByRole('button', { name: 'Venues', exact: true }).click();
    await expect(field).toHaveAttribute('placeholder', 'Search venues, streets, cities');

    await page.getByRole('button', { name: 'Artists', exact: true }).click();
    await expect(field).toHaveAttribute('placeholder', 'Search artists, genres, cities');

    // A term typed against one layer must not survive into the next — it would
    // read as "no results" when it is really "different layer".
    await field.fill('anything');
    await page.getByRole('button', { name: 'Venues', exact: true }).click();
    await expect(field).toHaveValue('');
  });

  // The canonical panels are ACCORDIONS, not links. Legal now lives under
  // Info and Accessibility under Settings, so neither is repeated at this
  // level. Their retired routes still resolve to these parent drawers.
  // The old routes redirect onto their canonical parent drawer, so this
  // asserts the controls that exist rather than the navigation that moved.
  test('the ME surface carries Settings and Info as rows, not a fan-out', async ({ page }) => {
    await page.goto('/app/me');
    // Matched on the LABEL SPAN, not on the button's text and not on its
    // accessible name. Both of those are the label and the detail line
    // concatenated — the two spans are adjacent with no whitespace between
    // them, so the button reads "SettingsAccount · notifications · payments".
    // That is why an anchored `/^Settings\b/` found nothing: there is no word
    // boundary between "Settings" and "Account". The label span holds exactly
    // the label, so an exact match on it is both correct and stable.
    //
    // Scoped this tightly on purpose: "Settings", "Info" and "Legal" are short
    // common words, and a bare role query for them will find something else
    // the first time this surface grows a control.
    const panelFor = (label: string) =>
      page.locator('.mmm-me-accordion:visible').filter({
        has: page.locator('.mmm-me-accordion-label', { hasText: new RegExp(`^${label}$`) }),
      });

    for (const label of ['Info', 'Settings']) {
      await expect(panelFor(label), `no ${label} panel`).toBeVisible();
    }
    await expect(panelFor('Legal')).toHaveCount(0);
    await expect(panelFor('Accessibility')).toHaveCount(0);
    // Deliberately no count assertion: `.mmm-me-accordion` is also the class
    // on the Profiles / My Tickets drawers above, so the page
    // carries several of them and pinning a number here would break the next
    // time ME grows a section — which is not what this test is about.
    //
    // Collapsed until asked: a drawer that starts open is not a drawer.
    await expect(panelFor('Settings')).toHaveAttribute('aria-expanded', 'false');
    // ME must not open a submenu — only MUSIC does.
    await page.getByRole('button', { name: /Open iHYPE navigation/i }).click();
    // `exact` is load-bearing: accessible-name matching is substring by
    // default, and since the account panels became accordion BUTTONS, a loose
    // 'ME' also appears in other copy on the page.
    await page.getByRole('button', { name: 'ME', exact: true }).click();
    await expect(page).toHaveURL(/\/app\/me$/);
    await expect(page.locator('.mmm-nav-anchor')).toHaveAttribute('data-open', 'false');
  });

  // One drawer open at a time, page-wide — the two sections and the account
  // panels are ONE group. This is the invariant that cannot be seen by
  // reading either half alone: the sections are component state and the panels
  // are the URL, so nothing about the types stops both being open at once.
  test('ME keeps exactly one drawer open, across sections and account panels', async ({ page }) => {
    const drawer = (label: string) =>
      page.locator('.mmm-me-accordion:visible').filter({
        has: page.locator('.mmm-me-accordion-label', { hasText: new RegExp(`^${label}$`) }),
      });

    await page.goto('/app/me');
    // Entering ME is a clean four-row index. Nothing chooses itself.
    for (const label of ['Profiles', 'My Tickets', 'Info', 'Settings']) {
      await expect(drawer(label)).toHaveAttribute('aria-expanded', 'false');
    }

    await drawer('Profiles').click();
    await expect(drawer('Profiles')).toHaveAttribute('aria-expanded', 'true');

    // A section closes the other sections.
    await drawer('My Tickets').click();
    await expect(drawer('My Tickets')).toHaveAttribute('aria-expanded', 'true');
    await expect(drawer('Profiles')).toHaveAttribute('aria-expanded', 'false');

    // A panel closes the sections, and puts itself in the URL so the drawer is
    // deep-linkable and Back closes it.
    await drawer('Settings').click();
    await expect(page).toHaveURL(/panel=settings/);
    await expect(drawer('Settings')).toHaveAttribute('aria-expanded', 'true');
    await expect(drawer('My Tickets')).toHaveAttribute('aria-expanded', 'false');

    // And a section closes the panel — including its search param, or the drawer
    // would reopen on the next render from a URL nobody cleared.
    await drawer('Profiles').click();
    await expect(page).not.toHaveURL(/panel=/);
    await expect(drawer('Profiles')).toHaveAttribute('aria-expanded', 'true');
    await expect(drawer('Settings')).toHaveAttribute('aria-expanded', 'false');
  });

  // Deep-linking a panel must not also open Profiles: the default applies only
  // when nothing else is open, or the URL's own drawer loads a screen down.
  test('arriving on a panel deep link opens that panel and nothing else', async ({ page }) => {
    await page.goto('/app/me?panel=legal');
    const drawer = (label: string) =>
      page.locator('.mmm-me-accordion:visible').filter({
        has: page.locator('.mmm-me-accordion-label', { hasText: new RegExp(`^${label}$`) }),
      });
    await expect(drawer('Info')).toHaveAttribute('aria-expanded', 'true');
    await expect(drawer('Profiles')).toHaveAttribute('aria-expanded', 'false');
  });

  /**
   * The assertions that were impossible without rows.
   *
   * Every ticket test here used to run against an account with no tickets, so
   * it could only check that a section rendered. Two real bugs shipped through
   * that gap: a list sorted so attended shows sat above upcoming ones, and a
   * buy pane that credited nobody from the 10% promoter pool. Both need data to
   * be visible at all.
   */
  test.describe('with a real ticket', () => {
    let seeded: Awaited<ReturnType<typeof seedShowWithTicket>>;

    test.beforeEach(async ({ context }) => {
      const session = await applySessionCookie(context, EMAIL, { profiles: [] });
      seeded = await seedShowWithTicket({ buyerUserId: session.user.id, buyerEmail: session.user.email });
    });

    test('a held ticket appears in ME and opens its sheet', async ({ page }) => {
      await page.goto('/app/me');
      const drawer = page.locator('.mmm-me-accordion:visible').filter({
        has: page.locator('.mmm-me-accordion-label', { hasText: /^My Tickets$/ }),
      });
      await drawer.click();

      const row = page.locator('.mmm-ticket-row', { hasText: seeded.title });
      await expect(row).toBeVisible();
      await expect(row).toContainText(seeded.serializedId);

      await row.getByRole('button', { name: 'View ticket' }).click();
      const sheet = page.locator('.mmm-ticket-sheet');
      await expect(sheet).toBeVisible();
      // The QR is a server-generated data URL, which is what lets the sheet
      // open at a door with no signal.
      await expect(sheet.locator('.mmm-ticket-qr img')).toHaveAttribute('src', /^data:image\/svg\+xml/);
      await expect(sheet).toContainText(seeded.serializedId);
      // The money lines: face value, the buyer-paid Stripe fee, and $0 iHYPE.
      await expect(sheet).toContainText('Face value');
      await expect(sheet).toContainText('Stripe processing');
      await expect(sheet).toContainText('$0.00');
      // Sales are final, stated where a holder looks for a way out.
      await expect(sheet).toContainText(/All sales are final/i);
    });

    test('upcoming tickets sort above attended ones', async ({ context, page }) => {
      // The bug this catches: a plain startsAt sort put a July attended ticket
      // above an August upcoming one, and spent the row limit on old history.
      const session = await applySessionCookie(context, EMAIL, { profiles: [] });
      await seedShowWithTicket({
        buyerUserId: session.user.id,
        buyerEmail: session.user.email,
        key: 'past',
        startsAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      });

      await page.goto('/app/me');
      await page.locator('.mmm-me-accordion:visible').filter({
        has: page.locator('.mmm-me-accordion-label', { hasText: /^My Tickets$/ }),
      }).click();

      const statuses = await page.locator('.mmm-ticket-status:visible').allInnerTexts();
      const firstAttended = statuses.findIndex((s) => /attended/i.test(s));
      const lastUpcoming = statuses.map((s) => /upcoming/i.test(s)).lastIndexOf(true);
      if (firstAttended !== -1 && lastUpcoming !== -1) {
        expect(lastUpcoming, `attended ticket sorted above an upcoming one: ${statuses.join(', ')}`)
          .toBeLessThan(firstAttended);
      }
    });

    test('the in-shell buy pane renders the real split and the sale card', async ({ page }) => {
      await page.goto(`/app/shows/${seeded.slug}`);
      // Wait for the pane to SETTLE before counting anything. This route's
      // layout is async and the page streams, so mid-flight Next holds a copy
      // of the content in a hidden staging node and moves it into place with a
      // script — query in that window and a locator resolves to two nodes that
      // are really one. Anchoring on the sale card (the last thing to arrive)
      // means the assertions below run against a finished document.
      await expect(page.locator('.mmm-show-sale:visible')).toBeVisible();
      // Now the count means what it says. Scoped to the pane's own H1 because
      // `TicketSaleCard` repeats the title as an H2 inside itself — and asserted
      // as a COUNT so that a genuine double render fails here rather than being
      // absorbed by a `.first()`.
      await expect(page.locator('h1.mmm-show-title:visible')).toHaveCount(1);
      await expect(page.locator('h1.mmm-show-title:visible')).toHaveText(seeded.title);
      // The split bar draws the show's OWN percentages.
      const split = page.locator('.mmm-show-split:visible');
      await expect(split).toContainText('70% artist');
      await expect(split).toContainText('20% venue');
      await expect(split).toContainText('10% promoters');
      // And the disclosure that changes what the buyer is agreeing to.
      //
      // This assertion is stronger than it looks: the seeded account has no
      // stored payment token, so the card renders its "payment method required"
      // state — which is the state EVERY member is in today, and the one that
      // used to skip the notice entirely because it lived inside the purchase
      // form. Asserting it here is asserting it in the state real users see.
      await expect(page.locator('.ticket-final-notice:visible')).toContainText(/all ticket sales are final/i);
    });

    test('a dead show link keeps the member inside the shell', async ({ page }) => {
      // Without /app/not-found.tsx this rendered the marketing 404 — map gone,
      // player gone, no route back.
      await page.goto('/app/shows/definitely-not-a-real-show');
      // Settle first — counting nodes while the document is still streaming
      // counts Next's hidden staging copy as a second element.
      await expect(page.getByRole('link', { name: /Back to the map/i })).toBeVisible();
      // Exactly one shell. Two means the page threw `notFound()` after the
      // async layout had flushed, which streams a second copy of the whole
      // chain — two maps, two players, two sets of tiles fetched.
      await expect(page.locator('.mmm-frame:visible')).toHaveCount(1);
    });
  });

  // The ticket path lives in ME now, not behind a compatibility URL.
  // Asserted on the section rather than on rows, because a seeded account with
  // no tickets is the normal state for this suite — what must not come back is
  // the pair of buttons that left MMM.
  test('My Tickets renders in ME rather than linking to a compatibility URL', async ({ page }) => {
    await page.goto('/app/me');
    const drawer = page.locator('.mmm-me-accordion:visible').filter({
      has: page.locator('.mmm-me-accordion-label', { hasText: /^My Tickets$/ }),
    });
    await drawer.click();
    await expect(drawer).toHaveAttribute('aria-expanded', 'true');

    const body = page.locator('.mmm-me-section:visible', { has: drawer }).locator('.mmm-me-accordion-body:visible');
    // Either real ticket rows, or the empty note — never a way out of the shell.
    await expect(body.getByRole('link', { name: /My tickets|Browse shows/ })).toHaveCount(0);
    await expect(body.locator('.mmm-ticket-list, .mmm-me-note')).not.toHaveCount(0);
  });

  // An account with no Profile row has no hexId and therefore no HYPE link. The
  // card must be absent, not present-and-blank — and the surface must still
  // render, which is the actual risk.
  test('a profile-less account still renders ME, without a HYPE link card', async ({ page }) => {
    await page.goto('/app/me');
    await expect(page.getByRole('button', { name: /Settings/ }).first()).toBeVisible();
    await expect(page.getByText(/Your HYPE link/i)).toHaveCount(0);
  });
});

test.describe('ME with a real profile', () => {
  test.beforeEach(async ({ context }) => {
    await signIn(context, ARTIST_EMAIL, [{ type: 'ARTIST', name: 'E2E MMM Artist' }]);
  });

  test('the HYPE link card renders and states that promoting needs no role', async ({ page }) => {
    await page.goto('/app/me');
    await expect(page.getByText(/Your HYPE link/i)).toBeVisible();
    await expect(page.getByText(/Promoting needs no role and no signup/i)).toBeVisible();
  });

  // The fan page creator was removed; Artist and Venue keep theirs. The role
  // switcher only appears once an account holds more than the implicit Fan role.
  test('an artist account gets a page card and a role switcher', async ({ page }) => {
    await page.goto('/app/me?role=artist');
    await page.getByRole('button', { name: /Profiles/ }).click();
    await expect(page.getByText(/Your page/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Fan', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Artist', exact: true })).toBeVisible();
  });

  test('the fan role has no page card — the fan page creator was removed', async ({ page }) => {
    await page.goto('/app/me?role=fan');
    await expect(page.getByText(/Your HYPE link/i)).toBeVisible();
    await expect(page.getByText(/Your page/i)).toHaveCount(0);
  });
});

test.describe('bounded map queries', () => {
  test.beforeEach(async ({ context }) => { await signIn(context); });

  // BACKEND_REWRITE.md §5: "bbox is required. Reject unbounded requests."
  test('every map layer rejects an unbounded request', async ({ request }) => {
    for (const layer of ['events', 'venues', 'artists']) {
      const response = await request.get(`/api/map/${layer}`);
      expect([400, 503], `${layer} accepted an unbounded request`).toContain(response.status());
      if (response.status() === 400) {
        expect((await response.json()).code).toBe('BBOX_REQUIRED');
      }
    }
  });

  test('a malformed bbox is rejected, not partially parsed', async ({ request }) => {
    const response = await request.get('/api/map/events?bbox=-70.3,43.6,-70.2');
    expect([400, 503]).toContain(response.status());
  });

  test('a bounded request returns a layer payload', async ({ request }) => {
    const response = await request.get('/api/map/events?bbox=-70.4,43.5,-70.1,43.8&zoom=13');
    if (response.status() === 503) return; // maps paused by runtime flag
    expect(response.ok()).toBe(true);
    const payload = await response.json();
    expect(payload.layer).toBe('events');
    expect(typeof payload.total).toBe('number');
  });

  // A global-zoom request must come back aggregated, not as 10,000 rows.
  test('a global-zoom request is clustered server-side', async ({ request }) => {
    const response = await request.get('/api/map/events?bbox=-180,-80,180,80&zoom=2');
    if (response.status() === 503) return;
    expect(response.ok()).toBe(true);
    const payload = await response.json();
    expect(payload.clustered).toBe(true);
    expect(Array.isArray(payload.clusters)).toBe(true);
    expect(payload.pins).toBeUndefined();
  });
});

test.describe('computed stations', () => {
  test.beforeEach(async ({ context }) => { await signIn(context); });

  test('returns the eight computed stations, none of them DJ-hosted', async ({ request }) => {
    const response = await request.get('/api/stations');
    if (response.status() === 503) return; // radio paused by runtime flag
    expect(response.ok()).toBe(true);
    const { stations } = await response.json();
    expect(stations).toHaveLength(8);
    for (const station of stations) {
      expect(['for_you', 'local', 'new', 'friends', 'genre']).toContain(station.kind);
      expect(station.title).not.toMatch(/dj/i);
      // A count is either a real number or explicitly null — never a fabricated 0.
      expect(station.trackCount === null || typeof station.trackCount === 'number').toBe(true);
    }
  });

  test('an unknown station slug 404s', async ({ request }) => {
    const response = await request.get('/api/stations/not-a-station/tracks');
    expect([404, 503]).toContain(response.status());
  });
});

/**
 * The cookie-consent collision (DESIGN_SYNC row 268, item f).
 *
 * Every other test in this file pre-accepts consent so it can be about the
 * shell. That is exactly why this one must exist: the dialog is pinned to the
 * bottom of the viewport and, at phone width, is `100vw - 32px` wide — the same
 * corner the 76px logo trigger occupies. It swallowed every pointer event aimed
 * at the nav, so a first-time visitor could not open the navigation at all
 * until they dismissed the banner. Playwright burned 55 click retries on
 * "subtree intercepts pointer events" before timing out.
 *
 * The fix does not move, restyle or hide consent — it is a compliance surface.
 * The dialog publishes how much of the bottom edge it occupies as
 * `--consent-inset` and the shell lifts its own chrome by that much. So this
 * signs in WITHOUT pre-accepting, and asserts both halves: consent is really on
 * screen, and the trigger is really clickable anyway.
 */
test.describe('Music · Map · Me shell — first visit, consent pending', () => {
  test('the nav trigger is clickable with the consent dialog on screen', async ({ page, context }) => {
    // Note the absence of the consent-seeding init script the `signIn` helper
    // adds. A first visit is the state under test.
    await applySessionCookie(context, EMAIL, { profiles: [] });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/app/map');

    // Guard the test itself: if consent stopped rendering, everything below
    // would pass while proving nothing.
    const consent = page.getByRole('dialog', { name: /cookie preferences/i });
    await expect(consent).toBeVisible();

    const trigger = page.getByRole('button', { name: /Open iHYPE navigation/i });
    await expect(trigger).toBeVisible();

    // The real assertion is hit-testing, not visibility: the failure mode was
    // a fully visible trigger sitting underneath a higher z-index dialog.
    await expect.poll(async () => page.evaluate(() => {
      const logo = document.querySelector('.mmm-logo');
      if (!logo) return 'trigger not rendered';
      const box = logo.getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      if (!hit) return 'nothing at the trigger centre';
      return logo.contains(hit) || hit === logo ? 'ok' : `covered by ${hit.className || hit.tagName}`;
    }), { timeout: 10000 }).toBe('ok');

    // And it actually opens, with consent still up.
    await trigger.click();
    await expect(page.getByRole('button', { name: 'MUSIC', exact: true })).toBeVisible();
    await expect(consent).toBeVisible();
  });

  test('the trigger returns to its resting position once consent is answered', async ({ page, context }) => {
    // The lift must be tied to the dialog being present, not latched — a stale
    // inset would hold the nav up the page with nothing there to avoid.
    await applySessionCookie(context, EMAIL, { profiles: [] });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/app/map');

    // Distance from the bottom of the viewport, which is what the CSS controls.
    // Measured rather than compared against a constant: the resting value is
    // 26px at the base rule and 22px inside the design's own <=720px
    // breakpoint, so a hardcoded number here asserts the wrong thing on one
    // side of that line — and the breakpoint is the side that matters.
    const gap = () => page.evaluate(() => {
      const box = document.querySelector('.mmm-logo')!.getBoundingClientRect();
      return Math.round(window.innerHeight - box.bottom);
    });

    // Wait for the dialog before measuring: "lifted" is only meaningful once
    // the thing being avoided is actually on screen, and measuring straight
    // after goto() samples the pre-stylesheet frame where the trigger has not
    // been positioned yet.
    await expect(page.getByRole('dialog', { name: /cookie preferences/i })).toBeVisible();

    const lifted = await gap();
    await page.getByRole('button', { name: /Essential only/i }).click();
    await expect(page.getByRole('dialog', { name: /cookie preferences/i })).toHaveCount(0);

    await expect.poll(gap).toBeLessThan(40);
    const resting = await gap();

    // The trigger really had been lifted clear of the dialog, so the assertion
    // above is not vacuously true of a trigger that never moved. A whole
    // banner's height separates the two states.
    expect(lifted).toBeGreaterThan(resting + 80);
  });
});
