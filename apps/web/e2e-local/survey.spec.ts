import { expect, type Locator, type Page, test } from '@playwright/test';

const API = 'http://localhost:4100';

/** Stars are native radios inside labels: click the star like a person would. */
function starLabel(scope: Page | Locator, n: number) {
  // `has` is matched inside each label, so build it from the page, not the scope.
  const page = 'goto' in scope ? scope : scope.page();
  const radio = page.getByRole('radio', { name: `${n} star${n > 1 ? 's' : ''}`, exact: true });
  return scope.locator('label').filter({ has: radio });
}

/** The demo show that has already happened (seeded with SAMPLE survey answers). */
async function playedShow(request: import('@playwright/test').APIRequestContext) {
  const ws = await (await request.get(`${API}/workspaces/demo-venue`)).json();
  const today = new Date().toISOString().slice(0, 10);
  const run = ws.runs.find((r: { show: { date: string } }) => r.show.date < today);
  expect(run, 'a played demo show').toBeTruthy();
  return run.id as string;
}

test('post-show survey: attendees answer anonymously', async ({ page, request }) => {
  const runId = await playedShow(request);
  let posted: Record<string, unknown> | undefined;
  // Don't add test answers to the demo data: capture the request instead.
  await page.route(`${API}/surveys/*/responses`, async (route) => {
    posted = route.request().postDataJSON();
    await route.fulfill({ json: { ok: true } });
  });
  await page.goto(`/s/${runId}`);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('How was');
  const send = page.getByRole('button', { name: 'Send' });
  await expect(send).toBeDisabled();
  await starLabel(page, 5).click();
  await page.getByRole('button', { name: 'Yes', exact: true }).click();
  const artists = page.locator('fieldset').nth(2).getByRole('button');
  await artists.first().click();
  await page.getByRole('button', { name: 'A friend' }).click();
  await page.getByRole('button', { name: 'Great sound' }).click();
  await send.click();
  await expect(page.getByRole('heading', { name: 'Thanks for coming!' })).toBeVisible();
  expect(posted).toMatchObject({
    rating: 5,
    wouldReturn: true,
    heardVia: 'A friend',
    tags: ['Great sound'],
  });
  expect(posted?.alsoLikes).toHaveLength(1);
});

test('results tab: what attendees said, per audience', async ({ page, request }) => {
  const runId = await playedShow(request);
  await page.goto(`/runs/${runId}/brief`);
  await page.getByRole('tab', { name: 'Results' }).click();
  await expect(page.getByText('After the show: what attendees said')).toBeVisible();
  await expect(page.getByRole('img', { name: 'QR code for the survey link' })).toBeVisible();
  await expect(page.getByText('By audience')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Core fans/)).toBeVisible();
  await expect(page.getByText('Includes sample data').last()).toBeVisible();
});

test('tonight diary: going, then rating a show that happened', async ({ page }) => {
  await page.goto('/tonight?city=nyc');
  await page.getByRole('tab', { name: 'Next 7 days' }).click();
  const going = page.getByRole('button', { name: 'I’m going' }).first();
  await expect(going).toBeVisible({ timeout: 60_000 });
  await going.click();
  await expect(page.getByRole('list', { name: 'Shows you’re going to' })).toBeVisible();

  // A show from last week, saved on this device.
  await page.evaluate(() =>
    localStorage.setItem(
      'housefull:nights',
      JSON.stringify([
        {
          eventId: 'past-1',
          artist: 'Clairo',
          venue: 'Brooklyn Steel',
          date: '2026-10-10',
          startsAt: '2026-10-11T00:00:00Z',
        },
      ]),
    ),
  );
  await page.reload();
  await page.getByRole('button', { name: 'Rate it' }).click();
  const dialog = page.getByRole('dialog');
  await starLabel(dialog, 5).click();
  await dialog.getByRole('button', { name: 'Would go again' }).click();
  await dialog.getByRole('button', { name: 'Save rating' }).click();
  const rated = page.getByRole('list', { name: 'Shows you rated' });
  await expect(rated).toContainText('Clairo');
  // Loved it: the artist now shapes picks.
  await expect(page.getByText(/Also using 1 show you loved: Clairo/)).toBeVisible({
    timeout: 30_000,
  });
});
