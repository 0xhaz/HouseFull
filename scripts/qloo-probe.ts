/**
 * Day-1 Qloo probe (docs/workplan.md Phase 0).
 *
 *   pnpm probe:qloo                # reads QLOO_API_URL / QLOO_API_KEY from .env.local
 *   pnpm probe:qloo --artist "Khruangbin"
 *
 * Writes raw responses to data/fixtures/probe/ (gitignored: Qloo terms forbid storing
 * response data in a public repo) and a metadata-only report to docs/qloo-probe.md.
 * Qloo silently ignores invalid parameters, so each check compares a call with and
 * without the parameter under test.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

const { values: args } = parseArgs({
  options: {
    artist: { type: 'string', default: 'Khruangbin' },
    venue: { type: 'string', default: 'POINT(-73.9389 40.7193)' }, // Brooklyn Steel (lng lat)
  },
});

const BASE = process.env.QLOO_API_URL ?? 'https://hackathon.api.qloo.com';
const KEY = process.env.QLOO_API_KEY;
if (!KEY) {
  console.error('QLOO_API_KEY is not set. Put it in .env.local (gitignored) and run again.');
  process.exit(1);
}

const ROOT = join(import.meta.dirname, '..');
const RAW_DIR = join(ROOT, 'data/fixtures/probe');
mkdirSync(RAW_DIR, { recursive: true });

// NYC five-borough bounding polygon (rough), WKT lng-lat order.
const NYC_POLYGON = 'POLYGON((-74.26 40.49,-73.69 40.49,-73.69 40.92,-74.26 40.92,-74.26 40.49))';

type Params = Record<string, string | number | boolean>;
type CallResult = {
  name: string;
  path: string;
  params: Params;
  status: number;
  ms: number;
  count: number;
  digest: string;
  body: unknown;
  error?: string;
};

const results: CallResult[] = [];

async function call(name: string, path: string, params: Params): Promise<CallResult> {
  const url = new URL(path, BASE);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const started = performance.now();
  let status = 0;
  let body: unknown = null;
  let error: string | undefined;
  try {
    const res = await fetch(url, { headers: { 'X-Api-Key': KEY as string } });
    status = res.status;
    const text = await res.text();
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    if (!res.ok)
      error = typeof body === 'string' ? body.slice(0, 200) : JSON.stringify(body).slice(0, 200);
  } catch (e) {
    error = (e as Error).message;
  }
  const ms = Math.round(performance.now() - started);
  const items = findResultArray(body);
  const result: CallResult = {
    name,
    path,
    params,
    status,
    ms,
    count: items.length,
    digest: createHash('sha256')
      .update(JSON.stringify(items.map(idOf)))
      .digest('hex')
      .slice(0, 12),
    body,
    error,
  };
  results.push(result);
  writeFileSync(
    join(RAW_DIR, `${name}.json`),
    JSON.stringify({ path, params, status, body }, null, 2),
  );
  console.log(
    `${status} ${String(ms).padStart(5)}ms  n=${String(result.count).padStart(3)}  ${name}${error ? `  !! ${error}` : ''}`,
  );
  return result;
}

/** Response shapes vary by filter.type; find the main list without assuming one shape. */
function findResultArray(body: unknown): Record<string, unknown>[] {
  if (!body || typeof body !== 'object') return [];
  const b = body as Record<string, unknown>;
  const r = (b.results ?? b) as Record<string, unknown>;
  for (const key of ['entities', 'heatmap', 'tags', 'demographics', 'audiences', 'results']) {
    const v = (r as Record<string, unknown>)[key];
    if (Array.isArray(v)) return v as Record<string, unknown>[];
  }
  if (Array.isArray(r)) return r as Record<string, unknown>[];
  return [];
}

function idOf(item: Record<string, unknown>): unknown {
  return (
    item.entity_id ??
    item.id ??
    item.tag_id ??
    (item.location as Record<string, unknown>)?.geohash ??
    item
  );
}

function first<T = Record<string, unknown>>(r: CallResult): T | undefined {
  return findResultArray(r.body)[0] as T | undefined;
}

/** Heatmap rows → geohash → affinity, defensively. */
function heatmapMap(r: CallResult): Map<string, number> {
  const out = new Map<string, number>();
  for (const row of findResultArray(r.body)) {
    const loc = (row.location ?? {}) as Record<string, unknown>;
    const q = (row.query ?? {}) as Record<string, unknown>;
    const gh = (loc.geohash ?? row.geohash) as string | undefined;
    const aff = (q.affinity ?? row.affinity ?? q.affinity_rank) as number | undefined;
    if (gh && typeof aff === 'number') out.set(gh, aff);
  }
  return out;
}

