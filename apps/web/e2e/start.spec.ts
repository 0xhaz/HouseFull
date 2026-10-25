import { expect, type Page, test } from '@playwright/test';

/** The demo-shows section; the hero's live brief can mention the same artists. */
const shows = (page: Page) => page.locator('#try-a-show');

test('start page lists the NYC preset and shows the map', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /fans you don.t have yet/i })).toBeVisible();
  await expect(shows(page).getByText('Men I Trust')).toBeVisible();
  await expect(page.locator('.maplibregl-canvas')).toBeVisible();
});

test('city switcher filters presets and keeps the city in the URL', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('combobox', { name: 'City' }).click();
  await page.getByRole('option', { name: 'New Orleans' }).click();
  await expect(page).toHaveURL(/city=nola/);
  await expect(shows(page).getByText('Hiatus Kaiyote')).toBeVisible();
  await expect(shows(page).getByText('Men I Trust')).toBeHidden();
});

test('theme toggle switches to dark', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await page.getByRole('button', { name: /toggle light and dark/i }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
});

test('mobile has no horizontal scroll', async ({ page }) => {
  await page.goto('/?city=la');
  await expect(shows(page).getByText('Mdou Moctar')).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
