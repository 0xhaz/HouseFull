import { expect, test } from '@playwright/test';

test('tonight: gig guide, jazz clubs, taste picks, location stays local', async ({ browser }) => {
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
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Tonight in');

  // Walk-in spots: jazz clubs, pubs and bars with live music, from Qloo.
  const spots = page.getByRole('list', { name: 'Live-music spots' });
  await expect(spots.getByRole('listitem').first()).toBeVisible({ timeout: 60_000 });
  await page.getByRole('button', { name: 'Jazz & blues', exact: true }).click();
  await expect(spots).toContainText('Jazz & blues club');

  await page.getByRole('tab', { name: 'Next 7 days' }).click();
  const lineup = page.getByRole('heading', { name: 'The lineup' });
  await expect(lineup).toBeVisible();
  // Theatre and musicals are out.
  await expect(page.getByText(/musical/i)).toHaveCount(0);

  await page.getByLabel(/Artists you like/).fill('Clairo');
  await page
    .getByRole('list', { name: 'Matching artists' })
    .getByRole('button', { name: 'Clairo', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'Top picks for you' })).toBeVisible({
    timeout: 120_000,
  });
  await expect(
    page
      .getByRole('list', { name: 'Top picks' })
      .getByText(/Top match|You like them/)
      .first(),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Near me' }).click();
  await expect(page.getByRole('button', { name: 'Using your location' })).toBeVisible();
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
