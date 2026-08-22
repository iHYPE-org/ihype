import { test, expect, type BrowserContext, type Page } from '@playwright/test';
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

/**
 * Show a map layer.
 *
 * The layer used to be a chip row above the map and is now a station on the
 * dock's dial (2026-08-22) — one section control per screen, which is the
 * handoff's rule. These tests are about the MAP's own behaviour rather than
 * about the dial, so they navigate to the layer directly; the dial itself is
 * covered by its own tests above, and `?layer=` is what it pushes.
 */
async function showLayer(page: Page, layer: 'events' | 'venues' | 'artists') {
  await page.goto(`/app/map?layer=${layer}`);
  await expect(page.locator('.mmm-map-canvas')).toBeVisible();
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

  test('the dock is the only persistent chrome', async ({ page }) => {
    await page.goto('/app/map');
    /* The whole of the navigation, and the whole of the chrome: one bar with a
       module knob, a tuner and a transport. Everything that used to float over
       the map bottom-left is retired (2026-08-22) — assert it is GONE rather
       than merely hidden, because a hidden logo trigger still in the DOM is a
       second way to switch module waiting to be un-hidden. */
    await expect(page.locator('.mmm-dock')).toBeVisible();
    await expect(page.getByRole('button', { name: /Module: MAP/i })).toBeVisible();
    await expect(page.getByRole('tablist')).toBeVisible();
    await expect(page.getByRole('button', { name: /Play\. Drag for previous/i })).toBeVisible();

    for (const retired of ['.mmm-logo', '.mmm-nav-anchor', '.mmm-nav-scrim', '.mmm-ray-disc', '.mmm-player', '.mmm-mini', '.mmm-nav-hint', '.mmm-console']) {
      await expect(page.locator(retired), `${retired} is retired chrome`).toHaveCount(0);
    }
  });

  // Rule 5: the module pane is the only scroll container; the document is locked.
  test('locks document scroll', async ({ page }) => {
    await page.goto('/app/music/radio');
    await expect(page.locator('html')).toHaveClass(/mmm-locked/);
    const overflow = await page.evaluate(() => getComputedStyle(document.documentElement).overflow);
    expect(overflow).toBe('hidden');
  });

  /* "Both knobs are 74px, matched. They are the same brass body by design; if
     one is smaller the dock looks broken." — the handoff, and the reason this is
     measured rather than trusted: the two knobs are sized from one constant in
     `MmmDock.tsx` and the dock's height is derived from it in `mmm.css`, so a
     mismatch means someone has restated a figure instead of deriving it. */
  test('the two knobs are the same size, and the dock is one row', async ({ page }) => {
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/app/map');
      const box = await page.locator('.mmm-dock').evaluate((dock) => {
        const knobs = [...dock.children].filter((child) => child.querySelector('button'));
        const rects = knobs.map((child) => child.getBoundingClientRect());
        return {
          /* Vertical OVERLAP, not distinct tops. The dock centres three items
             of different heights, so the tuner mount legitimately starts lower
             than the 74px knobs — counting distinct `top` values reported two
             rows for a bar that had not wrapped at all, and failed the dock for
             being correctly centred. `measure:dock` already tests overlap; this
             assertion had the older, wrong form. */
          overlapping: rects.every((rect) => rect.top < rects[0].bottom && rect.bottom > rects[0].top),
          first: Math.round(rects[0].width),
          last: Math.round(rects[rects.length - 1].width),
          right: Math.round(dock.getBoundingClientRect().right),
          scrollWidth: document.documentElement.scrollWidth,
        };
      });
      expect(box.overlapping, `dock wrapped at ${width}px`).toBe(true);
      expect(box.first, `knobs disagree at ${width}px`).toBe(box.last);
      expect(box.scrollWidth, `page scrolls sideways at ${width}px`).toBeLessThanOrEqual(width);
    }
  });

  /* The knob is the module switch: one tap steps to the next detent and
     navigates. There is no fan to open first — that was the arc. */
  test('the module knob steps and navigates', async ({ page }) => {
    await page.goto('/app/map');
    await page.getByRole('button', { name: /Module: MAP/i }).click();
    await expect(page).toHaveURL(/\/app\/music\/discover/);
    await expect(page.getByRole('button', { name: /Module: MUSIC/i })).toBeVisible();
    await page.getByRole('button', { name: /Module: MUSIC/i }).click();
    await expect(page).toHaveURL(/\/app\/me$/);
    await page.getByRole('button', { name: /Module: ME/i }).click();
    await expect(page).toHaveURL(/\/app\/map$/);
  });

  /* §9: "All 5 MUSIC items are visible and reachable, no clipping." The
     MECHANISM has now changed three times — a level-2 arc, a pane tab strip,
     and the dock's dial — while the requirement has not, and the requirement is
     what is written here: every destination reachable, none clipped, none
     covered by the hardware beside it.
 
     A dial shows one station at a time, so "visible" means: stepping arrives at
     each of the five in turn, with the engraved name on screen and
     hit-testable at its own centre. That proves the control WORKS, where the
     strip version only proved five pills had boxes. */
  test('every MUSIC destination is reachable on the dial, unclipped', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/app/music/discover');

    const labels = ['Discover', 'Radio', 'Charts', 'Recommended', 'Playlists'];
    const dial = page.getByRole('tablist', { name: /Sections in MUSIC/i });
    await expect(dial).toBeVisible();

    for (let i = 0; i < labels.length; i += 1) {
      const expected = labels[(i + 1) % labels.length];
      await page.getByRole('button', { name: 'Next station' }).click();

      await expect.poll(async () => dial.evaluate(() => {
        const current = document.querySelector('.mmm-dock [role="tab"][aria-selected="true"]');
        if (!current) return 'no current station';
        const box = current.getBoundingClientRect();
        if (box.width === 0 || box.height === 0) return 'zero box';
        if (box.left < 0) return `off the left edge (${Math.round(box.left)})`;
        if (box.right > window.innerWidth) return `overflows right (${Math.round(box.right)} > ${window.innerWidth})`;
        if (box.bottom > window.innerHeight) return `overflows bottom (${Math.round(box.bottom)})`;
        const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
        if (!hit || (!current.contains(hit) && hit !== current)) return `centre hits "${hit?.className ?? 'nothing'}"`;
        return current.textContent?.trim() ?? '';
      }), { timeout: 10_000 }).toBe(expected);
    }
  });

  /* The dial is keyboard-reachable and takes the arrows. The vendored control
     focuses the DIAL rather than roving focus across its tabs, so this asserts
     what it actually does: one stop in the tab order, arrows tune. */
  test('the dial is one tab stop and the arrows tune it', async ({ page }) => {
    await page.goto('/app/music/discover');
    const dial = page.getByRole('tablist', { name: /Sections in MUSIC/i });
    await dial.focus();
    await page.keyboard.press('ArrowRight');
    await expect(page).toHaveURL(/\/app\/music\/radio$/);
    await page.keyboard.press('ArrowLeft');
    await expect(page).toHaveURL(/\/app\/music\/discover$/);
  });

  /* The transport with nothing playing — the state a fresh session is actually
     in, and the reason this asserts what it does.

     `MmmFullPlayer` renders NOTHING without a track (its contract returns null),
     so ▲ cannot open a player for music that is not there. That is ADHERENCE
     rule 15 — never render a control guaranteed to fail — and this test
     originally asserted the opposite: it dragged up and waited for an element
     the design says must not exist. Seeding real playback needs media this suite
     has none of, so open-and-dismiss is verified by hand and by `measure:dock`,
     and what is asserted here is the honest part — the hardware is present, it
     says which state it is in, and a flick up over silence conjures nothing. */
  test('the joystick is present, states its mode, and opens nothing over silence', async ({ page }) => {
    await page.goto('/app/music/discover');
    const joystick = page.getByRole('button', { name: /Drag for previous, next, or the full player/i });
    await expect(joystick).toBeVisible();
    // Nothing is playing, so it offers Play rather than Pause.
    await expect(joystick).toHaveAccessibleName(/^Play\./);

    const box = (await joystick.boundingBox())!;
    const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await page.mouse.move(centre.x, centre.y);
    await page.mouse.down();
    await page.mouse.move(centre.x, centre.y - 40, { steps: 6 });
    await page.mouse.up();

    await expect(page.locator('.mmm-full')).toHaveCount(0);
    // And the gesture left the dock intact.
    await expect(page.locator('.mmm-dock')).toBeVisible();
  });

  /* The joystick can START playback, not only pause what is already playing.
     Before MmmPlayIntent the dock passed `canTogglePlay={Boolean(currentTrack)}`
     straight through, and the vendored component makes a tap a no-op when that
     is false — so on a freshly opened app the entire transport was inert and the
     only way in was a play button drawn inside a card. Reported as "media
     joystick not connected to player".

     Asserted on the joystick's own accessible name, which the vendored
     component swaps between Play and Pause from the `playing` prop. That is the
     shortest honest proof that the tap reached the real media player: nothing
     in the dock computes it, and it only flips once a track is actually
     current. */
  test('the joystick starts playback with nothing loaded', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 852 });
    await page.goto('/app/music/discover');

    const transport = page.getByRole('button', { name: /^Play\. Drag for/ });
    await expect(transport).toBeVisible();

    /* The deck needs a seeded card with a playable URL to offer an intent, and
       this suite's fixture may have none — in which case the honest assertion
       is that the control is present and the tap is harmless, not that audio
       began. Skipping on an empty deck keeps the test from passing for the
       wrong reason on a seeded run. */
    const deck = page.locator('.mmm-deck-card');
    if (await deck.count() === 0) {
      test.skip(true, 'no seeded card on this deck — nothing for the transport to start');
    }

    await transport.click();
    // Play -> Pause is the label flip, and it comes from the media player's own
    // state rather than from anything the dock holds.
    await expect(page.getByRole('button', { name: /^Pause\. Drag for/ })).toBeVisible();
  });

  // The module tab is a route, not state: it must survive a reload and a
  // back-button press, which the prototype's local state did not.
  test('the MUSIC destination is a real route', async ({ page }) => {
    await page.goto('/app/music/discover');
    /* Discover -> Radio -> Charts. The destinations are stations on the chrome
       dial now, not links in a pane strip, so this steps rather than clicks.
       The vendored dial's own chevrons, not the retired flanking step keys.

       Each step is asserted before the next, and that is not tidiness — it is
       the fix for a real flake (seen 2026-08-22: two polls at discover, eleven
       at radio, then a timeout waiting for charts). The vendored dial computes
       its next station from the `active` PROP, which arrives from the URL, so
       two clicks landing before the router settles both resolve from the same
       stale index and both go to radio. Waiting for the URL is what makes the
       second click see the first one's result.

       Worth knowing because it is not only a test problem: a member
       double-tapping the chevron gets the same single step. Fixing that needs
       optimistic local state inside the vendored component, so it is recorded
       in UPSTREAM_FIXES.md rather than forked here. */
    const next = page.getByRole('button', { name: 'Next station' });
    await next.click();
    await expect(page).toHaveURL(/\/app\/music\/radio$/);
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
    // One tap on the knob steps MAP -> MUSIC and navigates; the dial then steps
    // Discover -> Radio. Both controls have changed shape three times now
    // (level-2 arc, pane tab strip, dock dial) and the map's survival is the
    // point of this test through all of it.
    await page.getByRole('button', { name: /Module: MAP/i }).click();
    await expect(page).toHaveURL(/\/app\/music\/discover/);
    await page.getByRole('button', { name: 'Next station' }).click();
    await expect(page).toHaveURL(/\/app\/music\/radio$/);
    await expect(page.locator('.mmm-map-canvas')).toHaveAttribute('data-mmm-probe', 'kept');
  });

  /* "Near me" is retired (2026-08-22, "Remove near me (should always start where
     you are)"), and the test that guarded it — that it was reachable on every
     layer, because it was the only control that could request location — is
     this one. What replaced the behaviour is asserted here instead: the map asks
     the browser itself, so there is no control left to be reachable.

     Asserted as the ABSENCE of the button plus the presence of a position
     request. A test that only checked the button was gone would pass just as
     happily if the location code had been deleted with it. */
  test('the map asks for location itself, with no button to press', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    /* Counted rather than granted. A headless grant answers from nowhere, and
       the claim under test is that the app ASKS on arrival — and that it asks
       exactly once, because on a phone this call IS the OS prompt.

       The stub never calls back, which also exercises the case that matters
       most: a refusal and a timeout look identical to this component, and both
       have to leave the map usable on its seeded camera. */
    await page.addInitScript(() => {
      Object.assign(window, { __geoAsks: 0 });
      navigator.geolocation.getCurrentPosition = () => {
        (window as unknown as { __geoAsks: number }).__geoAsks += 1;
      };
    });

    await page.goto('/app/map');
    await expect(page.locator('.mmm-map-canvas')).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __geoAsks: number }).__geoAsks))
      .toBe(1);

    await expect(page.getByRole('button', { name: 'Near me', exact: true })).toHaveCount(0);
    // And with no answer ever arriving, the map is still there and still usable.
    await expect(page.getByRole('button', { name: /Module: MAP/i })).toBeEnabled();
  });

  /* No permission SHEET on arrival, which is a different claim from the test
     above and still worth its own name. The map now asks the browser directly,
     and the thing that must never come back is our own scrim: /app/map is
     WORKBENCH_PATH, every sign-in lands here, and an auto-opening primer put a
     scrim over the whole shell before the member had touched anything. The
     map-not-remounted test failed with ".primer-scrim intercepts pointer
     events", which is exactly what a member would have hit. The OS prompt is
     system chrome and covers none of our DOM; a sheet of ours does. */
  test('arriving on the map raises no permission sheet', async ({ page }) => {
    await page.goto('/app/map');
    await expect(page.locator('.mmm-map-canvas')).toBeVisible();
    await expect(page.locator('.primer-scrim')).toHaveCount(0);
    // And the navigation is reachable, which is the thing the scrim broke.
    await expect(page.getByRole('button', { name: /Module: MAP/i })).toBeEnabled();
  });

  /* Two tests were here and went with the controls they guarded (2026-08-22).
     The layer-chips-over-the-date-strip test guarded a real iPhone bug — EVENTS
     painted over WED, because the strip was a sibling of the absolutely
     positioned control block rather than a child — and both of its subjects are
     retired: the layer is a station on the dock's dial, and the strip is a
     calendar inside the search bar. There is nothing left over the map but that
     bar, so there is nothing left to overlap. */

  // The search bar belongs to the layer that is showing, and now shows on all
  // three. Asserted on the CONTROL rather than on results: results depend on
  // what is inside the test viewport's bbox, and a test that needs seeded pins
  // to prove a placeholder swapped would fail for reasons that are not this.
  test('map search follows the layer, on every layer', async ({ page }) => {
    await page.goto('/app/map');
    const field = page.locator('.mmm-map-search .mmm-search-input');

    // Events is the landing layer, and it used to have no bar at all — the date
    // picker lives in this one, so skipping events would hide the control.
    await expect(field).toHaveAttribute('placeholder', 'Search shows, venues, cities');
    await showLayer(page, 'venues');
    await expect(field).toHaveAttribute('placeholder', 'Search venues, streets, cities');
    await showLayer(page, 'artists');
    await expect(field).toHaveAttribute('placeholder', 'Search artists, genres, cities');

    // A term typed against one layer must not survive into the next — it would
    // read as "no results" when it is really "different layer".
    await field.fill('anything');
    await showLayer(page, 'venues');
    await expect(field).toHaveValue('');
  });

  /* The date filter. It is on the events layer alone, because only an event has
     a date and the API is never sent `dates` for the other two — the same
     boundary the retired strip kept, now inside the search field.

     The SET semantics are what this really guards: DS8's map document requires a
     Friday and a Sunday with nothing between them to be legal, so the readout
     after two non-adjacent taps must be a COUNT and never a range. A range would
     assert a Saturday nobody picked. */
  test('the date picker opens a calendar, and only on the events layer', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 852 });
    await page.goto('/app/map');

    const trigger = page.locator('.mmm-datepick-trigger');
    await expect(trigger).toHaveText(/Any day/i);

    // Inside the search field, at its right end — not a second bar below it.
    await expect(page.locator('.mmm-search-field .mmm-datepick-trigger')).toHaveCount(1);

    await trigger.click();
    const pop = page.getByRole('dialog', { name: 'Filter by date' });
    await expect(pop).toBeVisible();

    // Six rows of seven, always, so the popover cannot change height as it pages.
    await expect(pop.locator('.mmm-datepick-day')).toHaveCount(42);

    // Two selectable days, deliberately not adjacent.
    const selectable = pop.locator('.mmm-datepick-day:not([disabled])');
    await selectable.nth(0).click();
    await selectable.nth(2).click();
    await expect(trigger).toHaveText(/2 days/i);

    /* Clearing does NOT close the popover — you may want to pick again — so the
       assertion is that it is still open, and Escape is pressed on the popover
       that is already up. Re-clicking the trigger here TOGGLED IT SHUT, which
       is what the first version of this test did and why it failed. */
    await pop.getByRole('button', { name: 'Any day' }).click();
    await expect(trigger).toHaveText(/Any day/i);
    await expect(pop).toBeVisible();

    // Escape closes and returns focus to the trigger.
    await page.keyboard.press('Escape');
    await expect(pop).toHaveCount(0);
    await expect(trigger).toBeFocused();

    // And the trigger re-opens it, now that it is closed.
    await trigger.click();
    await expect(pop).toBeVisible();
    await pop.getByRole('button', { name: 'Done' }).click();
    await expect(pop).toHaveCount(0);

    // Not on the layers with no dates.
    for (const layer of ['venues', 'artists'] as const) {
      await showLayer(page, layer);
      await expect(page.locator('.mmm-datepick-trigger'), `the date picker should not be on ${layer}`).toHaveCount(0);
    }
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
    /* The knob navigates on the tap — there is no menu to open and nothing to
       close behind it, which is the whole of what the arc's "no second level"
       rule was protecting. Stepping ME -> MAP -> MUSIC -> ME returns here. */
    const knob = page.getByRole('button', { name: /^Module: ME/i });
    await knob.click();
    await expect(page).toHaveURL(/\/app\/map$/);
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

  /* "One dial per screen, and it is the dock's." A profile has its own tab set
     and it belongs on the dock's dial — a profile that draws its own puts two
     identical-looking dials on screen meaning different things, which is exactly
     what shipped before the dock existed. The seeded artist's own page is the
     one profile this suite can reach without depending on fixture content. */
  test('a profile hands its tabs to the dock and draws no dial of its own', async ({ page }) => {
    await page.goto('/app/me?role=artist');
    await page.getByRole('button', { name: /Profiles/ }).click();
    const link = page.locator('a[href^="/app/artists/"]').first();
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/\/app\/artists\//);

    await expect(page.locator('.mmm-dock [role="tablist"]')).toBeVisible();
    await expect(page.locator('.mmm-pane [role="tablist"]')).toHaveCount(0);
    await expect(page.getByRole('tablist')).toHaveCount(1);
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

    const trigger = page.getByRole('button', { name: /Module: MAP/i });
    await expect(trigger).toBeVisible();

    // The real assertion is hit-testing, not visibility: the failure mode was
    // a fully visible trigger sitting underneath a higher z-index dialog.
    await expect.poll(async () => page.evaluate(() => {
      const knob = document.querySelector('.mmm-dock button[aria-label^="Module:"]');
      if (!knob) return 'knob not rendered';
      const box = knob.getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      if (!hit) return 'nothing at the knob centre';
      return knob.contains(hit) || hit === knob ? 'ok' : `covered by ${hit.className || hit.tagName}`;
    }), { timeout: 10000 }).toBe('ok');

    // And it actually works, with consent still up: one tap steps the module.
    await trigger.click();
    await expect(page).toHaveURL(/\/app\/music\/discover/);
    await expect(consent).toBeVisible();
  });

  test('the dock returns to its resting position once consent is answered', async ({ page, context }) => {
    // The lift must be tied to the dialog being present, not latched — a stale
    // inset would hold the nav up the page with nothing there to avoid.
    await applySessionCookie(context, EMAIL, { profiles: [] });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/app/map');

    /* Distance from the bottom of the viewport, which is what the CSS controls.
       Measured rather than compared against a constant: the dock's resting
       value is 0 (it is flush to the edge, with the home-indicator inset inside
       its own padding), and the lifted value is whatever the banner measured
       itself to be — which depends on locale and on how the copy wraps. */
    const gap = () => page.evaluate(() => {
      const box = document.querySelector('.mmm-dock')!.getBoundingClientRect();
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

    // Flush to the bottom edge once there is nothing to ride on.
    await expect.poll(gap).toBeLessThan(4);
    const resting = await gap();

    // The dock really had been lifted clear of the dialog, so the assertion
    // above is not vacuously true of a bar that never moved. A whole banner's
    // height separates the two states — and being covered here would leave the
    // member with no way to navigate at all.
    expect(lifted).toBeGreaterThan(resting + 80);
  });
});