function pearson(a: Map<string, number>, b: Map<string, number>): { r: number; n: number } | null {
  const keys = [...a.keys()].filter((k) => b.has(k));
  if (keys.length < 5) return null;
  const xs = keys.map((k) => a.get(k) as number);
  const ys = keys.map((k) => b.get(k) as number);
  const mean = (v: number[]) => v.reduce((s, x) => s + x, 0) / v.length;
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < keys.length; i++) {
    const ex = (xs[i] as number) - mx;
    const ey = (ys[i] as number) - my;
    num += ex * ey;
    dx += ex * ex;
    dy += ey * ey;
  }
  return { r: num / Math.sqrt(dx * dy), n: keys.length };
}

const findings: string[] = [];
const note = (s: string) => {
  findings.push(s);
  console.log(`  → ${s}`);
};
const changed = (a: CallResult, b: CallResult) => a.digest !== b.digest || a.count !== b.count;

// ─── 1. Resolve ────────────────────────────────────────────────────────────────
const search = await call('01-search-artist', '/search', {
  query: args.artist,
  types: 'urn:entity:artist',
});
const artist = first(search);
const artistId = artist?.entity_id as string | undefined;
note(
  artistId
    ? `/search resolved "${args.artist}" → ${artist?.name} (${artistId})`
    : `/search did not resolve "${args.artist}"; check param names (query, types)`,
);
if (!artistId) {
  writeReport();
  process.exit(1);
}

// ─── 2. Core audience ───────────────────────────────────────────────────────────
await call('02-core-tags', '/v2/insights', {
  'filter.type': 'urn:tag',
  'signal.interests.entities': artistId,
  take: 20,
});
const demo = await call('02-core-demographics', '/v2/insights', {
  'filter.type': 'urn:demographics',
  'signal.interests.entities': artistId,
});
note(`urn:demographics → status ${demo.status}, ${demo.count} rows`);

// ─── 3. Next ring + explainability + exclude ───────────────────────────────────
const ring = await call('03-ring', '/v2/insights', {
  'filter.type': 'urn:entity:artist',
  'signal.interests.entities': artistId,
  take: 20,
});
const ringEx = await call('03-ring-exclude-explain', '/v2/insights', {
  'filter.type': 'urn:entity:artist',
  'signal.interests.entities': artistId,
  'filter.exclude.entities': artistId,
  'feature.explainability': true,
  take: 20,
});
const selfInRing = findResultArray(ring.body).some((e) => e.entity_id === artistId);
const selfInRingEx = findResultArray(ringEx.body).some((e) => e.entity_id === artistId);
note(`filter.exclude.entities: headliner in results without=${selfInRing}, with=${selfInRingEx}`);
const hasExplain = JSON.stringify(ringEx.body).includes('explainability');
note(`feature.explainability present in response: ${hasExplain}`);

// ─── F1: popularity cut-off ────────────────────────────────────────────────────
for (const max of [0.9, 0.7, 0.5]) {
  const r = await call(`f1-ring-popmax-${max}`, '/v2/insights', {
    'filter.type': 'urn:entity:artist',
    'signal.interests.entities': artistId,
    'filter.exclude.entities': artistId,
    'filter.popularity.max': max,
    take: 20,
  });
  note(`filter.popularity.max=${max}: n=${r.count}, changed vs no filter=${changed(r, ringEx)}`);
}

// ─── 4. Geography: heatmaps ────────────────────────────────────────────────────
const hmPoly = await call('04-heatmap-nyc-polygon', '/v2/insights', {
  'filter.type': 'urn:heatmap',
  'signal.interests.entities': artistId,
  'filter.location': NYC_POLYGON,
});
const hmQuery = await call('04-heatmap-nyc-query', '/v2/insights', {
  'filter.type': 'urn:heatmap',
  'signal.interests.entities': artistId,
  'filter.location.query': 'New York City',
});
note(`heatmap NYC polygon n=${hmPoly.count}, locality query n=${hmQuery.count}`);
const hmHood = await call('04-heatmap-nyc-neighborhood', '/v2/insights', {
  'filter.type': 'urn:heatmap',
  'signal.interests.entities': artistId,
  'filter.location.query': 'New York City',
  'output.heatmap.boundary': 'neighborhood',
});
note(
  `output.heatmap.boundary=neighborhood: status ${hmHood.status}, n=${hmHood.count}, changed=${changed(hmHood, hmQuery)} (⚠️ 500s reported by others)`,
);

// ─── #6 Baseline: nightlife tag union ──────────────────────────────────────────
const tagIds: string[] = [];
for (const q of ['live music venue', 'bar', 'nightclub']) {
  const t = await call(`06-tags-${q.replaceAll(' ', '-')}`, '/v2/tags', {
    'filter.query': q,
    take: 5,
  });
  const id = first(t)?.id as string | undefined;
  if (id) tagIds.push(id);
  note(`/v2/tags "${q}" → ${id ?? 'nothing (check param name filter.query)'}`);
}
let baseline: CallResult | undefined;
if (tagIds.length) {
  baseline = await call('06-baseline-heatmap-nyc', '/v2/insights', {
    'filter.type': 'urn:heatmap',
    'signal.interests.tags': tagIds.join(','),
    'operator.signal.interests.tags': 'union',
    'filter.location.query': 'New York City',
  });
  const p = pearson(heatmapMap(hmQuery), heatmapMap(baseline));
  note(
    p
      ? `artist vs nightlife-baseline heatmap: Pearson r=${p.r.toFixed(3)} over ${p.n} shared cells (others saw 0.92–0.97 vs popularity)`
      : 'could not correlate heatmaps (shape or overlap); inspect raw files',
  );
}

