import { expect, test } from '@playwright/test';

test('tonight: live listings, taste matching, location stays local', async ({ browser }) => {
  const ctx = await browser.newContext({
    geolocation: { latitude: 40.7223, longitude: -73.9874 },
    permissions: ['geolocation'],
  });
  const page = await ctx.newPage();
  const sent: string[] = [];
  page.on('request', (r) => sent.push(r.url()));

  await page.goto('/');
  await page.getByRole('link', { name: /See what.s on tonight/ }).click();
  await expect(page).toHaveURL(/\/tonight/);
  await page.getByRole('tab', { name: 'Next 7 days' }).click();
  const shows = page.getByRole('list', { name: 'Shows' });
  await expect(shows.getByRole('listitem').first()).toBeVisible({ timeout: 60_000 });

  await page.getByLabel(/Artists you like/).fill('Clairo');
  await page
    .getByRole('list', { name: 'Matching artists' })
    .getByRole('button', { name: 'Clairo', exact: true })
    .click();
  await expect(page.getByRole('button', { name: 'Best match' })).toBeVisible({ timeout: 120_000 });
  await expect(
    shows.getByText(/Top match for your taste|An artist you like/).first(),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Use my location' }).click();
  await expect(shows.getByText(/(m|km) away/).first()).toBeVisible();
  // Coordinates never leave the browser.
  expect(sent.some((u) => u.includes('40.722') || u.includes('-73.987'))).toBe(false);

  // Likes are remembered on this device.
  await page.reload();
  await expect(page.getByRole('list', { name: 'Artists you like' })).toContainText('Clairo');
  await ctx.close();
});

test('ask your workspace answers with sources', async ({ page }) => {
  await page.goto('/w/demo-promoter');
  await page.getByRole('button', { name: 'Which show needs the most help this week?' }).click();
  await expect(page.getByRole('list', { name: 'Sources' })).toBeVisible({ timeout: 90_000 });
  await page.getByRole('list', { name: 'Sources' }).getByRole('link').first().click();
  await expect(page).toHaveURL(/\/runs\/[0-9a-f-]{36}\/brief$/);
});
