import { test, expect, type BrowserContext } from '@playwright/test';
import { applySessionCookie, canSeedSession } from './fixtures/session';

/**
 * THE CREATION FLOWS — the alpha acceptance list's untested middle.
 *
 * Every surface here existed before it had a test, and one of them is the
 * cautionary tale: TrackUploadPanel was the only client of /api/artist-media
 * and was MOUNTED NOWHERE from the legacy artist page's retirement until
 * 2026-08-26 — no artist could upload a track at all, and nothing red said so.
 * A flow that exists but cannot be reached is exactly what an end-to-end walk
 * catches and a unit test structurally cannot.
 *
 * These tests drive the real UI (the create card, the file input, the publish
 * button), not the API. Where a flow ends in an async server judgement (the
 * upload scan), the assertion is the surface's own settled state, not a
 * network response.
 *
 * Runs in ITS OWN SHARD (see DEFAULT_TEST_SHARDS in scripts/e2e-workerd.mjs —
 * an allowlist: a spec not listed there silently never runs). A fresh workerd
 * per shard also keeps this suite clear of the known per-request PrismaClient
 * memory growth in long-lived dev servers.
 */

const EMAIL = 'e2e-creation@ihype.org';

/* Run-unique address suffix. These flows CREATE state (a profile, an
 * advertiser account), and a rerun against last run's rows tests a different
 * thing — the advertiser test regressed exactly this way: the account already
 * existed, the route redirected before the form ever rendered, and the fill
 * timed out. Fresh rows per run keep every run the first run. The scratch DB
 * is recreated per CI job, so the rows do not accumulate anywhere real. */
const RUN = Date.now().toString(36);

/** Exactly one visible match, then that match — the settle this repo's
 * streaming shells require. While a route streams, Next holds a staged copy of
 * the content and an unscoped locator resolves to BOTH nodes: strict mode
 * fails, and `.first()` would be worse (it can pick the staged copy, whose
 * handlers are not attached — a click that "works" and does nothing). Same
 * pattern as mmm-shell.spec.ts, learned there the expensive way. */
async function settled(page: import('@playwright/test').Page, selector: string) {
  const one = page.locator(`${selector}:visible`);
  await expect(one).toHaveCount(1);
  return one;
}

async function signIn(
  context: BrowserContext,
  email = EMAIL,
  profiles: { type: 'ARTIST' | 'VENUE'; name: string; verified?: boolean }[] = [],
) {
  test.skip(!canSeedSession(), 'AUTH_SECRET and a scratch DATABASE_URL are required.');
  await applySessionCookie(context, email, { profiles });
}

