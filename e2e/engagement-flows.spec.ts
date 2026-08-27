import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { applySessionCookie, canSeedSession, seedSessionCookie } from './fixtures/session';

/**
 * THE ENGAGEMENT FLOWS — the alpha acceptance list's "what a fan actually
 * does": like, hype, look at what you liked, change your name, and follow a
 * friend's HYPE link.
 *
 * These are the acts the product is FOR, and none of them had an end-to-end
 * test. They also share a failure mode that unit tests structurally cannot
 * catch: every one of them is an optimistic control. The heart lights, the
 * count ticks, the name appears in the field — and all of that happens before
 * the server has said anything, by design (a heart that lags reads as a
 * dropped tap). So a broken write looks exactly like a working one until the
 * page is reloaded, which is why almost every assertion here is written across
 * a reload rather than against the control's own state.
 *
 * The HYPE tests are two halves of one rule and both matter. `User.hypeBalance`
 * defaults to 0 and `applyHypeEntry` refuses a spend it cannot cover, so the
 * ordinary state of a brand-new member is "cannot hype anything". A test that
 * only covers the success path would be testing a state most accounts are not
 * in.
 *
 * Runs in its own shard — DEFAULT_TEST_SHARDS in scripts/e2e-workerd.mjs is an
 * allowlist, and a spec not on it silently never runs.
 */

/* Run-unique addresses. These flows write member state (a like, a spent HYPE
 * balance, a changed display name), and a rerun against last run's rows tests
 * something else — the hype-refusal test is the sharp one: a rerun of the
 * success test has already spent the balance, so the two would agree by
 * accident rather than by rule. */
const RUN = Date.now().toString(36);

async function signIn(
  context: BrowserContext,
  email: string,
  options: Parameters<typeof applySessionCookie>[2] = {},
) {
  test.skip(!canSeedSession(), 'AUTH_SECRET and a scratch DATABASE_URL are required.');
  return applySessionCookie(context, email, options);
}

/** Exactly one visible match, then that match. While `/app` streams, Next holds
 * a hidden staged copy of the content and an unscoped locator resolves to BOTH
 * nodes — strict mode fails, and `.first()` is worse than the failure because
 * it can pick the staged copy, whose handlers are not attached: the click
 * lands, reports success, and does nothing. Learned across eleven separate
 * instances in mmm-shell.spec.ts. */
async function settled(page: Page, selector: string) {
  const one = page.locator(`${selector}:visible`);
  await expect(one).toHaveCount(1, { timeout: 15_000 });
  return one;
}

/** The member's own seeded artist page, reached the way a member reaches it.
 * Going through ME rather than constructing the slug keeps this test coupled
 * to the product's navigation instead of to the fixture's private naming. */
async function ownArtistPage(page: Page) {
  await page.goto('/app/me?role=artist&section=profiles');
  const card = await settled(page, '.mmm-me-section');
  const link = card.locator('a[href^="/app/artists/"]').first();
  await expect(link).toBeVisible({ timeout: 15_000 });
  const href = await link.getAttribute('href');
  await page.goto(href!);
  return href!;
}

test.describe('liking', () => {
  test('liking an artist survives a reload, and unliking survives one too', async ({ context, page }) => {
    await signIn(context, `e2e-like-artist-${RUN}@ihype.org`, {
      profiles: [{ type: 'ARTIST', name: 'E2E Liked Artist' }],
    });
    await ownArtistPage(page);

    /* The control names itself by its ACTION, not its state: "Like X" when
       unlit, "Unlike X" when lit. That is what a screen reader announces, so
       it is the right thing to assert — and it makes the two directions of
       this test read as opposites rather than as a flag check. */
    const like = page.getByRole('button', { name: /^Like E2E Liked Artist$/ });
    await expect(like).toBeVisible({ timeout: 15_000 });
    await like.click();
    await expect(page.getByRole('button', { name: /^Unlike E2E Liked Artist$/ })).toBeVisible();

    // The reload is the assertion. Everything above passes against a heart
    // that lit optimistically and never reached the server.
    await page.reload();
    const unlike = page.getByRole('button', { name: /^Unlike E2E Liked Artist$/ });
    await expect(unlike).toBeVisible({ timeout: 15_000 });

    // And back: an unlike that only unlights is the same bug wearing the
    // other face, and it is the one that loses data rather than inventing it.
    await unlike.click();
    await expect(page.getByRole('button', { name: /^Like E2E Liked Artist$/ })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: /^Like E2E Liked Artist$/ })).toBeVisible({ timeout: 15_000 });
  });

  test('a liked artist appears under Liked artists in Playlists', async ({ context, page }) => {
    /* Where likes are READ is not where they are written, and the two have
       already disagreed once: the Library station was retired 2026-08-25 and
       its contents moved into Playlists. A like that writes correctly and
       renders nowhere is indistinguishable from a like that failed. */
    await signIn(context, `e2e-like-list-${RUN}@ihype.org`, {
      profiles: [{ type: 'ARTIST', name: 'E2E Listed Artist' }],
    });
    await ownArtistPage(page);
    await page.getByRole('button', { name: /^Like E2E Listed Artist$/ }).click();
    await expect(page.getByRole('button', { name: /^Unlike E2E Listed Artist$/ })).toBeVisible();

    await page.goto('/app/music/playlists');
    await expect(page.getByText(/Liked artists/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('E2E Listed Artist').first()).toBeVisible();
  });
});

