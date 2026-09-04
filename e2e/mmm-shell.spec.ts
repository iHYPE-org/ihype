import { test, expect, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test';
import { applySessionCookie, canSeedSession, seedShowWithTicket } from './fixtures/session';
import { MMM_MUSIC_TABS } from '../src/lib/mmm-nav';

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
 * The layer was a chip row above the map, then a station on the dock's dial
 * (2026-08-22), and is a brass segmented control on the map again (MIDDLE ROAD,
 * 2026-09-04) now that the dial no longer exists to collide with it. Through
 * all three it has been `?layer=`, which is why these tests navigate to the
 * layer directly: they are about the MAP's own behaviour, not about whichever
 * control is currently pushing that URL.
 */
/**
 * Whether the radio has any audio to play — asked ONCE, and cheaply.
 *
 * ## Why this is cached, and why it checks only the first station
 *
 * The first version of this walked EVERY station and fetched each one's tracks,
 * inside `page.evaluate`, on every surface and every retry: eight stations
 * across seven surfaces with three attempts is ~168 station-track queries
 * through one long-lived `wrangler dev` process, on top of the rest of the
 * suite. That run died with `V8 fatal error … JavaScript heap out of memory`
 * after the process heap reached **1393 MB**, which killed the server and
 * failed twenty tests with `ECONNREFUSED` — none of them about playback. The
 * previous PR's version of this test used a DOM count and passed.
 *
 * So: two requests, cached for the whole file, and the FIRST station rather
 * than any station — which is also a truer precondition, because
 * `defaultStationSlug` is what the dock's fallback actually picks. If that
 * station has no audio, the fallback cannot start anything, whatever the other
 * seven hold.
 *
 * A test that needs a database is expensive by nature. Making the precondition
 * cheap is the difference between expensive and fatal.
 */
let radioAudio: Promise<boolean> | null = null;
function radioHasAudio(request: APIRequestContext): Promise<boolean> {
  radioAudio ??= (async () => {
    const list = await request.get('/api/stations');
    if (!list.ok()) return false;
    const stations = ((await list.json()) as { stations?: { slug?: string }[] }).stations ?? [];
    const slug = stations.find((station) => station.slug)?.slug;
    if (!slug) return false;
    const tracks = await request.get(`/api/stations/${slug}/tracks`);
    if (!tracks.ok()) return false;
    const rows = ((await tracks.json()) as { tracks?: { mediaUrl?: string | null }[] }).tracks ?? [];
    return rows.some((row) => row.mediaUrl);
  })();
  return radioAudio;
}

async function showLayer(page: Page, layer: 'events' | 'venues' | 'artists') {
  await page.goto(`/app/map?layer=${layer}`);
  /* `.first()`, because during a soft navigation React can have the outgoing
     and incoming trees mounted at once and this resolved to TWO canvases —
     a strict-mode violation that fails the helper rather than the test using
     it. The claim here is "a map canvas is on screen", not "exactly one": the
     single-instance guarantee is what `the map element is not remounted`
     asserts, and it does so with a tagged node rather than a count. */
  await expect(page.locator('.mmm-map-canvas').first()).toBeVisible();
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
    /* The whole of the navigation, and the whole of the chrome: one walnut bar
       with four labelled destinations and a transport (MIDDLE ROAD,
       2026-09-04). Everything that used to float over the map bottom-left is
       retired, and so is the hardware that replaced it — assert both are GONE
       rather than merely hidden, because a hidden control still in the DOM is a
       second way to navigate waiting to be un-hidden. */
    await expect(page.locator('.mmm-dock:visible')).toHaveCount(1); // settle: the staged copy makes a bare visibility check a strict-mode failure
    for (const label of ['Listen', 'Map', 'Tickets', 'Me']) {
      await expect(page.getByRole('link', { name: label, exact: true })).toBeVisible();
    }
    /* And NO play key in the tab row — retired 2026-09-04, see the idle-bar
       test below. Asserted absent rather than left unmentioned: a retired
       control comes back one piece at a time, which is the same reason the
       list of dead selectors below exists. */
    await expect(page.getByRole('button', { name: 'Play the radio' })).toHaveCount(0);

    for (const retired of [
      // The pre-console chrome.
      '.mmm-logo', '.mmm-nav-anchor', '.mmm-nav-scrim', '.mmm-ray-disc', '.mmm-player', '.mmm-nav-hint', '.mmm-console',
      // The console's own hardware, retired by the middle road. A knob or a
      // dial reappearing here is the whole decision quietly coming back.
      '.mmm-knob', '.mmm-hifi-dial', '.mmm-dial-station', '.mmm-stick', '.mmm-gate', '.mmm-dock-badge', '.mmm-dock-plate',
    ]) {
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

  /* The bar is one row at every width, nothing overflows, and every control
     clears the 44px floor MOBILE.md sets for desktop as well as phone. This
     used to assert that the two brass knobs matched at 74px; the knobs are
     gone, the requirement underneath them is not — the chrome must not wrap,
     must not push the page sideways, and must not hand anyone a target too
     small to hit. `measure:dock` measures all of it in more detail without a
     database; this is the same claim against the REAL app. */
  test('the tab bar is one row at every width, with no target under 44px', async ({ page }) => {
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/app/map');
      /* Settle to the one live dock before measuring. Mid-stream there are two
         — the live dock and Next's staged copy — so a bare `.mmm-dock` here is
         a strict-mode failure, and the staged copy would measure a bar that has
         not been laid out. Eleventh member of the duplication family; same
         treatment as every other. */
      const docks = page.locator('.mmm-dock:visible');
      await expect(docks).toHaveCount(1);
      const box = await docks.evaluate((dock) => {
        const controls = [...dock.querySelectorAll('.mmm-tab')];
        const rects = controls.map((child) => child.getBoundingClientRect());
        return {
          /* Vertical OVERLAP, not distinct tops: the row centres items of
             different content heights, and counting distinct `top` values once
             reported two rows for a bar that had not wrapped at all. */
          overlapping: rects.every((rect) => rect.top < rects[0].bottom && rect.bottom > rects[0].top),
          count: controls.length,
          under44: rects.filter((rect) => rect.width < 44 || rect.height < 44).length,
          scrollWidth: document.documentElement.scrollWidth,
        };
      });
      expect(box.overlapping, `the bar wrapped at ${width}px`).toBe(true);
      // Four destinations plus the radio key, which is only there while nothing
      // is loaded — which is exactly the state a fresh session is in.
      expect(box.count, `wrong number of controls at ${width}px`).toBe(5);
      expect(box.under44, `a control is under the 44px floor at ${width}px`).toBe(0);
      expect(box.scrollWidth, `page scrolls sideways at ${width}px`).toBeLessThanOrEqual(width);
    }
  });

  /* Every tab reaches its destination and the bar reports where you are. The
     knob version of this had to be tapped in a fixed cycle because a rotary
     switch only steps to its neighbour; a bar goes anywhere from anywhere,
     which is the whole argument for it, so the test goes anywhere too. */
  test('every tab navigates, and exactly one is current', async ({ page }) => {
    await page.goto('/app/map');
    for (const [label, url] of [
      ['Tickets', /\/app\/tickets$/],
      ['Listen', /\/app\/music\/discover$/],
      ['Me', /\/app\/me$/],
      ['Map', /\/app\/map$/],
    ] as const) {
      await page.getByRole('link', { name: label, exact: true }).click();
      await expect(page).toHaveURL(url);
      /* One lit destination, always. Two is a routing bug and none means a
         member cannot tell where they are — and `moduleForPath` answering the
         wrong module for `/app/tickets` (it is tested before `/app/me` for
         exactly this reason) shows up here first. */
      await expect(page.locator('.mmm-dock:visible .mmm-tab[data-on="true"]')).toHaveCount(1);
      await expect(page.locator('.mmm-dock:visible .mmm-tab[data-on="true"]')).toHaveText(label);
    }
  });

  /* §9: "All 5 MUSIC items are visible and reachable, no clipping." The
     MECHANISM has now changed four times — a level-2 arc, a pane tab strip, the
     dock's dial, and now a pane strip again (MIDDLE ROAD, 2026-09-04) — while
     the requirement has not, and the requirement is what is written here.

     The strip's answer to "no clipping" is not that all five fit: five sections
     at 13px do not fit 375px and are not allowed to shrink to make them. They
     SCROLL, so what is asserted is that each one can be reached and, once
     reached, is fully on screen and hit-testable at its own centre. A strip
     that hid a section silently is the failure the dial was right about, so
     that is the failure this test is shaped to catch. */
  test('every MUSIC destination is reachable in the strip, unclipped', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/app/music/discover');

    /* Derived from the manifest, not restated: a hardcoded list is one section
       behind the moment MUSIC grows a tab — adding Library failed this test on
       a wrong EXPECTATION, and the three 10s-poll retries that followed were
       enough extra load to take the workerd server down for every test after
       it (the ECONNREFUSED cascade). mmm-nav has no imports, so the spec can
       read the real list directly. */
    const strip = page.getByRole('tablist', { name: /Sections in MUSIC/i });
    await expect(strip).toBeVisible();

    for (const item of MMM_MUSIC_TABS) {
      const pill = strip.getByRole('tab', { name: item.label, exact: true });
      // The row scrolls, so a pill off the right edge is expected until it is
      // brought in — which is what a member's swipe does and what this does.
      await pill.scrollIntoViewIfNeeded();
      await pill.click();
      await expect(page).toHaveURL(new RegExp(`${item.href}$`));

      await expect.poll(async () => strip.evaluate(() => {
        const current = document.querySelector('.mmm-strip [role="tab"][aria-selected="true"]');
        if (!current) return 'no current section';
        const box = current.getBoundingClientRect();
        if (box.width === 0 || box.height === 0) return 'zero box';
        if (box.left < 0) return `off the left edge (${Math.round(box.left)})`;
        if (box.right > window.innerWidth) return `overflows right (${Math.round(box.right)} > ${window.innerWidth})`;
        if (box.bottom > window.innerHeight) return `overflows bottom (${Math.round(box.bottom)})`;
        const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
        if (!hit || (!current.contains(hit) && hit !== current)) return `centre hits "${hit?.className ?? 'nothing'}"`;
        return current.textContent?.trim() ?? '';
      }), { timeout: 10_000 }).toBe(item.label);
    }
  });

  /* The strip is keyboard-reachable, and unlike the dial it needs no special
     contract to be: every section is a real link, so Tab reaches each one and
     Enter follows it. That is the accessibility argument for the strip in one
     test — the dial was ONE stop with arrow keys, which works but has to be
     learned and cannot be discovered by tabbing. */
  test('every section in the strip is its own tab stop', async ({ page }) => {
    await page.goto('/app/music/discover');
    const strip = page.getByRole('tablist', { name: /Sections in MUSIC/i });
    await strip.getByRole('tab', { name: 'Radio', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/app\/music\/radio$/);
    await strip.getByRole('tab', { name: 'Discover', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/app\/music\/discover$/);
  });

  /* The transport with nothing playing — the state a fresh session is actually
     in, and the reason this asserts what it does.

     There is no mini player over silence: the whole height saving depends on
     the bar being tabs-only until something is loaded. What must still be true
     is that the transport EXISTS — the console's universal-play promise is not
     negotiable and MAP, ME, a profile and a ticket have nothing of their own —
     so the radio key stands in for it, and it says what it does rather than
     being a glyph that silently starts a station. */
  test('over silence the bar carries no transport at all', async ({ page }) => {
    await page.goto('/app/music/discover');
    await expect(page.locator('.mmm-dock:visible')).toHaveCount(1);
    /* This test asserted the OPPOSITE until 2026-09-04 — that an idle bar
       carries a "Radio" key, because the console's rule was that the transport
       is universal and never inert. The owner retired that key ("remove radio
       tab on bottom it's already under listen"), so the idle bar is tabs only
       and that is now the correct state rather than a regression. The rule it
       bends is real and the trade is recorded in MmmDock.tsx; what survives of
       it is that there is never MORE than one transport. */
    await expect(page.getByRole('button', { name: 'Play the radio' })).toHaveCount(0);
    await expect(page.locator('.mmm-dock .mmm-mini')).toHaveCount(0);
    await expect(page.locator('.mmm-dock .mmm-key')).toHaveCount(0);
    /* `MmmFullPlayer` renders NOTHING without a track (its contract returns
       null) — ADHERENCE rule 15, never render a control guaranteed to fail —
       so nothing on the bar can conjure one over silence. */
    await expect(page.locator('.mmm-full')).toHaveCount(0);
  });

  /* The transport can START playback, not only pause what is already playing —
     and it can do it EVERYWHERE. Before MmmPlayIntent the dock passed
     `canTogglePlay={Boolean(currentTrack)}` straight through and a tap was a
     no-op when that was false, so on a freshly opened app the whole transport
     was inert and the only way in was a play button drawn inside a card.
     Reported as "media joystick not connected to player", then as needing
     "universal play ability". **The joystick is gone and this resolution order
     is not** — it is the thing most easily lost in a chrome rewrite, which is
     why the same surfaces are still checked as a set.

     Asserted on the bar's own state change: over silence there is a radio key
     and no mini player, and after the tap there is a mini player naming a real
     track. Nothing in the dock computes that — the mini player appears only
     once the audio element actually holds something.

     The surfaces are checked as a SET rather than one at a time, because the
     claim is about the transport being universal. MAP and ME have nothing of
     their own to play and must fall through to the radio; the music tabs each
     register something. Any of them leaving the transport dead is the bug. */
  for (const surface of [
    // Nothing of their own — these must fall through to the radio.
    '/app/map', '/app/me',
    // Each of these registers something: the card on screen, the first station
    // in the current filter, the chart from number one, the recommended list,
    // the first playlist.
    '/app/music/discover', '/app/music/radio', '/app/music/charts',
    '/app/music/recommended', '/app/music/playlists',
    // Library registers the liked tracks; an account with none falls through
    // to the radio, which is still "the transport is never inert".
  ] as const) {
    test(`a surface's own play control loads the mini player on ${surface}`, async ({ page, request }) => {
      /* Asked before the page loads, and cached across the file — see
         `radioHasAudio`. A fixture with no playable audio cannot start
         anything, and the honest result there is a skip rather than accepting
         either outcome. */
      const playable = await radioHasAudio(request);

      await page.setViewportSize({ width: 393, height: 852 });
      await page.goto(surface);
      /* Count-settled, not just visibility: while the route streams there are
         briefly TWO docks — the live one and Next's staging copy — and a bare
         `.mmm-dock` visibility check fails strict mode on the duplicate. Same
         class and same fix as the four ME-pane tests hardened on 2026-08-26;
         this was the fifth member, caught by the OOM-fix verification run. */
      const dock = page.locator('.mmm-dock:visible');
      await expect(dock).toHaveCount(1);

      /* The bar no longer carries a cold-start transport, so this can no
         longer be driven from the dock — it is driven from the SURFACE's own
         play control, which is how a member starts audio now. What the test
         proves is unchanged and is the part worth keeping: once something is
         loaded the mini player appears, it carries the transport, and the bar
         never ends up with two. */
      await expect(dock.getByRole('button', { name: 'Play the radio' })).toHaveCount(0);

      if (!playable) {
        test.skip(true, 'the default station has no playable track — nothing to start');
      }

      /* Any control whose accessible name starts "Play " — track rows label
         themselves `Play <title> by <artist>` and shelf tiles carry their own.
         A regex rather than a fixed string because the label names the CONTENT,
         which is fixture data and must not be hardcoded here. */
      const play = page.getByRole('button', { name: /^Play / }).first();
      if (await play.count() === 0) {
        test.skip(true, `${surface} offers no play control for this account`);
      }
      await play.click();

      // The mini player only exists once a track is loaded, so its arrival is
      // the proof the tap reached the media player rather than the surface.
      await expect(dock.locator('.mmm-mini')).toBeVisible();
      await expect(dock.getByRole('button', { name: 'Pause' })).toBeVisible();
      // And still exactly one transport, in the mini player.
      await expect(dock.getByRole('button', { name: 'Play the radio' })).toHaveCount(0);
    });
  }

  // The module tab is a route, not state: it must survive a reload and a
  // back-button press, which the prototype's local state did not.
  test('the MUSIC destination is a real route', async ({ page }) => {
    await page.goto('/app/music/discover');
    /* Discover -> Radio -> Charts. The destinations are sections in the pane's
       own strip now (MIDDLE ROAD, 2026-09-04) and each one is a real link, so
       this clicks rather than steps.

       Each step is asserted before the next, and that is not tidiness — it is
       the fix for a real flake (seen 2026-08-22: two polls at discover, eleven
       at radio, then a timeout waiting for charts) that the dial had for a
       reason worth remembering. It computed its NEXT station from the `active`
       prop, which arrives from the URL, so two taps landing before the router
       settled both resolved from the same stale index and both went to radio —
       and a member double-tapping the chevron got the same single step. A strip
       cannot have that bug at all: every pill names an absolute destination
       rather than a relative one, so a double tap on Charts goes to Charts
       twice. Waiting for the URL between clicks is kept anyway, because the
       assertion is about the ROUTE settling. */
    const strip = page.getByRole('tablist', { name: /Sections in MUSIC/i });
    await strip.getByRole('tab', { name: 'Radio', exact: true }).click();
    await expect(page).toHaveURL(/\/app\/music\/radio$/);
    await strip.getByRole('tab', { name: 'Charts', exact: true }).click();
    await expect(page).toHaveURL(/\/app\/music\/charts$/);

    // Survives a reload: the lit pill is resolved from the URL, not from state.
    await page.reload();
    await expect(page.getByRole('tab', { name: 'Charts', exact: true })).toHaveAttribute('aria-selected', 'true');

    // And Back walks the destinations, which is why these are links rather
    // than buttons calling replace().
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
    // The Listen tab leaves MAP; the pane's strip then moves Discover -> Radio.
    // Both controls have changed shape four times now (level-2 arc, pane tab
    // strip, dock dial, pane strip again) and the map's survival is the point
    // of this test through all of it: the layer is mounted in the /app layout
    // and must not be torn down by any of them.
    await page.getByRole('link', { name: 'Listen', exact: true }).click();
    await expect(page).toHaveURL(/\/app\/music\/discover/);
    await page.getByRole('tablist', { name: /Sections in MUSIC/i })
      .getByRole('tab', { name: 'Radio', exact: true }).click();
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
    await expect(page.getByRole('link', { name: 'Map', exact: true })).toBeVisible();
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
    await expect(page.getByRole('link', { name: 'Map', exact: true })).toBeVisible();
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
    /* Settled, and the settle repeats after each layer switch below: the
       staged copy the streaming shell holds makes a bare locator resolve to 2
       (tenth member of the 2026-08-26 duplication family, surfaced by CI's
       stream timing rather than local runs). Filtering to :visible keeps every
       later assertion on the live control. */
    const field = page.locator('.mmm-map-search .mmm-search-input:visible');
    await expect(field).toHaveCount(1);

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

  /* ME's four sections are STATIONS ON THE DIAL, not a fan-out of links and no
     longer a stack of headers (owner, 2026-08-25: "Still showing multi options
     instead of single subnav using thumb wheel"). Legal lives under Info and
     Accessibility under Settings, so neither is a section of its own; their
     retired routes resolve onto the parent card. This asserts the sections that
     exist rather than the navigation that moved. */
  test('the ME surface carries Settings and Info as strip sections, not a fan-out', async ({ page }) => {
    await page.goto('/app/me');
    /* Read the CARDS, by their own aria-label. There is no header row to match
       on any more — the dial's drum is the label — so the section element
       carries the name, and one exact-labelled card is the whole contract.
       Scoped this tightly on purpose: "Settings", "Info" and "Legal" are short
       common words, and a bare text query for them will find something else the
       first time this surface grows a control. */
    const cards = () => page.locator('.mmm-me-section:visible');
    const labels = () => cards().evaluateAll((nodes) => nodes.map((n) => n.getAttribute('aria-label')));

    // Exactly one card, and with nothing chosen it is Profiles.
    await expect.poll(labels).toEqual(['Profiles']);

    // Each section is reachable by its own deep link, alone.
    for (const [param, label] of [
      ['panel=legal', 'Info'],
      ['panel=settings', 'Settings'],
    ] as const) {
      await page.goto(`/app/me?${param}`);
      await expect.poll(labels, `deep link ${param}`).toEqual([label]);
    }
    /* `section=tickets` was in this table and is not any more: the wallet is a
       top-level destination since the middle road (2026-09-04), so the deep
       link FORWARDS rather than opening a card here. Asserted, not deleted —
       the URL is in links members already hold, and silently rendering an ME
       with no card open is the failure this replaces. THE ONLY test that may
       navigate to it: everywhere else goes straight to `/app/tickets`, because
       a `goto` of a redirecting URL races the redirect and the read that
       follows dies with "execution context was destroyed". */
    await page.goto('/app/me?section=tickets');
    await expect(page).toHaveURL(/\/app\/tickets$/);

    // Legal and Accessibility are rows INSIDE those cards, never cards.
    await expect(page.locator('.mmm-me-section[aria-label="Legal"]')).toHaveCount(0);
    await expect(page.locator('.mmm-me-section[aria-label="Accessibility"]')).toHaveCount(0);

    /* The tab navigates on the tap — there is no menu to open and nothing to
       close behind it, which is the whole of what the arc's "no second level"
       rule was protecting, and what the knob's detents kept. */
    await page.getByRole('link', { name: 'Map', exact: true }).click();
    await expect(page).toHaveURL(/\/app\/map$/);
  });

  /* ONE CARD, ALWAYS — the invariant that replaced "one drawer open at a time".
     It cannot be seen by reading either half alone: the two sections are
     component state and the two panels are the URL, so nothing about the types
     stops both being drawn at once.

     This test has been rewritten twice by the same instruction, and the middle
     version is the one worth remembering: it asserted that opening a card HID
     the other three, which was true and still left the four-card index standing
     whenever nothing was open. The index was the resting state, and the resting
     state is what the owner was looking at. There is no index now. */
  test('ME draws exactly one card, and the strip is what picks it', async ({ page }) => {
    const labels = () =>
      page.locator('.mmm-me-section:visible').evaluateAll((nodes) => nodes.map((n) => n.getAttribute('aria-label')));

    await page.goto('/app/me');
    await expect.poll(labels).toEqual(['Profiles']);

    // Nothing on the card toggles it: the headers, chevrons and their hit
    // targets are gone with the accordion.
    await expect(page.locator('.mmm-me-accordion')).toHaveCount(0);

    /* The strip changes it, and a panel reaches the URL so it stays
       deep-linkable and Back returns to the card before it. */
    const strip = page.getByRole('tablist', { name: /Sections in ME/i });
    await strip.getByRole('tab', { name: 'Info', exact: true }).click();
    await expect.poll(labels).toEqual(['Info']);
    /* `panel=info`, not `panel=legal`: the strip writes the CANONICAL id, and
       Legal is a row inside Info rather than a panel of its own. `?panel=legal`
       still resolves here — `canonicalMePanelId` maps the retired id — which is
       what keeps the old deep links working. */
    await expect(page).toHaveURL(/panel=info/);

    /* Deliberately NOT asserting Back here. The section lives in component
       state and the two panels in the URL, so the history between them is not
       one sequence — and the soft-navigation commit problem recorded in
       DESIGN_SYNC row 309 makes what Back does from an /app route its own
       question. Moving on is what this test is about. */
    await strip.getByRole('tab', { name: 'Settings', exact: true }).click();
    await expect.poll(labels).toEqual(['Settings']);
    await expect(page).toHaveURL(/panel=settings/);
  });

  // Deep-linking a panel shows that panel ALONE — the default index applies
  // only when nothing is open, or the URL's own drawer loads a screen down.
  test('arriving on a panel deep link shows that panel and nothing else', async ({ page }) => {
    await page.goto('/app/me?panel=legal');
    const cards = page.locator('.mmm-me-section:visible');
    await expect.poll(() => cards.evaluateAll((nodes) => nodes.map((n) => n.getAttribute('aria-label')))).toEqual(['Info']);
    // And it is the card's CONTENT that is on screen, not a header standing in
    // for it — the legal rows the panel is a menu of.
    await expect(cards.getByRole('link', { name: /Terms|Privacy/i }).first()).toBeVisible();
  });

  /* The strip is ME's subnav and it has to carry EVERY section (owner,
     2026-08-25: "Profiles My Tickets Info Settings for the four subnav options
     in Me"). It used to carry only Info and Settings — `MMM_ME_PANELS`, the two
     with rows — which was survivable while every card was on screen at once and
     stopped being survivable the moment ME began showing one at a time: closing
     the open card became the only route to the other three.

     It is THREE now, because My Tickets was promoted to a top-level tab
     (MIDDLE ROAD, 2026-09-04) rather than dropped. Both halves of that are
     asserted: the strip carries the three that remain, and the wallet is
     reachable in one tap from the bar instead of two turns of a dial. Driven
     rather than read, because the failure mode is a section that exists in a
     list and reaches nothing. */
  test('the ME strip carries every section, each opening its own card', async ({ page }) => {
    await page.goto('/app/me');
    const listed = () =>
      page.locator('.mmm-me-section:visible').evaluateAll((nodes) => nodes.map((n) => n.getAttribute('aria-label')));
    const strip = page.getByRole('tablist', { name: /Sections in ME/i });
    await expect(strip).toBeVisible();

    // Arriving on ME lands on the first section.
    await expect.poll(listed).toEqual(['Profiles']);

    /* Each pill must leave exactly one card, and the panels must reach the URL
       so they stay deep-linkable. */
    for (const [pill, expected] of [['Info', ['Info']], ['Settings', ['Settings']], ['Profiles', ['Profiles']]] as const) {
      await strip.getByRole('tab', { name: pill, exact: true }).click();
      await expect.poll(listed).toEqual(expected);
    }

    // My Tickets is no longer here, and that is only acceptable because it is
    // one tap away on the bar. Both directions asserted.
    await expect(strip.getByRole('tab', { name: 'My Tickets' })).toHaveCount(0);
    await page.getByRole('link', { name: 'Tickets', exact: true }).click();
    await expect(page).toHaveURL(/\/app\/tickets$/);
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
      // Deep-linked rather than tuned: the dial is covered by its own test, and
      // this one is about the ticket.
      await page.goto('/app/tickets');

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

      await page.goto('/app/tickets');

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

      /* WHICH HALF OF THE PANE RENDERS DEPENDS ON WHETHER STRIPE IS
         CONFIGURED, and the harness forwards a key only when the caller has
         one — so this spec runs in both states and has to assert whichever it
         is in. The pane offers a purchase form only when payment processing is
         ready; when it is not, it says so instead, because the ticket route
         answers that state 503 and a form that cannot complete is worse than
         an honest notice. Pinning the sale card unconditionally is what made
         this test fail the day that gate was added — it encoded one
         environment rather than the rule. */
      const saleReady = await page.locator('.mmm-show-sale').count() > 0;
      if (!saleReady) {
        await expect(page.getByText('Paid tickets · Coming soon')).toBeVisible();
        await expect(page.locator('h1.mmm-show-title:visible')).toHaveCount(1);
        await expect(page.locator('h1.mmm-show-title:visible')).toHaveText(seeded.title);
        await expect(page.getByText('Split locked at publish')).toBeVisible();
        await expect(page.getByText('70 / 20 / 10 · iHYPE $0')).toBeVisible();
        return;
      }

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
      // The split states the show's OWN percentages. S9 (2026-08-24) replaced
      // the labelled bar with the locked-split ledger row, and the per-role
      // named shares moved into the sale card's split rows — so the assertion
      // follows the information, not the retired node: the numbers must be the
      // show's own, and every share must still be NAMED somewhere on the pane.
      await expect(page.getByText('Split locked at publish')).toBeVisible();
      await expect(page.getByText('70 / 20 / 10 · iHYPE $0')).toBeVisible();
      const saleCard = page.locator('.mmm-show-sale:visible');
      await expect(saleCard).toContainText('· 70%');
      await expect(saleCard).toContainText('· 20%');
      await expect(saleCard).toContainText('· 10%');
      // WHAT the percentages are a share of — the face-value line survives.
      await expect(page.locator('.mmm-show-fee').first()).toContainText('face value');
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

  /* The wallet is its own destination now (MIDDLE ROAD, 2026-09-04) and the
     old ME deep link still reaches it. Asserted on the surface rather than on
     rows, because a seeded account with no tickets is the normal state for this
     suite — what must not come back is the pair of buttons that left MMM for
     the legacy shell, which is a different header, a different player and no
     route back for the rest of the session. */
  test('the wallet is a destination, and the old ME deep link forwards to it', async ({ page }) => {
    await page.goto('/app/me?section=tickets');
    await expect(page).toHaveURL(/\/app\/tickets$/);
    const body = page.locator('.mmm-pane:visible');
    // Either real ticket rows, or the empty note — never a way out of the shell.
    await expect(body.getByRole('link', { name: /My tickets|Browse shows/ })).toHaveCount(0);
    await expect(body.locator('.mmm-ticket-list, .mmm-me-note')).not.toHaveCount(0);
    // And it is a tab, not a section: the bar reports Tickets as current.
    await expect(page.locator('.mmm-dock:visible .mmm-tab[data-on="true"]')).toHaveText('Tickets');
  });

  // An account with no Profile row has no hexId and therefore no HYPE link. The
  // card must be absent, not present-and-blank — and the surface must still
  // render, which is the actual risk.
  test('a profile-less account still renders ME, without a HYPE link card', async ({ page }) => {
    await page.goto('/app/me');
    /* The surface renders — its first card is there — and the HYPE link is not
       present-and-blank, it is absent.

       Settled on a COUNT rather than asserted visible directly: while the route
       streams there are briefly two "Profiles" sections, the live one and the
       staging copy Next moves into place, and `toBeVisible()` on a locator
       matching both fails strict mode ("resolved to 2 elements") rather than
       waiting. Asserting exactly one visible card is both the settle and a
       genuine check that a double render is not shipping. */
    const card = page.locator('.mmm-me-section:visible');
    await expect(card).toHaveCount(1);
    await expect(card).toHaveAttribute('aria-label', 'Profiles');
    /* Anchored on the card's own class, not its words. Matching text made this
       assertion catch an unrelated mention of the HYPE link elsewhere on ME —
       a negative assertion has to name the thing it denies. */
    await expect(page.locator('.mmm-hype-link')).toHaveCount(0);
  });
});

test.describe('ME with a real profile', () => {
  test.beforeEach(async ({ context }) => {
    await signIn(context, ARTIST_EMAIL, [{ type: 'ARTIST', name: 'E2E MMM Artist' }]);
  });

  /* SETTLE BEFORE MATCHING TEXT, and the count assertion is what does it.

     While this route streams, Next holds a copy of the content in a hidden
     staging node and moves it into place with a script — the same behaviour the
     buy-pane test above documents. A bare `getByText` in that window resolves
     to two nodes that are really one and fails on strict mode, which is exactly
     how this pair failed in CI: "Your HYPE link" resolved to 2 elements, one
     inside #main-content and one outside.

     Asserting ONE visible card first is both the settle and a real check: a
     genuine double render is two cards and fails here, so the `.first()` below
     can no longer absorb one. */
  test('the HYPE link card renders and states that promoting needs no role', async ({ page }) => {
    await page.goto('/app/me');
    await expect(page.locator('.mmm-me-section:visible')).toHaveCount(1);
    await expect(page.locator('.mmm-hype-link')).toBeVisible();
    /* The claim moved behind a disclosure when the card was made compact
       (2026-09-03) — it sits above every ME panel, so its resting height is a
       tax on all of them. The LINK stays visible; only the explanation folds.
       Asserting it after opening keeps the claim pinned without pinning the
       340px card back into place. */
    await page.getByRole('group').filter({ hasText: 'How this earns' }).locator('summary').first().click();
    await expect(page.getByText(/Promoting needs no role and no signup/i).first()).toBeVisible();
  });

  // The fan page creator was removed; Artist and Venue keep theirs. The role
  // switcher only appears once an account holds more than the implicit Fan role.
  test('an artist account gets a page card and a role switcher', async ({ page }) => {
    await page.goto('/app/me?role=artist&section=profiles');
    /* Same settle as the HYPE-link test above, and for the same reason — this
       pair had it and these two did not, which is why they were the flaky ones.
       Matching text before the streamed content is moved out of the staging
       node fails with "element not found", intermittently, depending on how
       fast the route streams. */
    const card = page.locator('.mmm-me-section:visible');
    await expect(card).toHaveCount(1);
    await expect(card.getByText(/Your page/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Fan', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Artist', exact: true })).toBeVisible();
  });

  /* A profile's own tab set renders in the pane's strip, and there is exactly
     ONE section control on screen.

     That last clause is the durable half and it survived the rule reversing.
     The old contract was "one dial per screen and it is the dock's", because a
     profile drawing its own dial ten pixels above the dock's put two
     identical-looking controls on screen meaning different things — which
     really shipped. The dial is retired (MIDDLE ROAD, 2026-09-04) and the
     sections moved INTO the pane, so the assertion inverts: the strip is in the
     pane, the bar carries no tablist, and the total is still one. The seeded
     artist's own page is the one profile this suite can reach without depending
     on fixture content. */
  test('a profile draws its tabs in the pane, and there is only one of them', async ({ page }) => {
    await page.goto('/app/me?role=artist&section=profiles');
    /* SCOPE THE LINK TO THE SETTLED CARD, and this is a correctness fix rather
       than a timing tweak.

       While the route streams, Next holds a copy of the content in a hidden
       staging node and moves it into place with a script (see the HYPE-link
       test above). An unscoped `a[href^="/app/artists/"]`.first() can therefore
       resolve to the STAGED copy, which is real DOM with no React handler
       attached — so the click lands, reports success, and no navigation ever
       happens. That is exactly how this failed in CI on 2026-08-26, and it
       reads identically to a broken router: the link is visible, the click is
       accepted, the URL never moves. It cost a long investigation into a Next
       minor bump that turned out to be innocent.
    
       Scoping to `.mmm-me-section:visible` after asserting there is exactly one
       makes the staged copy unreachable by construction, rather than waiting
       and hoping the swap has happened. */
    const card = page.locator('.mmm-me-section:visible');
    await expect(card).toHaveCount(1);
    const link = card.locator('a[href^="/app/artists/"]').first();
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/\/app\/artists\//);

    await expect(page.locator('.mmm-pane [role="tablist"]')).toBeVisible();
    // The bar is navigation, never sections — two controls that look alike and
    // mean different things is the failure the old rule was protecting against,
    // and it is still the failure.
    await expect(page.locator('.mmm-dock [role="tablist"]')).toHaveCount(0);
    await expect(page.getByRole('tablist')).toHaveCount(1);
  });

  /* The way OUT of a detail page, and nothing tested that until it broke in
     both possible ways at once (2026-08-25): the nameplate's `goModule(0)`
     early-returned because every detail path reports as MAP, so the badge was
     inert, and even once that was fixed a soft `router.push` never committed
     from these routes so the URL did not move. A member who tapped into a
     profile had NO way back — this bar is the app's only navigation.

     **The nameplate is gone** (MIDDLE ROAD, 2026-09-04) and so is the class of
     bug: it guessed a destination from a remembered path, and both failures
     above were failures of that guess. Four labelled tabs cannot early-return
     on a module they cannot resolve, because each one names an absolute
     destination. What still has to be true, and is what this asserts, is that
     the bar is PRESENT and WORKS from a detail route — reached by clicking
     through rather than by `goto`, so the real navigation is exercised. */
  test('the bar escapes a detail page — it is the only way out', async ({ page }) => {
    await page.goto('/app/me?role=artist&section=profiles');
    /* SCOPE THE LINK TO THE SETTLED CARD, and this is a correctness fix rather
       than a timing tweak: while the route streams, Next holds a copy of the
       content in a hidden staging node, and an unscoped match can resolve to
       it — real DOM with no React handler attached, so the click lands, reports
       success, and no navigation ever happens. That is how this failed in CI on
       2026-08-26 and it reads identically to a broken router. */
    const card = page.locator('.mmm-me-section:visible');
    await expect(card).toHaveCount(1);
    const link = card.locator('a[href^="/app/artists/"]').first();
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/\/app\/artists\//);

    // Every destination, from a detail route, in one tap each.
    const dock = page.locator('.mmm-dock:visible');
    await expect(dock).toHaveCount(1);
    await dock.getByRole('link', { name: 'Me', exact: true }).click();
    await expect(page).toHaveURL(/\/app\/me(\?|\/|$)/, { timeout: 15_000 });
  });

  test('the fan role has no page card — the fan page creator was removed', async ({ page }) => {
    await page.goto('/app/me?role=fan');
    // Settled first, same reason as the HYPE-link test above — and the card
    // itself is matched with `:visible` and a COUNT, not asserted visible
    // directly. While the route streams there are two `.mmm-hype-link` nodes,
    // the live one and Next's staging copy, and `toBeVisible()` on a locator
    // matching both fails strict mode ("resolved to 2 elements") rather than
    // waiting. Twelfth member of the duplication family in this file; it went
    // green on retry, which is exactly how a flake hides.
    await expect(page.locator('.mmm-me-section:visible')).toHaveCount(1);
    await expect(page.locator('.mmm-hype-link:visible')).toHaveCount(1);
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
  test('a tab is clickable with the consent dialog on screen', async ({ page, context }) => {
    // Note the absence of the consent-seeding init script the `signIn` helper
    // adds. A first visit is the state under test.
    await applySessionCookie(context, EMAIL, { profiles: [] });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/app/map');

    // Guard the test itself: if consent stopped rendering, everything below
    // would pass while proving nothing.
    const consent = page.getByRole('dialog', { name: /cookie preferences/i });
    await expect(consent).toBeVisible();

    const trigger = page.getByRole('link', { name: 'Listen', exact: true });
    await expect(trigger).toBeVisible();

    /* The real assertion is hit-testing, not visibility: the failure mode was a
       fully visible control sitting underneath a higher z-index dialog. EVERY
       tab is checked, not just one — the bar spans the width where the old
       chrome floated bottom-left, so a banner can cover some of it and leave
       the rest reachable, which would pass a single-control probe. */
    await expect.poll(async () => page.evaluate(() => {
      const tabs = [...document.querySelectorAll('.mmm-dock .mmm-tab')];
      if (tabs.length === 0) return 'no tabs rendered';
      for (const tab of tabs) {
        const box = tab.getBoundingClientRect();
        const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
        if (!hit) return `nothing at the centre of "${tab.textContent}"`;
        if (!tab.contains(hit) && hit !== tab) return `"${tab.textContent}" covered by ${hit.className || hit.tagName}`;
      }
      return 'ok';
    }), { timeout: 10000 }).toBe('ok');

    // And it actually works, with consent still up.
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
    /* The LIVE dock, not `querySelector`'s first match: while the route
       streams there are two, and the staged copy's rect is all zeros — which
       would report a gap of a whole viewport and fail a correct page. */
    const gap = () => page.evaluate(() => {
      const dock = [...document.querySelectorAll('.mmm-dock')]
        .find((node) => (node as HTMLElement).offsetParent !== null) ?? document.querySelector('.mmm-dock')!;
      const box = dock.getBoundingClientRect();
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
