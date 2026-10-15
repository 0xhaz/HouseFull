import { clerk, setupClerkTestingToken } from '@clerk/testing/playwright';
import { expect, test } from '@playwright/test';

const API = 'http://localhost:4100';
/** Created once on the dev instance (`+clerk_test` addresses need no real inbox). */
const TEST_USER = 'housefull-e2e+clerk_test@example.com';

test.describe.configure({ mode: 'serial' });

test('demo workspaces open without signing in, one per persona', async ({ page }) => {
  await page.goto('/');
  const cards = page.locator('#demo-workspaces').getByRole('link');
  await expect(cards).toHaveCount(3);
  await cards.filter({ hasText: 'Venue' }).click();
  await expect(page).toHaveURL(/\/w\/demo-venue$/);
  await expect(page.getByText('Who your room draws', { exact: true })).toBeVisible();
  await page.goto('/w/demo-artist');
  await expect(page.getByText('New fans, city by city', { exact: true })).toBeVisible();
  await expect(page.getByText('Taste threads', { exact: true })).toBeVisible();
  await page.goto('/w/demo-promoter');
  await expect(page.getByText('Your shows', { exact: true })).toBeVisible();
});

test('sign in, set up a venue workspace, plan a show into it', async ({ page, request }) => {
  await setupClerkTestingToken({ page });
  await page.goto('/');
  await clerk.signIn({ page, emailAddress: TEST_USER });

  await page.goto('/onboarding');
  const name = `E2E Room ${Date.now().toString(36)}`;
  await page.getByLabel('Company or team name').fill(name);
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await expect(page.getByText(`Who is ${name} for?`)).toBeVisible({ timeout: 20_000 });
  const orgId = await page.evaluate(
    () =>
      (window as unknown as { Clerk: { organization?: { id: string } } }).Clerk.organization?.id,
  );

  try {
    await page.getByText('Venue', { exact: true }).click();
    await page.getByLabel('Your venue').fill('Mercury Lounge');
    await page.getByRole('list', { name: 'Matching venues' }).getByRole('button').first().click();
    await page.getByRole('button', { name: 'Open the dashboard' }).click();
    await expect(page).toHaveURL(/\/w\/[a-z0-9-]+$/, { timeout: 20_000 });
    const slug = page.url().split('/w/')[1] as string;
    await expect(page.getByRole('heading', { name })).toBeVisible();
    await expect(page.getByText('Planned shows', { exact: true }).first()).toBeVisible();

    // Private to the organization: the API refuses anonymous reads.
    expect((await request.get(`${API}/workspaces/${slug}`)).status()).toBe(401);

    // Plan a show: the venue is prefilled from the workspace.
    await page.goto(`/w/${slug}/new?city=nyc`);
    await expect(page.getByLabel('Venue')).toHaveValue(/Mercury Lounge/i);
    await page.getByLabel('Artist').fill('Men I Trust');
    await page.getByLabel('Show date').fill('2026-12-12');
    await page.getByRole('button', { name: 'Plan this show' }).click();
    await expect(page).toHaveURL(/\/runs\/[0-9a-f-]{36}$/);

    // Let the run finish so its brief feeds the dashboard and outreach.
    await expect(page.getByRole('link', { name: 'Open the campaign brief' })).toBeVisible({
      timeout: 200_000,
    });

    await page.goto(`/w/${slug}`);
    await expect(page.getByText('Men I Trust').first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open brief' })).toHaveCount(1);

    // Outreach status is saved for the organization (not just this browser).
    await page.goto(`/w/${slug}/outreach`);
    const status = page.getByRole('list', { name: 'Contacts' }).getByRole('combobox').first();
    await expect(status).toBeVisible({ timeout: 60_000 });
    await status.selectOption('replied');
    await page.waitForTimeout(500);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await expect(
      page.getByRole('list', { name: 'Contacts' }).getByRole('combobox').first(),
    ).toHaveValue('replied', { timeout: 60_000 });
  } finally {
    // Leave the database and the dev instance clean: workspace (with its runs), then the org.
    await page.waitForFunction(
      () => (window as unknown as { Clerk?: { loaded?: boolean } }).Clerk?.loaded,
    );
    const token = await page.evaluate(() =>
      (
        window as unknown as { Clerk: { session?: { getToken(): Promise<string | null> } } }
      ).Clerk.session?.getToken(),
    );
    const del = token
      ? await request
          .delete(`${API}/workspaces/current`, { headers: { authorization: `Bearer ${token}` } })
          .catch(() => undefined)
      : undefined;
    if (orgId)
      await fetch(`https://api.clerk.com/v1/organizations/${orgId}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` },
      });
    expect(del?.ok(), 'workspace cleanup').toBe(true);
  }
});