test.describe('creating pages', () => {
  test('a fan creates an artist page through the page creator', async ({ context, page }) => {
    // A fresh address per concern: this user must START with no profiles, or
    // the creator renders "add another" state and the assertions drift.
    await signIn(context, `e2e-create-artist-${RUN}@ihype.org`);
    await page.goto('/app/me/profiles');

    /* A member with NO pages lands on the empty state, and the creator grid is
       behind its CTA. `cta.count()` sampled immediately races the stream — it
       reads 0 before hydration and skips a click that was needed (measured:
       both page tests timed out that way). Wait for EITHER surface to exist,
       then click through the one that did. */
    const cta = page.getByRole('button', { name: /Create your first page/i });
    const artistCard = page.getByRole('button', { name: /Artist Page/i });
    await expect(cta.or(artistCard).first()).toBeVisible({ timeout: 15_000 });
    if (await cta.count()) await cta.first().click();
    await artistCard.first().click();
    await page.getByPlaceholder(/Artist Page name/i).fill('Creation Flow Artist');
    /* The attestation is artist-only and load-bearing: the Create button is
       disabled until it is ticked, which is itself worth asserting — an artist
       page without the upload-rights attestation is a policy hole. */
    const create = page.getByRole('button', { name: 'Create', exact: true });
    await expect(create).toBeDisabled();
    await page.getByRole('checkbox').check();
    await create.click();

    // The page appears in the member's own list — the outcome, not the POST.
    await expect(page.getByText('Creation Flow Artist').first()).toBeVisible({ timeout: 15_000 });
  });

  test('a fan creates a venue page, which needs no attestation', async ({ context, page }) => {
    await signIn(context, `e2e-create-venue-${RUN}@ihype.org`);
    await page.goto('/app/me/profiles');

    const cta = page.getByRole('button', { name: /Create your first page/i });
    const venueCard = page.getByRole('button', { name: /Venue Page/i });
    await expect(cta.or(venueCard).first()).toBeVisible({ timeout: 15_000 });
    if (await cta.count()) await cta.first().click();
    await venueCard.first().click();
    await page.getByPlaceholder(/Venue Page name/i).fill('Creation Flow Venue');
    // No checkbox for venues — the Create button arms on the name alone.
    const create = page.getByRole('button', { name: 'Create', exact: true });
    await expect(create).toBeEnabled();
    await create.click();

    await expect(page.getByText('Creation Flow Venue').first()).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('advertiser signup', () => {
  test('a member becomes an advertiser from the in-shell form', async ({ context, page }) => {
    await signIn(context, `e2e-create-advertiser-${RUN}@ihype.org`);
    await page.goto('/app/me/advertising/start');

    /* Settled to the one visible form first — CI's stream timing surfaces the
       staged duplicate here where local runs never did (strict mode: "resolved
       to 2 elements"), which is exactly why every fill in this file scopes to
       a settled container. */
    const form = page.locator('form.adv-signup:visible');
    await expect(form).toHaveCount(1, { timeout: 15_000 });
    await form.getByLabel(/Company or brand name/i).fill('Creation Flow Sound Co');
    await form.getByRole('button', { name: /create|start|open/i }).first().click();

    /* Success is a REDIRECT to the advertising dashboard — the route's own
       contract: an existing profile redirects to /app/me/advertising, so
       landing there is the one observable outcome either way. */
    await expect(page).toHaveURL(/\/app\/me\/advertising(\?|$)/, { timeout: 15_000 });
  });
});

test.describe('uploading a track', () => {
  test('an artist uploads a track from their own page and sees the scan verdict', async ({ context, page }) => {
    /* VERIFIED, because the gate is real: POST /api/artist-media 403s an
       UNVERIFIED profile ("Verify this page before uploading") — the run that
       found this sat waiting for a verdict from an upload the server had
       already refused. The test seeds a profile that has passed the gate the
       product enforces, rather than weakening the gate. */
    await signIn(context, `e2e-create-uploader-${RUN}@ihype.org`, [
      { type: 'ARTIST', name: 'E2E Upload Artist', verified: true },
    ]);

    // Reach the artist's own page via ME — the same path a member walks, which
    // is the point: this panel's failure mode was being unreachable, not broken.
    await page.goto('/app/me?role=artist&section=profiles');
    const card = page.locator('.mmm-me-section:visible');
    await expect(card).toHaveCount(1);
    const link = card.locator('a[href^="/app/artists/"]').first();
    await expect(link).toBeVisible();
    const href = await link.getAttribute('href');
    await page.goto(`${href}?tab=albums`);

    const panel = page.locator('.artist-media-upload-panel:visible');
    await expect(panel).toHaveCount(1, { timeout: 15_000 });

    /* A real, valid MP3 header followed by silence — magic-byte validation on
       the server rejects a fake, so the fixture must genuinely be audio.
       0xFFF3 is an MPEG-1 layer-3 frame sync; 400 frames ≈ 10s of silence. */
    const frame = Buffer.alloc(417, 0);
    frame[0] = 0xff; frame[1] = 0xf3; frame[2] = 0x90; frame[3] = 0x64;
    const mp3 = Buffer.concat(Array.from({ length: 400 }, () => frame));

    await panel.locator('input[type="file"][accept*="audio/"]').setInputFiles({
      name: 'creation-flow.mp3', mimeType: 'audio/mpeg', buffer: mp3,
    });
    await panel.getByPlaceholder(/Track title/i).fill('Creation Flow Anthem');
    await panel.getByRole('button', { name: /Upload track/i }).click();

    /* The panel reveals the four scan layers, then a verdict. Either verdict is
       a PASS for this flow — "cleared" and "held for review" are both the
       system working; what must not happen is an error or silence. The scan
       reveal is staggered client-side, so the timeout is generous. */
    /* Watch the failure texts too, so a refused upload names itself instead
       of burning the whole timeout looking like silence. */
    const verdict = page.getByText(/All checks cleared|Held for review|Could not upload|Verify this page/i).first();
    await expect(verdict).toBeVisible({ timeout: 60_000 });
    await expect(verdict).toHaveText(/All checks cleared|Held for review/i);
  });
});

test.describe('creating an event', () => {
  test('an artist with a venue publishes an event and locks the charter', async ({ context, page }) => {
    await signIn(context, `e2e-create-event-${RUN}@ihype.org`, [
      { type: 'ARTIST', name: 'E2E Event Artist' },
      { type: 'VENUE', name: 'E2E Event Venue' },
    ]);
    await page.goto('/app/me/events/new');

    const title = await settled(page, 'input#event-title');
    await title.fill('Creation Flow Showcase');

    /* The artist and venue pickers are typeahead searches over live rows —
       which is why the fixture seeds both profiles under this same user: the
       search must FIND something this test controls. */
    const artistSearch = page.getByPlaceholder(/^Search artist/i).locator('visible=true');
    await expect(artistSearch).toHaveCount(1);
    await artistSearch.fill('E2E Event Artist');
    await page.getByText('E2E Event Artist').last().click();
    const venueSearch = page.getByPlaceholder(/^Search venue/i).locator('visible=true');
    await expect(venueSearch).toHaveCount(1);
    await venueSearch.fill('E2E Event Venue');
    await page.getByText('E2E Event Venue').last().click();

    /* Step 0 also gates Continue on date and doors time; price and capacity on
       the later steps carry defaults ('18' / '300'), so the walk to the review
       step is Continue × the steps between. The loop stops when Publish
       appears rather than assuming the step count, so an added step moves the
       walk instead of breaking it. */
    await page.locator('#event-date:visible').fill('2026-12-31');
    await page.locator('#event-time:visible').fill('19:00');
    const publish = page.getByRole('button', { name: /Publish event & lock charter/i });
    for (let hop = 0; hop < 5 && !(await publish.count()); hop += 1) {
      const next = page.getByRole('button', { name: /Continue/ }).first();
      await expect(next).toBeEnabled();
      await next.click();
    }
    await publish.click();

    /* Publishing answers with the slug and the page flips to its published
       state. The charter warning above the button is the sentence that
       matters legally; asserting the publish succeeded asserts the 70/20/10
       freeze it describes was accepted. */
    await expect(page.getByText(/published|live|view event/i).first()).toBeVisible({ timeout: 20_000 });
  });
});

/* ADVERTISING INSIDE THE iOS AND ANDROID APPS (DESIGN_SYNC row 514).
 *
 * The store apps are a WebView on this site, and Apple requires in-app
 * purchase for ads that play in the same app — so inside the app an advertiser
 * signs up and reads pricing, and builds and pays for a campaign on the web.
 * The next store build appends `iHYPEApp/1` to its user agent; a build that
 * predates it is recognised by `window.Capacitor`. Both are driven here, and a
 * plain browser is driven too, because the failure worth fearing is the web
 * losing its checkout, not only the app keeping one. */
const APP_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 iHYPEApp/1';

async function signInAdvertiser(context: BrowserContext, email: string) {
  test.skip(!canSeedSession(), 'AUTH_SECRET and a scratch DATABASE_URL are required.');
  await applySessionCookie(context, email, {
    advertiser: {
      companyName: 'Web Only Sound Co',
      campaigns: [{
        title: 'Unpaid spot',
        status: 'AWAITING_PAYMENT',
        pricingModel: 'SPONSORSHIP',
        budgetCents: 2500,
        createdAt: new Date('2026-09-01T12:00:00Z'),
      }],
    },
  });
}

test.describe('advertising inside the app (user-agent token)', () => {
  test.use({ userAgent: APP_UA });

  test('the app shows pricing and sends building and paying to the web', async ({ browser, context, page }) => {
    await signInAdvertiser(context, `e2e-adweb-app-${RUN}@ihype.org`);

    await page.goto('/app/me/advertising/new');
    await settled(page, '[data-web-only="campaigns"]');
    await expect(page.locator('.adv-compact')).toHaveCount(0);
    await expect(page.locator('.mmm-ad-pricing-table:visible tbody tr')).toHaveCount(4);

    await page.goto('/app/me/advertising');
    await settled(page, '[data-web-only="new-campaign"]');
    await expect(page.locator('a.mmm-advertiser-new')).toHaveCount(0);
    // The unpaid campaign offers the web, never a checkout, inside the app.
    await settled(page, '[data-web-only="pay"]');
    await expect(page.getByRole('button', { name: /Pay now/ })).toHaveCount(0);

    const create = await page.request.post('/api/advertise/campaigns', {
      data: { title: 'From the app' },
      headers: { 'user-agent': APP_UA },
    });
    expect(create.status()).toBe(403);
    expect((await create.json()).code).toBe('CAMPAIGNS_WEB_ONLY');

    await page.goto('/advertise');
    await settled(page, '[data-web-only="landing-note"]');
    await expect(page.locator('.mmm-ad-pricing-table:visible tbody tr')).toHaveCount(4);

    /* The trip to the web signs the browser tab in. The tab keeps its own
       cookies (SFSafariViewController / a Custom Tab), so it is driven here as
       a FRESH context with a browser's user agent and no session: it follows
       the one-time link and lands signed in on the builder, where the checkout
       is allowed. A second use of the same link is refused. */
    const handoff = await page.request.post('/api/auth/web-handoff', {
      data: { next: '/app/me/advertising/new' },
      headers: { 'user-agent': APP_UA },
    });
    expect(handoff.status()).toBe(200);
    const { url, signedIn } = (await handoff.json()) as { url: string; signedIn: boolean };
    expect(signedIn).toBe(true);
    const base = test.info().project.use.baseURL ?? 'http://localhost:3000';

    const tab = await browser.newContext({ baseURL: base });
    const tabPage = await tab.newPage();
    await tabPage.goto(url);
    await expect(tabPage).toHaveURL(/\/app\/me\/advertising\/new(\?|$)/, { timeout: 15_000 });
    await settled(tabPage, '.adv-compact');
    await tab.close();

    const replay = await browser.newContext({ baseURL: base });
    const replayPage = await replay.newPage();
    await replayPage.goto(url);
    await expect(replayPage).toHaveURL(/\/login\?error=expired_magic_link/, { timeout: 15_000 });
    await replay.close();
  });
});

test.describe('advertising inside an app build that predates the token', () => {
  test('the native bridge alone, with no user-agent token, still swaps the builder for the web page', async ({ context, page }) => {
    await signInAdvertiser(context, `e2e-adweb-oldapp-${RUN}@ihype.org`);
    /* What the iOS native bridge provides at document start: its own
       `window.Capacitor`, and the message handler behind it. The first alone
       is not enough: @capacitor/core, loaded by the
       root layout, rebuilds that object and decides "native" from the BRIDGE
       it can see (`webkit.messageHandlers.bridge` on iOS, `androidBridge` on
       Android), which is exactly what a real older build has. The no-op
       postMessage means a plugin call never resolves, which is harmless here. */
    await context.addInitScript(() => {
      (window as unknown as { webkit: unknown }).webkit = { messageHandlers: { bridge: { postMessage: () => undefined } } };
      (window as unknown as { Capacitor: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios' };
    });

    await page.goto('/app/me/advertising/new');
    await settled(page, '[data-web-only="campaigns"]');
    await expect(page.locator('.adv-compact')).toHaveCount(0);
  });
});

test.describe('advertising in a browser', () => {
  test('a browser keeps the builder and the checkout, with no in-app note', async ({ context, page }) => {
    await signInAdvertiser(context, `e2e-adweb-browser-${RUN}@ihype.org`);

    await page.goto('/app/me/advertising/new');
    await settled(page, '.adv-compact');
    await expect(page.locator('[data-web-only]')).toHaveCount(0);

    await page.goto('/app/me/advertising');
    await settled(page, 'a.mmm-advertiser-new');
    await expect(page.getByRole('button', { name: /Pay now/ }).first()).toBeVisible();

    await page.goto('/advertise');
    await expect(page.locator('.mmm-ad-pricing-table:visible tbody tr')).toHaveCount(4);
    await expect(page.locator('[data-web-only="landing-note"]')).toHaveCount(0);
  });
});
