import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { applySessionCookie, canSeedSession, databaseUrl } from './fixtures/session';

/**
 * End-to-end contract for the actual website-builder navigation, publishing,
 * and privacy boundaries. Uses the Workerd scratch DB and an Auth.js session,
 * NEVER real Mux credentials or chargeable video assets.
 */
const RUN = Date.now().toString(36);
test.skip(!canSeedSession(), 'Site builder requires scratch Postgres and workerd Auth.js');

async function setProfileFields(
  profileId: string,
  fields: { contactInfo?: string; discoverable?: boolean },
) {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl() }),
  });
  try {
    await prisma.profile.update({ where: { id: profileId }, data: fields });
  } finally {
    await prisma.$disconnect();
  }
}

async function signedIn(
  context: import('@playwright/test').BrowserContext,
  name: string,
  type: 'ARTIST' | 'VENUE',
  verified: boolean,
) {
  const seeded = await applySessionCookie(context,
    `e2e-microsite-${name}-${RUN}@example.test`, {
      profiles: [{ type, verified, name: `${name} profile` }],
    });
  await context.addInitScript(() => {
    try { localStorage.setItem('ihype_cookie_consent', 'accepted'); } catch { /* fine */ }
  });
  return seeded.profiles[0];
}

test.describe('One-page site navigation and privacy', () => {
  test('anonymous visitors cannot read a site draft, library or change video settings', async ({ request }) => {
    expect((await request.get('/api/site-builder?profileId=missing')).status()).toBe(401);
    expect((await request.get('/api/site-videos?profileId=missing')).status()).toBe(401);
    expect((await request.patch('/api/site-builder', { data: {} })).status()).toBe(401);
    expect((await request.delete('/api/site-videos/not-mine')).status()).toBe(401);
  });

  test('verified artist navigates from My Page to editor, previews, publishes and returns', async ({ page, context }) => {
    const artist = await signedIn(context, 'artist-owner', 'ARTIST', true);
    const privateEmail = `private-booking-${RUN}@example.test`;
    await setProfileFields(artist.id, { contactInfo: privateEmail });

    await page.goto(`/app/me/profiles?tab=mypage&profile=${artist.id}`);
    const siteLink = page.locator(`a[href="/app/me/sites/${artist.id}"]:visible`);
    await expect(siteLink).toHaveCount(1, { timeout: 20_000 });
    await expect(siteLink).toBeVisible();
    await siteLink.click();
    await expect(page).toHaveURL(new RegExp(`/app/me/sites/${artist.id}$`));
    await expect(page.getByRole('heading', { name: /Website \+ Video/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Back to profiles/i })).toBeVisible();
    // The workspace backstop must not add a conflicting second back link.
    await expect(page.locator('.mmm-me-route-back')).toHaveCount(0);
    await expect(page.getByRole('checkbox', { name: /Contact details/i })).not.toBeChecked();

    await page.getByRole('button', { name: 'Paper', exact: true }).click();
    await page.getByLabel('Headline or tagline').fill('A new sound. Every night.');
    await page.getByRole('button', { name: /Save draft \/ Unpublish/i }).click();
    await expect(page.locator('.ih-builder-success')).toContainText(/draft saved/i);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Paper', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByLabel('Headline or tagline')).toHaveValue('A new sound. Every night.');

    await page.getByRole('button', { name: /Publish website/i }).click();
    await expect(page.locator(`.ih-builder-live a[href="/site/${artist.slug}"]:visible`)).toBeVisible();
    await page.goto(`/site/${artist.slug}`);
    await expect(page.locator('.ih-site h1:visible')).toHaveText(artist.name);
    await expect(page.locator('.ih-site')).toContainText('A new sound. Every night.');
    await expect(page.locator('#contact')).toHaveCount(0);
    await expect(page.locator('.ih-site')).not.toContainText(privateEmail);

    const axe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(axe.violations.filter(v => v.impact === 'serious' || v.impact === 'critical')
      .map(v => v.id)).toEqual([]);

    await page.goto(`/app/me/sites/${artist.id}`);
    await page.getByRole('checkbox', { name: /Contact details/i }).check();
    await page.getByRole('button', { name: /Save & keep published/i }).click();
    await page.goto(`/site/${artist.slug}`);
    await expect(page.locator('#contact')).toContainText(privateEmail);
    await page.goto(`/app/me/sites/${artist.id}`);
    await page.getByRole('button', { name: /Save draft \/ Unpublish/i }).click();
    await page.goto(`/site/${artist.slug}`);
    await expect(page.locator('.ih-site')).toHaveCount(0);

    await page.goto(`/app/me/sites/${artist.id}`);
    await page.getByRole('link', { name: /Back to profiles/i }).click();
    await expect(page).toHaveURL(/\/app\/me\/profiles/);
  });

  test('unverified venue can save a draft but cannot publish; another owner cannot edit', async ({ browser }) => {
    const venueContext = await browser.newContext();
    const visitorContext = await browser.newContext();
    try {
      const venue = await signedIn(venueContext, 'venue-pending', 'VENUE', false);
      await applySessionCookie(visitorContext, `e2e-microsite-visitor-${RUN}@example.test`);
      const page = await venueContext.newPage();
      await page.goto(`/app/me/sites/${venue.id}`);
      await expect(page.getByRole('heading', { name: /Website \+ Video/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /Publish website/i })).toBeDisabled();
      await page.getByRole('button', { name: /Save draft \/ Unpublish/i }).click();
      await expect(page.locator('.ih-builder-success')).toContainText(/draft saved/i);

      const visitorRead = await visitorContext.request.get(`/api/site-builder?profileId=${venue.id}`);
      expect(visitorRead.status()).toBe(403);
      const visitorVideos = await visitorContext.request.get(`/api/site-videos?profileId=${venue.id}`);
      expect(visitorVideos.status()).toBe(404);
      // Next.js may stream a not-found page with a 200 HTTP status. The
      // security assertion must inspect the rendered surface, not status alone.
      const visitorPage = await visitorContext.newPage();
      await visitorPage.goto(`/app/me/sites/${venue.id}`);
      await expect(visitorPage.locator('.ih-builder-editor')).toHaveCount(0);
      await visitorPage.close();
      const visitorWrite = await visitorContext.request.patch('/api/site-builder', {
        data: {
          profileId: venue.id,
          site: {
            published: true, theme: 'spotlight', tagline: 'Hacked',
            sections: { about: true, shows: true, music: false, videos: false, merch: false, contact: true },
          },
        },
      });
      expect(visitorWrite.status()).toBe(403);
      const unverifiedPublicPage = await venueContext.newPage();
      await unverifiedPublicPage.goto(`/site/${venue.slug}`);
      await expect(unverifiedPublicPage.locator('.ih-site')).toHaveCount(0);
      await unverifiedPublicPage.close();
    } finally {
      await venueContext.close();
      await visitorContext.close();
    }
  });

  test('hiding a previously published profile immediately hides its site', async ({ context, page }) => {
    const artist = await signedIn(context, 'private-artist', 'ARTIST', true);
    await page.goto(`/app/me/sites/${artist.id}`);
    await expect(page.getByRole('button', { name: /Publish website/i })).toBeEnabled();
    await page.getByRole('button', { name: /Publish website/i }).click();
    await page.goto(`/site/${artist.slug}`);
    await expect(page.locator('.ih-site h1:visible')).toContainText(artist.name);
    await setProfileFields(artist.id, { discoverable: false });
    await page.reload();
    await expect(page.locator('.ih-site')).toHaveCount(0);
    await page.goto(`/app/me/sites/${artist.id}`);
    await expect(page.getByRole('button', { name: /Save & keep published/i })).toBeDisabled();
    await expect(page.locator('.ih-builder-note').filter({ hasText: /hidden from public discovery/i })).toBeVisible();
  });

  test('phone viewport keeps Website + video discoverable and actions on-screen', async ({ context, page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const venue = await signedIn(context, 'venue-mobile', 'VENUE', true);
    await page.goto(`/app/me/profiles?tab=mypage&profile=${venue.id}`);
    const link = page.locator(`a[href="/app/me/sites/${venue.id}"]:visible`);
    await expect(link).toBeVisible({ timeout: 20_000 });
    const bounds = await link.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(377);
    await link.click();
    await expect(page.getByRole('button', { name: /Publish website/i })).toBeVisible();
    const overflowing = await page.locator('.ih-builder').evaluate(element =>
      element.getBoundingClientRect().right > window.innerWidth + 2);
    expect(overflowing).toBe(false);
  });
});
