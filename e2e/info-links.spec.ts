import { expect, test } from '@playwright/test';

test('the charter privacy link opens and scrolls to the privacy policy', async ({ page }) => {
  await page.goto('/info?tab=charter');
  await page.getByRole('link', { name: 'Privacy Policy', exact: true }).click();
  await expect(page).toHaveURL(/\/info\?tab=privacy$/);
  await expect(page.getByRole('tab', { name: 'Terms and privacy' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#legal-privacy')).toBeInViewport();
  await page.goBack();
  await expect(page.getByRole('tab', { name: 'The Charter' })).toHaveAttribute('aria-selected', 'true');
});
