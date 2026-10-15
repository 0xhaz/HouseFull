import {
  type Claim,
  type QlooRef,
  type RunResult,
  RunResultSchema,
  type Segment,
  type ShowInput,
  type StepId,
} from '@housefull/shared';
import { z } from 'zod';
import { type Cluster, cleanTagName, clusterRing, distinctNames } from './cluster.js';
import type { AgentDeps } from './deps.js';
import { toRef } from './refs.js';
import { segmentReach } from './segment.js';

export { toRef };

/** urn:tag insights mix in place/brand attributes (payment cards, hotel stars); keep taste tags. */
const TASTE_TAG_PREFIXES = [
  'urn:tag:genre:music',
  'urn:tag:genre:qloo',
  'urn:tag:style:qloo',
  'urn:tag:music:qloo',
  'urn:tag:artist:qloo',
  'urn:tag:audience:qloo',
];
const SEEDS_PER_SEGMENT = 4;

export class RunFailed extends Error {}

const pct = (x: number) => `${x >= 0 ? '+' : ''}${x.toFixed(2)}`;

/** Age/gender skews from urn:demographics (−1…1). Aggregate wording only. */
export function describeDemographics(q: {
  age?: Record<string, number>;
  gender?: Record<string, number>;
}) {
  const ages = Object.entries(q.age ?? {}).sort((a, b) => b[1] - a[1]);
  const top = ages.filter(([, v]) => v > 0.05).slice(0, 2);
  const ageSkew = top.length
    ? `over-indexes ${top.map(([k, v]) => `${k.replaceAll('_', ' ')} (${pct(v)})`).join(', ')}`
    : 'no strong age skew';
  const male = q.gender?.male ?? 0;
  const genderSkew =
    Math.abs(male) < 0.05
      ? 'balanced'
      : `leans ${male > 0 ? 'male' : 'female'} (${pct(Math.abs(male))})`;
  return { ageSkew, genderSkew };
}

