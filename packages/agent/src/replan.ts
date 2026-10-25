import type { Scoreboard, ScoredSegment } from '@housefull/feedback';
import type { CampaignBrief, Claim, ReplanResult, Segment, SurveySummary } from '@housefull/shared';
import { CampaignBriefSchema } from '@housefull/shared';
import { verifyClaims } from './brief/critic.js';
import { factsFrom, writeTemplate, writeWithLlm } from './brief/writer.js';
import { distinctNames } from './cluster.js';
import type { AgentDeps } from './deps.js';
import { toRef } from './refs.js';
import { segmentReach } from './segment.js';

export class NotReadyForReplan extends Error {}

function lovedBy(survey: SurveySummary | undefined, segmentId: string) {
  const s = survey?.bySegment.find((x) => x.segmentId === segmentId);
  return s &&
    s.responses >= LOVED.minResponses &&
    (s.avgRating ?? 0) >= LOVED.rating &&
    (s.wouldReturnPct ?? 0) >= LOVED.returnPct
    ? s
    : undefined;
}

/** Drop a segment only when it's this many times worse than the winner. */
const DROP_RATIO = 3;
/** Share of the weakest segment's budget moved to the winner. */
const SHIFT_PCT = 30;
const NEW_SEEDS = 4;
/** Attendees who loved it: an audience this happy isn't paused on ad cost alone. */
const LOVED = { minResponses: 5, rating: 4.3, returnPct: 60 };

const fmt = (s: ScoredSegment) =>
  s.metricLabel === 'cost per sale' && s.sales === 0
    ? `no sales from $${s.spendUsd.toFixed(0)}`
    : s.metricLabel === 'cost per sale'
      ? `$${s.metric.toFixed(2)} per sale`
      : s.metricLabel === 'clicks per $'
        ? `${s.metric.toFixed(2)} clicks per $`
        : s.metricLabel === 'sales per click'
          ? `${(s.metric * 100).toFixed(1)}% of clicks buy`
          : `${s.metric} clicks`;

/**
 * F9b re-plan: shift budget to what works, add "more like the winners" from Qloo
 * (the winner's seeds as signal, every artist already used excluded), refresh or
 * drop the weakest segment, and keep the critic's source rule for new claims.
 */
