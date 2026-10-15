import { expect, test } from '@playwright/test';

test('outreach: contacts from briefs, a grounded draft, status kept', async ({ page }) => {
  await page.goto('/w/demo-promoter');
  await page.getByRole('link', { name: 'Outreach' }).click();
  const contacts = page.getByRole('list', { name: 'Contacts' });
  await expect(contacts.getByRole('listitem').first()).toBeVisible({ timeout: 60_000 });
  // Places come with real contact details from Qloo.
  await expect(contacts.locator('a[href^="tel:"]').first()).toBeVisible();

  await page.getByRole('tab', { name: /Places nearby/ }).click();
  const first = contacts.getByRole('listitem').first();
  const name = (await first.locator('p').first().textContent())?.trim() ?? '';
  await first.getByRole('button', { name: 'Write email' }).click();
  await page.getByRole('button', { name: 'Draft the email' }).click();
  const body = page.getByLabel('Message');
  await expect(body).not.toHaveValue('', { timeout: 60_000 });
  const text = await body.inputValue();
  expect(text).toContain('[Your name]');
  // Never leaks sales numbers to outside contacts.
  expect(text).not.toMatch(/\d+\s?%|sold/i);
  await expect(page.getByRole('link', { name: 'Open in email app' })).toHaveAttribute(
    'href',
    /^mailto:\?subject=/,
  );

  await page.getByRole('button', { name: 'Mark as contacted' }).click();
  await expect(page.getByLabel(`Status for ${name}`)).toHaveValue('contacted');
  await page.reload();
  await expect(page.getByLabel(`Status for ${name}`)).toHaveValue('contacted', { timeout: 60_000 });
});