test.describe('hyping', () => {
  /* HYPE goes to SOMEONE ELSE. `/api/hype` answers 409 "You cannot HYPE your
     own profile", which is the right rule and is also why these two tests seed
     a second member and visit THEIR page — the first draft hyped the signed-in
     member's own artist page, and the button simply never left its resting
     state. A test that fails for a reason the product is right about is a test
     aimed at the wrong target. */
  async function someoneElsesArtist(name: string) {
    const owner = await seedSessionCookie(`e2e-hype-target-${name}-${RUN}@ihype.org`, {
      profiles: [{ type: 'ARTIST', name }],
    });
    const slug = owner.profiles.find((profile) => profile.type === 'ARTIST')?.slug;
    expect(slug, 'the fixture must report the seeded slug').toBeTruthy();
    return `/app/artists/${slug}`;
  }

  test('hyping an artist spends the balance and the count goes up', async ({ context, page }) => {
    test.skip(!canSeedSession(), 'AUTH_SECRET and a scratch DATABASE_URL are required.');
    const href = await someoneElsesArtist('E2E Hyped Artist');
    await signIn(context, `e2e-hype-spend-${RUN}@ihype.org`, { hypeBalance: 50 });
    await page.goto(href);

    const hype = page.getByRole('button', { name: /Hype this artist/i });
    await expect(hype).toBeVisible({ timeout: 15_000 });
    await hype.click();

    /* The button flips to its cooldown face, and that is the honest end state:
       HYPE is once per target per 24 hours, so a control still offering another
       tap would be lying about what the next one would do. Asserting the
       control's own accessible name rather than a formatted count keeps this
       independent of how the number is rendered. */
    await expect(page.getByRole('button', { name: /You can hype this artist again in/i }))
      .toBeVisible({ timeout: 15_000 });

    // Across a reload, because the count and the cooldown are both optimistic.
    await page.reload();
    await expect(page.getByRole('button', { name: /You can hype this artist again in/i }))
      .toBeVisible({ timeout: 15_000 });
  });

  test('a member with no HYPE is refused, and told why', async ({ context, page }) => {
    /* No `hypeBalance`, so the row keeps the schema default of 0 — the state
       every account is in until it earns some. The failure has to be VISIBLE:
       a spend that silently no-ops leaves a member tapping a button that does
       nothing, with no way to learn that listening is how you earn more. */
    test.skip(!canSeedSession(), 'AUTH_SECRET and a scratch DATABASE_URL are required.');
    const href = await someoneElsesArtist('E2E Unhyped Artist');
    await signIn(context, `e2e-hype-broke-${RUN}@ihype.org`);
    await page.goto(href);

    const hype = page.getByRole('button', { name: /Hype this artist/i });
    await expect(hype).toBeVisible({ timeout: 15_000 });
    await hype.click();

    await expect(page.getByText(/not enough hype|could not hype/i).first())
      .toBeVisible({ timeout: 15_000 });

    // And it did not bank one anyway: still offering the first tap after a
    // reload, rather than sitting in a cooldown it never paid for.
    await page.reload();
    await expect(page.getByRole('button', { name: /Hype this artist/i })).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('changing your own details', () => {
  test('a new display name persists across a reload', async ({ context, page }) => {
    await signIn(context, `e2e-rename-me-${RUN}@ihype.org`);
    await page.goto('/app/me/settings');

    /* The input, not `getByLabel`: this row renders a visible label AND gives
       the input the same aria-label, so the accessible-name query resolves to
       two nodes on a page that is entirely correct. */
    const field = await settled(page, 'input[aria-label="Display name"]');
    await field.fill(`Renamed ${RUN}`);
    await page.getByRole('button', { name: /Save settings/i }).click();
    await expect(page.getByText(/Saved/i).first()).toBeVisible({ timeout: 15_000 });

    /* The reload matters more here than anywhere else in this file: this form
       loads its value from `/api/me` on mount, so a PATCH that 200s without
       writing would still show the typed value until the page is thrown away. */
    await page.reload();
    await expect(await settled(page, 'input[aria-label="Display name"]'))
      .toHaveValue(`Renamed ${RUN}`, { timeout: 15_000 });
  });
});

test.describe('the HYPE link', () => {
  test('a signed-out visitor is sent to register, carrying the code', async ({ page }) => {
    /* No session on this context. `/h/[code]` sets the referral COOKIE first
       and then redirects — the cookie is what survives signup and browsing to
       reach the moment of purchase, and the query parameter is the separate
       account-level credit. Both are load-bearing: the version that only
       passed `?ref=` lost the promoter their share on every sale, because the
       parameter is long gone by the time a ticket is bought. */
    await page.goto('/h/0xe2ee2ee2ee2ee2ee2ee2ee2ee2ee2ee2');
    await expect(page).toHaveURL(/\/register\?ref=0xe2ee2ee2/, { timeout: 15_000 });

    const cookie = (await page.context().cookies()).find((row) => row.name === 'ihype_ref');
    expect(cookie?.value).toBe('0xe2ee2ee2ee2ee2ee2ee2ee2ee2ee2ee2');
    // httpOnly, deliberately: nothing in the browser reads it, and keeping it
    // out of document.cookie keeps it out of anything that scrapes the page.
    expect(cookie?.httpOnly).toBe(true);
  });

  test('a signed-in member is not shown a signup wall', async ({ context, page }) => {
    // The bug this guards: everyone was sent to /register, including members
    // who already had an account, who then landed on a signup page for it.
    await signIn(context, `e2e-hype-link-${RUN}@ihype.org`);
    await page.goto('/h/0xe2ee2ee2ee2ee2ee2ee2ee2ee2ee2ee2');
    await expect(page).toHaveURL(/\/app\/map/, { timeout: 15_000 });
    expect((await page.context().cookies()).find((row) => row.name === 'ihype_ref')?.value)
      .toBe('0xe2ee2ee2ee2ee2ee2ee2ee2ee2ee2ee2');
  });
});