export async function replan(
  brief: CampaignBrief,
  fromVersion: number,
  board: Scoreboard,
  deps: AgentDeps,
  opts: { force?: boolean; survey?: SurveySummary } = {},
): Promise<{ brief: CampaignBrief; result: ReplanResult }> {
  if (!board.ready && !opts.force) throw new NotReadyForReplan(board.reason);
  const ranked = board.segments.filter((s) => brief.segments.some((x) => x.id === s.segmentId));
  const best = ranked[0];
  const worst = ranked.length > 1 ? ranked[ranked.length - 1] : undefined;
  if (!best) throw new NotReadyForReplan('No results recorded for any segment yet');
  const winner = brief.segments.find((s) => s.id === best.segmentId) as Segment;
  const loser = worst ? brief.segments.find((s) => s.id === worst.segmentId) : undefined;

  const warnings: string[] = [];
  const warn = (m: string) => warnings.push(m);
  const ctx = { runId: deps.runId, ipHash: deps.ipHash };
  const show = brief.show;
  const changes: ReplanResult['changes'] = [];

  // ── More like the winners ──────────────────────────────────────────────────
  const used = new Set([
    brief.artist.entityId,
    ...brief.segments.flatMap((s) => s.seeds.map((x) => x.entityId)),
  ]);
  const more = await deps.qloo.insights(
    {
      filterType: 'urn:entity:artist',
      signal: { entities: winner.seeds.map((s) => s.entityId) },
      filter: { excludeEntities: [...used] },
      take: 20,
    },
    ctx,
  );
  const fresh = (more.data.results.entities ?? [])
    .filter((e) => !used.has(e.entity_id))
    .slice(0, NEW_SEEDS);
  let added: Segment | undefined;
  if (fresh.length >= 2) {
    const id = `s${Math.max(...brief.segments.map((s) => Number(s.id.slice(1)) || 0)) + 1}`;
    const [bbox, baseline, access] = await Promise.all([
      deps.geo.cityBbox(show.city),
      deps.geo.baseline(show.city),
      deps.geo.access(show.city, show.venue.lng, show.venue.lat),
    ]);
    const step = async <T>(_: unknown, fn: () => Promise<{ value: T; summary: string }>) =>
      (await fn()).value;
    const reach = await segmentReach(
      id,
      fresh.map((e) => e.entity_id),
      { show, bbox, baseline, access, deps, step, warn },
    );
    const seeds = fresh.map((e) => toRef(e, more.meta.callId));
    const why: Claim[] = [
      {
        text: `Fans of ${winner.name} also like ${seeds
          .slice(0, 3)
          .map((s) => s.name)
          .join(', ')}`,
        sourceRef: more.meta.callId,
      },
      ...reach.claims,
    ];
    added = {
      id,
      name: `More like ${winner.name}`,
      why,
      seeds,
      neighborhoods: reach.neighborhoods,
      sourceCities: reach.sourceCities,
      channels: {
        ...reach.channels,
        adTargeting: {
          interests: distinctNames(winner.channels.adTargeting.interests, 6),
          geos: reach.neighborhoods.map((n) => n.name),
        },
      },
      copy: [],
    };
    changes.push({
      kind: 'new_segment',
      detail: `Added "${added.name}": ${seeds.map((s) => s.name).join(', ')}`,
      sourceRef: more.meta.callId,
    });
  } else warn('Qloo returned too few new lookalike artists to add a segment');

  // ── Budget, drop or refresh ────────────────────────────────────────────────
  let drop: Segment | undefined;
  if (worst && loser) {
    const lowerBetter = best.metricLabel === 'cost per sale';
    const ratio = lowerBetter
      ? worst.metric / best.metric
      : best.metric / Math.max(worst.metric, 1e-9);
    const conclusive = !board.earlySignal && ratio >= DROP_RATIO && brief.segments.length > 2;
    const loved = lovedBy(opts.survey, loser.id);
    if (conclusive && loved) {
      changes.push({
        kind: 'survey',
        detail: `Kept "${loser.name}" despite ${fmt(worst)}: its attendees rated the show ${loved.avgRating}★ and ${loved.wouldReturnPct}% would come back`,
      });
    } else if (conclusive) {
      drop = loser;
      changes.push({
        kind: 'drop_segment',
        detail: `Paused "${loser.name}" (${fmt(worst)} vs ${fmt(best)})`,
      });
    }
    changes.push({
      kind: 'budget',
      detail: drop
        ? `Moved "${loser.name}"'s budget to "${winner.name}"${added ? ` and "${added.name}"` : ''}`
        : `Shift ${SHIFT_PCT}% of "${loser.name}"'s budget to "${winner.name}" (${fmt(best)} vs ${fmt(worst)})`,
    });
  }

  // ── Copy for the new segment and the refreshed one ─────────────────────────
  const refresh = [added, drop ? undefined : loser].filter((s): s is Segment => Boolean(s));
  let segments = brief.segments.filter((s) => s.id !== drop?.id);
  if (added) segments = [...segments, added];
  if (refresh.length) {
    const facts = factsFrom(
      {
        show,
        artist: brief.artist,
        core: brief.core,
        segments: refresh,
        conflicts: { available: false, events: [] },
        access: brief.access,
        warnings: [],
      },
      {
        venueFit: { score: brief.venueFit.score, diagnosis: '', reasons: [] },
        openers: [],
        partners: [],
      },
    );
    let out = writeTemplate(facts);
    if (deps.llm) {
      try {
        out = await writeWithLlm(
          facts,
          deps,
          loser && !drop ? [`Segment ${loser.id} underperformed: try a different angle`] : [],
        );
      } catch (e) {
        warn(`Copy refresh fell back to the template: ${(e as Error).message}`);
      }
    }
    segments = segments.map((s) => {
      const copy = out.segments.find((o) => o.id === s.id)?.copy;
      return copy ? { ...s, copy } : s;
    });
    if (loser && !drop) changes.push({ kind: 'copy', detail: `New ad copy for "${loser.name}"` });
  }

  // ── Schedule: today's move first, then the remaining steps ─────────────────
  const daysOut = Math.max(
    0,
    Math.round((Date.parse(`${show.date}T20:00:00Z`) - Date.now()) / 86_400_000),
  );
  const schedule = [
    ...changes
      .filter((c) => c.kind === 'budget' || c.kind === 'new_segment')
      .map((c) => ({
        daysOut,
        action: c.detail,
        segmentId: c.kind === 'new_segment' ? (added?.id ?? 'all') : best.segmentId,
      })),
    ...brief.schedule.filter((s) => s.daysOut < daysOut && s.segmentId !== drop?.id),
  ];
  const happiest = opts.survey?.bySegment.find(
    (x) => x.responses >= LOVED.minResponses && x.avgRating !== null,
  );
  if (happiest && !changes.some((c) => c.kind === 'survey'))
    changes.push({
      kind: 'survey',
      detail: `Post-show survey: "${happiest.name}" attendees rated it highest, ${happiest.avgRating}★ from ${happiest.responses} responses${happiest.wouldReturnPct !== null ? `, ${happiest.wouldReturnPct}% would come back` : ''}`,
    });
  changes.push({ kind: 'schedule', detail: `Schedule restarted from ${daysOut} days out` });

  const known = deps.knownCallIds ? await deps.knownCallIds() : undefined;
  const checked = verifyClaims(segments, known);
  const summary =
    `${winner.name} performs best (${fmt(best)}${board.earlySignal ? ', early signal' : ''})` +
    (added ? `; added "${added.name}" from Qloo lookalikes` : '') +
    (drop ? `; paused "${drop.name}"` : loser ? `; refreshed "${loser.name}"` : '') +
    '.';

  const toVersion = fromVersion + 1;
  const next = CampaignBriefSchema.parse({
    ...brief,
    // The change note says what changed; the brief's own summary stays the diagnosis.
    summary: brief.summary,
    segments: checked.items,
    schedule,
    warnings: [...brief.warnings, ...warnings],
    critic: { ...brief.critic, droppedClaims: brief.critic.droppedClaims + checked.dropped },
  });
  return { brief: next, result: { fromVersion, toVersion, changes, summary } };
}
