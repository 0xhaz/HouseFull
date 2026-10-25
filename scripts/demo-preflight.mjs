// Demo preflight: checks everything the end-to-end demo needs, without printing any secret.
//   pnpm demo:check                      # against localhost (web :3100, API :4100)
//   API=https://… WEB=https://… pnpm demo:check
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';

const API = process.env.API || 'http://localhost:4100';
const WEB = process.env.WEB || 'http://localhost:3100';
const root = new URL('..', import.meta.url);

let failed = 0;
let warned = 0;
const ok = (msg) => console.log(`  \x1b[32m✓\x1b[0m ${msg}`);
const bad = (msg, fix) => {
  failed++;
  console.log(`  \x1b[31m✗\x1b[0m ${msg}${fix ? `\n      → ${fix}` : ''}`);
};
const warn = (msg, fix) => {
  warned++;
  console.log(`  \x1b[33m!\x1b[0m ${msg}${fix ? `\n      → ${fix}` : ''}`);
};
const section = (t) => console.log(`\n${t}`);

/** Keys present in a dotenv file (values are never read out). */
function envKeys(path) {
  const file = new URL(path, root);
  if (!existsSync(file)) return null;
  const set = new Set();
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(\S.*)?$/);
    if (m?.[2] && !m[2].startsWith('#')) set.add(m[1]);
  }
  return set;
}

async function get(base, path) {
  try {
    const res = await fetch(new URL(path, base), { signal: AbortSignal.timeout(60_000) });
    const text = await res.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    return { status: res.status, body };
  } catch (e) {
    return { status: 0, body: String(e.message ?? e) };
  }
}

section('Tools');
const wanted = readFileSync(new URL('.nvmrc', root), 'utf8').trim();
if (Number(process.versions.node.split('.')[0]) >= Number(wanted.split('.')[0]))
  ok(`Node ${process.version}`);
else bad(`Node ${process.version}, need ${wanted}`, 'run `nvm use` in the repo');

section('Configuration (presence only)');
const env = envKeys('.env');
const webEnv = envKeys('apps/web/.env.local');
if (!env) bad('.env missing', 'cp .env.example .env and fill it in');
else {
  for (const [key, what] of [
    ['QLOO_API_KEY', 'Qloo (without it the app runs on fixtures)'],
    ['GOOGLE_VERTEX_PROJECT', 'Gemini on Vertex (writer, critic, Ask, drafts)'],
    ['TICKETMASTER_API_KEY', 'Ticketmaster (show picker, conflicts, Tonight)'],
    ['CLERK_SECRET_KEY', 'Clerk on the API (signed-in workspaces)'],
  ])
    env.has(key) ? ok(`${key}: ${what}`) : bad(`${key} not set: ${what}`, 'add it to .env');
}
if (!webEnv?.has('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY') || !webEnv?.has('CLERK_SECRET_KEY'))
  bad('Clerk keys missing in apps/web/.env.local', 'run `clerk env pull` in apps/web');
else ok('Clerk keys in apps/web/.env.local');
const adc = `${homedir()}/.config/gcloud/application_default_credentials.json`;
existsSync(adc)
  ? ok('Google application default credentials (for Vertex)')
  : bad('No Google application default credentials', 'gcloud auth application-default login');

section('Services');
const health = await get(API, '/health');
if (health.status !== 200) bad(`API not reachable at ${API}`, '`pnpm db:start` then `pnpm dev`');
else {
  ok(`API up at ${API}`);
  health.body.demoMode
    ? bad('API is in demo mode (fixtures only)', 'set QLOO_API_KEY and DEMO_MODE=false, restart')
    : ok(`Live Qloo · ${health.body.qlooBudgetRemaining} calls left in today’s budget`);
}
const web = await get(WEB, '/');
web.status === 200 ? ok(`Web up at ${WEB}`) : bad(`Web not reachable at ${WEB}`, '`pnpm dev`');

if (health.status === 200) {
  section('Demo data');
  const presets = await get(API, '/shows/presets');
  Array.isArray(presets.body) && presets.body.length === 3
    ? ok('3 demo shows (New York, New Orleans, Los Angeles)')
    : bad('Demo shows missing', 'check the API log');

  const ws = {};
  for (const slug of ['demo-promoter', 'demo-venue', 'demo-artist']) {
    const r = await get(API, `/workspaces/${slug}`);
    ws[slug] = r.body?.runs ?? [];
    r.status !== 200
      ? bad(`${slug} not available`, 'restart the API (it recreates demo workspaces on boot)')
      : ws[slug].length
        ? ok(`${slug}: ${ws[slug].length} show(s)`)
        : bad(`${slug} has no shows`, '`pnpm seed:demo`');
  }
  const replanned = ws['demo-promoter'].filter((r) => r.version > 1).length;
  replanned >= 3
    ? ok('Promoter demo briefs re-planned from sample results (v2)')
    : warn(
        `Only ${replanned}/3 promoter briefs have a v2`,
        '`pnpm seed:demo` to add sample results and re-plan',
      );
  const cities = new Set(ws['demo-artist'].map((r) => r.show.city));
  cities.size >= 3
    ? ok('Artist demo has a three-city tour')
    : warn('Artist demo has fewer than three cities', '`ONLY=tour pnpm seed:demo`');
  const soon = ws['demo-promoter']
    .map((r) => Math.round((Date.parse(`${r.show.date}T00:00:00Z`) - Date.now()) / 86_400_000))
    .filter((d) => d < 0);
  soon.length
    ? warn(
        'Some demo show dates are in the past',
        'update dates in apps/api/src/shows/presets.ts and re-seed',
      )
    : ok('Demo show dates are still ahead');

  section('Live data');
  const tonight = await get(API, '/tonight?city=nyc&when=week');
  tonight.body?.available
    ? ok(`Tonight: ${tonight.body.events.length} shows in New York this week (Ticketmaster)`)
    : bad(
        `Tonight unavailable: ${tonight.body?.reason ?? tonight.status}`,
        'check TICKETMASTER_API_KEY',
      );
  const spots = await get(API, '/tonight/spots?city=nyc');
  spots.body?.available
    ? ok(`Walk-in spots: ${spots.body.spots.length} jazz clubs, pubs and bars (Qloo)`)
    : warn('No live-music spots returned', 'check Qloo budget and key');
  const outreach = await get(API, '/workspaces/demo-venue/outreach');
  Array.isArray(outreach.body) && outreach.body.some((c) => c.phone || c.website)
    ? ok(`Outreach: ${outreach.body.length} contacts with details (Qloo /entities)`)
    : warn('Outreach contacts have no phone or website', 'Qloo /entities may be unavailable');
}

console.log(
  failed
    ? `\n\x1b[31m${failed} problem(s)\x1b[0m${warned ? `, ${warned} warning(s)` : ''}: fix these before the demo.\n`
    : `\n\x1b[32mReady for the demo.\x1b[0m${warned ? ` ${warned} warning(s) above.` : ''}\n`,
);
process.exit(failed ? 1 : 0);