export async function runAgent(show: ShowInput, deps: AgentDeps): Promise<RunResult> {
  const { qloo, geo, ticketmaster, emit } = deps;
  const ctx = { runId: deps.runId, ipHash: deps.ipHash };
  const warnings: string[] = [];
  const warn = (message: string) => {
    warnings.push(message);
    emit({ type: 'warning', message });
  };

  async function step<T>(
    id: StepId,
    fn: () => Promise<{ value: T; summary: string }>,
    segmentId?: string,
  ) {
    const started = performance.now();
    emit({ type: 'step', step: id, status: 'started', segmentId });
    try {
      const { value, summary } = await fn();
      emit({
        type: 'step',
        step: id,
        status: 'done',
        segmentId,
        summary,
        ms: Math.round(performance.now() - started),
      });
      return value;
    } catch (e) {
      emit({ type: 'step', step: id, status: 'failed', segmentId, summary: (e as Error).message });
      throw e;
    }
  }

  // ─── 1. Resolve ───────────────────────────────────────────────────────────
  const artist = await step('resolve', async () => {
    const res = await qloo.search(
      { query: show.artist, types: ['urn:entity:artist'], take: 5 },
      ctx,
    );
    const wanted = show.artist.trim().toLowerCase();
    const hit =
      res.data.results.find((e) => e.name.toLowerCase() === wanted) ?? res.data.results[0];
    if (!hit) throw new RunFailed(`Qloo has no artist matching "${show.artist}"`);
    return { value: toRef(hit, res.meta.callId), summary: `${hit.name} at ${show.venue.name}` };
  });

  // ─── 2. Core · 3. Ring · 6. Conflicts · travel times: independent, run together ─
  const corePromise = step('core', async () => {
    const [tags, demo] = await Promise.all([
      qloo.insights(
        { filterType: 'urn:tag', signal: { entities: [artist.entityId] }, take: 50 },
        ctx,
      ),
      qloo
        .insights({ filterType: 'urn:demographics', signal: { entities: [artist.entityId] } }, ctx)
        .catch((e: Error) => {
          warn(`Demographics unavailable: ${e.message}`);
          return null;
        }),
    ]);
    const seen = new Set<string>();
    const tasteTags = (tags.data.results.tags ?? []).filter((t) => {
      const id = (t.tag_id ?? t.id) as string;
      // The same name appears under several tag families (e.g. artist:qloo and style:qloo).
      const name = cleanTagName(t.name).toLowerCase();
      if (!TASTE_TAG_PREFIXES.some((p) => id.startsWith(p)) || seen.has(name)) return false;
      seen.add(name);
      return true;
    });
    const tagRefs: QlooRef[] = tasteTags.slice(0, 12).map((t) => ({
      entityId: (t.tag_id ?? t.id) as string,
      name: cleanTagName(t.name),
      type: 'urn:tag',
      affinity: t.query?.affinity,
      sourceRef: tags.meta.callId,
    }));
    const demoRow = demo?.data.results.demographics?.[0] as
      | { query?: Record<string, Record<string, number>> }
      | undefined;
    const demographics = demoRow?.query ? describeDemographics(demoRow.query) : undefined;
    return {
      value: { tags: tagRefs, demographics },
      summary: `${tagRefs
        .slice(0, 3)
        .map((t) => t.name)
        .join(', ')}${demographics ? `; ${demographics.ageSkew}` : ''}`,
    };
  }).catch(() => ({ tags: [] as QlooRef[], demographics: undefined }));

  const ringPromise = step('ring', async () => {
    const res = await qloo.insights(
      {
        filterType: 'urn:entity:artist',
        signal: { entities: [artist.entityId] },
        filter: { excludeEntities: [artist.entityId] },
        explainability: true,
        take: 30,
      },
      ctx,
    );
    const entities = res.data.results.entities ?? [];
    if (entities.length < 3)
      throw new RunFailed('Qloo returned too few related artists to build audiences');
    const clusters = clusterRing(entities);
    return {
      value: { clusters, callId: res.meta.callId, total: entities.length },
      summary: `${entities.length} related artists → ${clusters.length} segments`,
    };
  });

  const conflictsPromise = step<RunResult['conflicts']>('conflicts', async () => {
    const r = await ticketmaster.conflicts({
      lat: show.venue.lat,
      lng: show.venue.lng,
      date: show.date,
    });
    if (!r.available)
      return { value: { available: false, events: [], note: r.reason }, summary: r.reason };
    const artistName = show.artist.toLowerCase();
    const events = r.events
      .filter((e) => !e.name.toLowerCase().includes(artistName))
      .map((e) => ({ name: e.name, venue: e.venue, time: e.time?.slice(0, 5) ?? '', url: e.url }));
    return {
      value: { available: true, events, source: r.source },
      summary: `${events.length} music events that night`,
    };
  }).catch((e: Error) => ({ available: false, events: [], note: e.message }));

  const accessPromise = geo.access(show.city, show.venue.lng, show.venue.lat);
  const bboxPromise = geo.cityBbox(show.city);
  const baselinePromise = geo.baseline(show.city);

  const ring = await ringPromise;
  const [access, bbox, baseline] = await Promise.all([accessPromise, bboxPromise, baselinePromise]);
  if (baseline.length === 0) warn(`No nightlife baseline for ${show.city}: run \`pnpm baselines\``);

  // ─── Segments: 4 (+4b) and 5 in parallel per segment; naming runs alongside ─
  const namedPromise = nameSegments(ring.clusters, artist, deps, warn);

  const segments = await Promise.all(
    ring.clusters.map(async (cluster, i) => {
      const id = `s${i + 1}`;
      const seeds = cluster.members.slice(0, SEEDS_PER_SEGMENT).map((e) => toRef(e, ring.callId));
      const seedIds = seeds.map((s) => s.entityId);
      const why: Claim[] = [
        {
          text: `Fans of ${artist.name} also like ${seeds
            .slice(0, 3)
            .map((s) => s.name)
            .join(', ')}`,
          sourceRef: ring.callId,
        },
        ...(cluster.distinctiveTags.length
          ? [
              {
                text: `Shared taste: ${distinctNames(
                  cluster.distinctiveTags.map((t) => t.name),
                  4,
                ).join(', ')}`,
                sourceRef: ring.callId,
              },
            ]
          : []),
      ];

      const reachP = segmentReach(id, seedIds, { show, bbox, baseline, access, deps, step, warn });
      const [reach, named] = await Promise.all([reachP, namedPromise]);
      const naming = named[i] as Cluster & { name: string; why?: string };
      const segment: Segment = {
        id,
        name: naming.name,
        why: [
          ...why,
          ...(naming.why ? [{ text: naming.why, sourceRef: ring.callId }] : []),
          ...reach.claims,
        ],
        seeds,
        neighborhoods: reach.neighborhoods,
        sourceCities: reach.sourceCities,
        channels: {
          ...reach.channels,
          adTargeting: {
            interests: distinctNames(
              cluster.distinctiveTags.map((t) => t.name),
              6,
            ),
            geos: reach.neighborhoods.map((n) => n.name),
          },
        },
        copy: [],
      };
      return segment;
    }),
  );

  const [core, conflicts] = await Promise.all([corePromise, conflictsPromise]);
  return RunResultSchema.parse({
    show,
    artist,
    core,
    segments,
    conflicts,
    access: { mode: access.mode, method: access.method },
    warnings,
  });
}

const NamingSchema = z.object({
  // No length limits here (a long answer must not fail naming); trimmed below.
  segments: z.array(z.object({ index: z.number(), name: z.string(), why: z.string() })),
});

/**
 * Names come from the LLM when one is configured; otherwise from the most
 * distinctive genres. Either way the facts (members, tags) come from Qloo.
 */
async function nameSegments(
  clusters: Cluster[],
  artist: QlooRef,
  deps: AgentDeps,
  warn: (m: string) => void,
): Promise<Array<Cluster & { name: string; why?: string }>> {
  const fallback = clusters.map((c, i) => ({
    ...c,
    name: c.label.length ? c.label.join(' & ') : `Segment ${i + 1}`,
  }));
  if (!deps.llm) return fallback;
  try {
    const out = await deps.llm.object({
      tier: 'fast',
      schema: NamingSchema,
      system:
        'You name audience segments for a concert promoter. Use only the artists and tags given. Names are 2–5 words, ' +
        'plain and specific (e.g. "Neo-soul & late-night radio"). Never mention age, gender, race or other protected traits.',
      prompt: JSON.stringify({
        headliner: artist.name,
        segments: clusters.map((c, index) => ({
          index,
          artists: c.members.slice(0, 8).map((m) => m.name),
          tags: c.distinctiveTags.map((t) => t.name),
        })),
      }),
    });
    return fallback.map((c, i) => {
      const n = out.segments.find((s) => s.index === i);
      return n ? { ...c, name: n.name.slice(0, 60), why: n.why.slice(0, 220) } : c;
    });
  } catch (e) {
    warn(`Segment naming fell back to tags: ${(e as Error).message}`);
    return fallback;
  }
}
