import { expect, test } from '@playwright/test';

test('landing: flow diagram steps and persona previews are live', async ({ page }) => {
  await page.goto('/');
  const steps = page.getByRole('list', { name: 'How HouseFull works' }).getByRole('button');
  await expect(steps).toHaveCount(6);

  // The next ring: live audiences from the demo brief.
  await steps.nth(1).click();
  await expect(page.getByText('Step 2 of 6')).toBeVisible();
  await expect(page.getByRole('img', { name: /next ring of fans around/ })).toBeVisible();

  // Results and re-plan come from the demo brief's check-in and version 2.
  await steps.nth(4).click();
  await expect(page.getByText(/Cost per sale by audience/)).toBeVisible();
  await steps.nth(5).click();
  await expect(page.getByText(/what changed, and why/)).toBeVisible();

  // Persona tabs swap the preview.
  await page.getByRole('tab', { name: 'Venues' }).click();
  await expect(page.getByRole('tabpanel')).toContainText('Who your room draws');
  await page.getByRole('tab', { name: 'Artist teams' }).click();
  await expect(page.getByRole('tabpanel')).toContainText('New York');
  await page.getByRole('tab', { name: 'Fans' }).click();
  await page
    .getByRole('tabpanel')
    .getByRole('link', { name: /See what.s on tonight/ })
    .click();
  await expect(page).toHaveURL(/\/tonight/);
});
