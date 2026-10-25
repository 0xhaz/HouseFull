/**
 * Seeds the demo through the running API: one fresh run per preset, then a
 * clearly labelled SAMPLE check-in and a re-plan, so judges can see brief v1 → v2.
 *
 * Then plans the demo artist team's tour (the same act in more cities) inside its workspace,
 * and adds SAMPLE post-show survey answers for demo shows that have already happened.
 *
 *   pnpm seed:demo                     # against http://localhost:4100
 *   API=https://<cloud-run-url> pnpm seed:demo
 *   ONLY=tour pnpm seed:demo           # just the artist tour
 *   ONLY=survey pnpm seed:demo         # just the sample post-show surveys
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
  ONLY === 'tour' || ONLY === 'survey'
    ? []
    : await json<Array<{ id: string; label: string }>>('/shows/presets');
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

for (const show of ONLY === 'survey' ? [] : ARTIST_TOUR) {
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

// ─── Post-show survey: SAMPLE responses for the demo show that has already happened ───
type SurveyInfo = { surveyId: string; options: Array<{ entityId: string; name: string }> };

/**
 * Deterministic, clearly labelled sample answers. Each respondent ticks artists from one or
 * two of the survey's options (which is how they're attributed to an audience), or none.
 */
async function seedSurvey(runId: string) {
  const info = await json<SurveyInfo>(`/runs/${runId}/survey`);
  const before = await json<{ summary: { responses: number } | null }>(
    `/runs/${runId}/survey/results`,
  );
  if ((before.summary?.responses ?? 0) > 0) {
    console.log(`survey ${runId}: already has responses, skipped`);
    return;
  }
  const o = info.options.map((x) => x.entityId);
  // Options interleave audiences: o[0], o[3], o[6] belong to the first audience, and so on.
  const groups = [0, 1, 2].map((g) => o.filter((_, i) => i % 3 === g));
  const plan: Array<{ group: number; ratings: number[]; back: boolean[]; via: string[] }> = [
    {
      group: 0,
      ratings: [5, 5, 4, 5, 5, 4, 5, 4],
      back: [true, true, true, true, false, true, true, true],
      via: ['Instagram or Facebook ad', 'A friend', 'Instagram or Facebook ad', 'TikTok'],
    },
    {
      group: 1,
      ratings: [4, 4, 5, 3, 4, 4],
      back: [true, false, true, false, true, true],
      via: ['A podcast', 'Instagram or Facebook ad', 'A podcast'],
    },
    {
      group: 2,
      ratings: [4, 3, 4, 3, 4],
      back: [false, true, false, false, true],
      via: ['TikTok', 'A poster or flyer'],
    },
    {
      group: -1,
      ratings: [5, 4, 5, 5, 4],
      back: [true, true, true, true, true],
      via: ['I was already a fan'],
    },
  ];
  const tags = [
    'Great sound',
    'Great crowd',
    'Great venue',
    'Easy to get home',
    'Would bring friends',
  ];
  const comments = [
    'Sound was perfect from the balcony',
    'Found them through an ad, now a fan',
    'Long bar line but worth it',
  ];
  let n = 0;
  for (const p of plan)
    for (const [i, rating] of p.ratings.entries()) {
      const likes = p.group < 0 ? [] : (groups[p.group] ?? []).slice(0, 1 + (i % 2));
      await json(`/surveys/${info.surveyId}/responses`, {
        method: 'POST',
        body: JSON.stringify({
          rating,
          wouldReturn: p.back[i],
          heardVia: p.via[i % p.via.length],
          alsoLikes: likes,
          tags: tags.filter((_, t) => (i + t) % 3 === 0).slice(0, 2),
          comment: n % 7 === 0 ? comments[(n / 7) % comments.length] : undefined,
          sample: true,
        }),
      });
      n++;
    }
  console.log(`survey ${runId}: ${n} sample responses`);
}

if (!ONLY || ONLY === 'survey') {
  const venue = await json<{ runs: Array<{ id: string; status: string; show: { date: string } }> }>(
    '/workspaces/demo-venue',
  );
  const today = new Date().toISOString().slice(0, 10);
  for (const r of venue.runs.filter((x) => x.status === 'done' && x.show.date < today))
    await seedSurvey(r.id);
}