// ─── Food tastes vs heatmap (⚠️ reported to have no effect) ────────────────────
const foodSearch = await call('07-search-food-brand', '/search', {
  query: 'Sweetgreen',
  types: 'urn:entity:brand',
});
const foodId = first(foodSearch)?.entity_id as string | undefined;
if (foodId) {
  const hmFood = await call('07-heatmap-nyc-food', '/v2/insights', {
    'filter.type': 'urn:heatmap',
    'signal.interests.entities': foodId,
    'filter.location.query': 'New York City',
  });
  const p = baseline ? pearson(heatmapMap(hmFood), heatmapMap(baseline)) : null;
  note(
    `food-brand heatmap n=${hmFood.count}${p ? `, r vs baseline=${p.r.toFixed(3)}` : ''}; differs from artist heatmap=${changed(hmFood, hmQuery)}`,
  );
}

// ─── 5. Channels + F4 partner places near venue ────────────────────────────────
for (const type of ['urn:entity:podcast', 'urn:entity:tv_show', 'urn:entity:brand']) {
  await call(`05-channel-${type.split(':').pop()}`, '/v2/insights', {
    'filter.type': type,
    'signal.interests.entities': artistId,
    take: 10,
  });
}
const places = await call('05-places-near-venue', '/v2/insights', {
  'filter.type': 'urn:entity:place',
  'signal.interests.entities': artistId,
  'filter.location': args.venue,
  'filter.location.radius': 1000,
  take: 20,
});
note(`places within 1km of venue: n=${places.count}`);

// ─── #9 F3 venue fit: compare endpoint + location signal ───────────────────────
for (const path of ['/v2/insights/compare', '/v2/analysis/compare']) {
  const r = await call(`f3-compare-${path.split('/').slice(-2).join('-')}`, path, {
    'a.signal.interests.entities': artistId,
    'b.signal.location': args.venue,
  });
  note(`${path} with a=artist, b=location: status ${r.status}`);
}
const locTags = await call('f3-tags-at-venue-location', '/v2/insights', {
  'filter.type': 'urn:tag',
  'signal.location': args.venue,
  take: 20,
});
note(`fallback: urn:tag with signal.location at venue n=${locTags.count}`);

// ─── #5 / 4b Visitor source cities ─────────────────────────────────────────────
const metros = ['New York City', 'Chicago', 'Houston', 'Atlanta'];
const affinities: string[] = [];
for (const m of metros) {
  const r = await call(`4b-metro-${m.replaceAll(' ', '-')}`, '/v2/insights', {
    'filter.type': 'urn:entity:artist',
    'signal.location.query': m,
    'filter.results.entities': artistId,
  });
  const aff = (first(r)?.query as Record<string, unknown> | undefined)?.affinity;
  affinities.push(`${m}=${aff ?? 'n/a'}`);
}
note(`Option B per-metro affinity for artist: ${affinities.join(', ')}`);
const us = await call('4b-heatmap-us', '/v2/insights', {
  'filter.type': 'urn:heatmap',
  'signal.interests.entities': artistId,
  'filter.location.query': 'United States',
  'output.heatmap.boundary': 'city',
});
note(`Option A country-wide heatmap (boundary=city): status ${us.status}, n=${us.count}`);

writeReport();

function writeReport() {
  const lines = [
    '# Qloo probe results',
    '',
    `> Generated by \`scripts/qloo-probe.ts\` on ${new Date().toISOString()} against \`${BASE}\`.`,
    '> Metadata only. Raw responses are in `data/fixtures/probe/` (gitignored; Qloo terms forbid publishing response data).',
    '',
    '## Findings',
    '',
    ...findings.map((f) => `- ${f}`),
    '',
    '## Calls',
    '',
    '| Call | Path | Status | ms | Results | Error |',
    '|---|---|---|---|---|---|',
    ...results.map(
      (r) =>
        `| ${r.name} | \`${r.path}\` | ${r.status} | ${r.ms} | ${r.count} | ${r.error ? r.error.replaceAll('|', '/').slice(0, 80) : ''} |`,
    ),
    '',
    `Total calls: ${results.length}`,
    '',
  ];
  writeFileSync(join(ROOT, 'docs/qloo-probe.md'), lines.join('\n'));
  console.log(`\nReport → docs/qloo-probe.md (${results.length} calls)`);
}
