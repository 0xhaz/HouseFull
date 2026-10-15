/**
 * Seeds the demo through the running API: one fresh run per preset, then a
 * clearly labelled SAMPLE check-in and a re-plan, so judges can see brief v1 → v2.
 *
 * Then plans the demo artist team's tour (the same act in more cities) inside its workspace.
 *
 *   pnpm seed:demo                     # against http://localhost:4100
 *   API=https://<cloud-run-url> pnpm seed:demo
 *   ONLY=tour pnpm seed:demo           # just the artist tour
 */
const API = process.env.API || process.env.API_PUBLIC_URL || 'http://localhost:4100';

type Brief = { segments: Array<{ id: string; name: string }> };

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(new URL(path, API), {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  });
  if (!res.ok)
    throw new Error(`${init?.method ?? 'GET'} ${path}: ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

/** Opening the stream is what runs the agent; read it to the end. */
async function runToCompletion(runId: string) {
  const res = await fetch(new URL(`/runs/${runId}/stream`, API));
  if (!res.body) throw new Error('No stream body');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    if (buf.includes('"type":"done"')) break;
  }
  await reader.cancel();
}

/** Deterministic sample results: the first segment wins, the last trails. Labelled `sample` everywhere. */
function sampleResults(brief: Brief) {
  return brief.segments.map((s, i, all) => ({
    segmentId: s.id,
    clicks: 400 - i * 130,
    sales: i === 0 ? 7 : i === all.length - 1 ? 0 : 2,
    spendUsd: 140 - i * 15,
  }));
}

const ONLY = process.env.ONLY;

/** The demo artist team's other dates: same act, different cities (demo-artist workspace). */
const ARTIST_TOUR = [
  {
    artist: 'Men I Trust',
    venue: { name: "Tipitina's", lat: 29.9177, lng: -90.1046, capacity: 1000 },
    city: 'nola',
    date: '2026-11-24',
    soldPct: 41,
    budgetUsd: 2000,
  },
  {
    artist: 'Men I Trust',
    venue: { name: 'Lodge Room', lat: 34.1113, lng: -118.1918, capacity: 500 },
    city: 'la',
    date: '2026-11-27',
    soldPct: 58,
    budgetUsd: 1500,
  },
];

const presets =
  ONLY === 'tour' ? [] : await json<Array<{ id: string; label: string }>>('/shows/presets');
for (const p of presets) {
  const started = Date.now();
  const { runId } = await json<{ runId: string }>('/runs', {
    method: 'POST',
    body: JSON.stringify({ presetId: p.id, fresh: true }),
  });
  await runToCompletion(runId);
  const run = await json<{ status: string; result: Brief }>(`/runs/${runId}`);
  if (run.status !== 'done') {
    console.log(`${p.id}: run ${runId} ended ${run.status}; skipping the check-in`);
    continue;
  }
  await json(`/runs/${runId}/checkins`, {
    method: 'POST',
    body: JSON.stringify({ source: 'sample', bySegment: sampleResults(run.result) }),
  });
  const re = await json<{ version: number; result: { summary: string } }>(`/runs/${runId}/replan`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  console.log(
    `${p.id}: ${runId} v${re.version} in ${Math.round((Date.now() - started) / 1000)}s · ${re.result.summary}`,
  );
}

for (const show of ARTIST_TOUR) {
  const started = Date.now();
  const { runId } = await json<{ runId: string }>('/runs', {
    method: 'POST',
    body: JSON.stringify({ show, workspace: 'demo-artist' }),
  });
  await runToCompletion(runId);
  const run = await json<{ status: string }>(`/runs/${runId}`);
  console.log(
    `tour ${show.city}: ${runId} ${run.status} in ${Math.round((Date.now() - started) / 1000)}s`,
  );
}
