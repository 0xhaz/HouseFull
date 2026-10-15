import { expect, type Page, test } from '@playwright/test';

const API = 'http://localhost:4100';

async function presetRun(page: Page, city: 'nyc' | 'nola' | 'la') {
  await page.goto(`/?city=${city}`);
  await page.getByRole('button', { name: 'Plan campaign' }).click();
  await expect(page).toHaveURL(/\/runs\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('link', { name: 'Open the campaign brief' })).toBeVisible({
    timeout: 120_000,
  });
  return page.url().split('/runs/')[1] as string;
}

test.describe.configure({ mode: 'serial' });

test('presets replay instantly in all three cities', async ({ page }) => {
  for (const city of ['nyc', 'nola', 'la'] as const) {
    const t = Date.now();
    await presetRun(page, city);
    expect(Date.now() - t, `${city} preset should replay fast`).toBeLessThan(15_000);
  }
});

test('NYC brief: every tab, versions, exports, compare, print', async ({ page, request }) => {
  const runId = await presetRun(page, 'nyc');
  await page.getByRole('link', { name: 'Open the campaign brief' }).click();
  await expect(page.getByText('Venue fit', { exact: false }).first()).toBeVisible();
  await expect(page.getByText(/claims, each linked to a Qloo call/).first()).toBeVisible();

  // Audiences: segments + map + ad variants
  const segs = page.getByRole('tablist', { name: 'Audience segments' }).getByRole('tab');
  expect(await segs.count()).toBeGreaterThanOrEqual(2);
  await expect(page.locator('.maplibregl-canvas').first()).toBeVisible();
  await expect(page.getByText('Ad variant A', { exact: true }).first()).toBeVisible();

  await page.getByRole('tab', { name: 'Openers & partners' }).click();
  await expect(
    page.getByText('Opening acts that bring new fans', { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText('Make it a night', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Street team', { exact: true }).first()).toBeVisible();

  await page.getByRole('tab', { name: 'Schedule' }).click();
  await expect(page.getByText('Countdown', { exact: true }).first()).toBeVisible();

  await page.getByRole('tab', { name: 'Show night' }).click();
  await expect(page.getByText('Getting home', { exact: true }).first()).toBeVisible();
  await expect(
    page.getByText('Promoter only: venue context', { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText(/Not a safety guarantee/).first()).toBeVisible();
  await expect(page.getByText('Show-night disruptions', { exact: true }).first()).toBeVisible();

  await page.getByRole('tab', { name: 'Results' }).click();
  await expect(page.getByText('Includes sample data', { exact: true }).first()).toBeVisible();

  // Versions: v2 shows what changed; v1 doesn't
  await expect(page.getByText(/What changed in version 2/)).toBeVisible();
  await page.goto(`/runs/${runId}/brief?v=1`);
  await expect(page.getByText(/What changed in version/)).toHaveCount(0);

  // Downloads
  const csv = await request.get(`${API}/runs/${runId}/export/ads?platform=meta`);
  expect(csv.ok()).toBe(true);
  expect(await csv.text()).toMatch(/hf-s1-/);
  const gpx = await request.get(`${API}/runs/${runId}/street-team.gpx`);
  expect(gpx.ok()).toBe(true);
  expect(await gpx.text()).toContain('<gpx');

  await page.goto(`/runs/${runId}/compare`);
  await expect(page.getByRole('heading', { name: 'With and without Qloo' })).toBeVisible();
  await expect(page.getByText('no sources')).toBeVisible();

  await page.goto(`/runs/${runId}/print`);
  await expect(page.getByRole('button', { name: 'Save as PDF' })).toBeVisible();
});

test('plan a new show from Ticketmaster, then check in a Meta CSV and re-plan', async ({
  page,
  request,
}) => {
  await page.goto('/?city=nyc');
  await page.getByLabel('Find it on Ticketmaster').fill('Mercury Lounge');
  const first = page.getByRole('list', { name: 'Matching shows' }).getByRole('button').first();
  await first.waitFor({ timeout: 20_000 });
  await first.click();
  await expect(page.getByLabel('Artist')).not.toHaveValue('');
  await page.getByRole('button', { name: 'Plan this show' }).click();
  await expect(page).toHaveURL(/\/runs\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('link', { name: 'Open the campaign brief' })).toBeVisible({
    timeout: 200_000,
  });
  const runId = page.url().split('/runs/')[1] as string;

  const run = await (await request.get(`${API}/runs/${runId}`)).json();
  expect(run.status).toBe('done');
  // The critic may flag notes on a fresh show; it must have run and the brief must be complete.
  expect(run.result.critic.rounds).toBeGreaterThanOrEqual(1);
  expect(run.result.segments.length).toBeGreaterThanOrEqual(2);
  if (!run.result.critic.passed) console.log('critic notes:', run.result.critic.notes);
  const ids: string[] = run.result.segments.map((s: { id: string }) => s.id);

  const rows = ['Ad set name,Amount spent (USD),Link clicks,Purchases'];
  for (const [i, id] of ids.entries())
    rows.push(`hf-${id}-test-meta,${100 + i * 10},${300 - i * 80},${i === 0 ? 6 : 1}`);
  const up = await request.post(`${API}/runs/${runId}/checkins`, {
    data: { csv: rows.join('\n') },
  });
  expect(up.ok(), await up.text()).toBe(true);
  expect((await up.json()).scoreboard.ready).toBe(true);

  await page.goto(`/runs/${runId}/brief`);
  await page.getByRole('tab', { name: 'Results' }).click();
  await page.getByRole('button', { name: 'Re-plan from results' }).click();
  await expect(page).toHaveURL(/\?v=2/, { timeout: 120_000 });
  await expect(page.getByText(/What changed in version 2/)).toBeVisible();
});

test('MCP server lists tools and answers', async ({ request }) => {
  const headers = {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
  };
  const init = await request.post(`${API}/mcp`, {
    headers,
    data: {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'local-test', version: '1' },
      },
    },
  });
  expect(init.ok()).toBe(true);
  const list = await request.post(`${API}/mcp`, {
    headers,
    data: { jsonrpc: '2.0', id: 2, method: 'tools/list' },
  });
  const names = (await list.json()).result.tools.map((t: { name: string }) => t.name);
  expect(names).toEqual(
    expect.arrayContaining(['plan_campaign', 'next_ring_audiences', 'campaign_checkin']),
  );
  const call = await request.post(`${API}/mcp`, {
    headers,
    data: {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'resolve_artist', arguments: { name: 'Khruangbin' } },
    },
  });
  expect(JSON.stringify(await call.json())).toContain('Khruangbin');
});

test('mobile and dark mode', async ({ browser }) => {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    colorScheme: 'dark',
  });
  const page = await ctx.newPage();
  const runId = await presetRun(page, 'nyc');
  await page.goto(`/runs/${runId}/brief`);
  await expect(page.locator('html')).toHaveClass(/dark/);
  for (const tab of ['New audiences', 'Openers & partners', 'Show night']) {
    await page.getByRole('tab', { name: tab }).click();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow, `${tab} overflows on mobile`).toBeLessThanOrEqual(0);
  }
  await ctx.close();
});
