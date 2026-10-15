import {
  type CampaignBrief,
  CampaignBriefSchema,
  type RunResult,
  type StepId,
} from '@housefull/shared';
import type { AgentDeps } from '../deps.js';
import { withoutQloo } from './baseline.js';
import { checkText, llmReview, report, verifyClaims } from './critic.js';
import { type DisruptionReport, showNightDisruptions } from './disruptions.js';
import { gettingHome } from './getting-home.js';
import { addLocalEvents, findOpeners } from './openers.js';
import { partnerDeals } from './partners.js';
import { streetTeamRoutes } from './street-team.js';
import { type VenueFit, venueFit } from './venue-fit.js';
import { factsFrom, type WriterOutput, writeTemplate, writeWithLlm } from './writer.js';

/**
 * Steps after the core pipeline: F3 venue fit, F1 openers, F4 partner deals and
 * the "Without Qloo" baseline in parallel; then the brief writer; then the
 * critic (rules + one LLM review, at most one rewrite).
 */
export async function planBrief(result: RunResult, deps: AgentDeps): Promise<CampaignBrief> {
  const warnings = [...result.warnings];
  const warn = (message: string) => {
    warnings.push(message);
    deps.emit({ type: 'warning', message });
  };
  async function step<T>(id: StepId, fn: () => Promise<{ value: T; summary: string }>): Promise<T> {
    const started = performance.now();
    deps.emit({ type: 'step', step: id, status: 'started' });
    try {
      const { value, summary } = await fn();
      deps.emit({
        type: 'step',
        step: id,
        status: 'done',
        summary,
        ms: Math.round(performance.now() - started),
      });
      return value;
    } catch (e) {
      deps.emit({ type: 'step', step: id, status: 'failed', summary: (e as Error).message });
      throw e;
    }
  }

  const [fit, openers, partners, baseline, disrupt] = await Promise.all([
    step('venueFit', async () => {
      const v = await venueFit(result, deps);
      return { value: v, summary: `${v.score}/100 · ${v.diagnosis}` };
    }).catch((e: Error): VenueFit => {
      warn(`Venue fit unavailable: ${e.message}`);
      return {
        score: 50,
        reasons: [],
        diagnosis: 'Venue fit could not be computed for this show.',
      };
    }),
    step('openers', async () => {
      const o = await addLocalEvents(await findOpeners(result, deps), result, deps);
      return { value: o, summary: o.map((x) => x.artist.name).join(', ') || 'no candidates' };
    }).catch((e: Error) => {
      warn(`Opening-act finder failed: ${e.message}`);
      return [];
    }),
    step('partners', async () => {
      const p = await partnerDeals(result, deps);
      return { value: p, summary: `${p.length} taste-matched places open before doors` };
    }).catch((e: Error) => {
      warn(`Partner deals failed: ${e.message}`);
      return [];
    }),
    deps.llm
      ? step('baseline', async () => {
          const text = await withoutQloo(result.show, deps);
          return { value: text, summary: 'Same question, no Qloo data' };
        }).catch((e: Error) => {
          warn(`Without-Qloo comparison failed: ${e.message}`);
          return undefined;
        })
      : Promise.resolve(undefined),
    step('disruptions', async () => {
      const d = await showNightDisruptions(result, deps);
      return {
        value: d,
        summary: d.disruptions.length
          ? `${d.disruptions.length} to plan around: ${d.disruptions
              .slice(0, 2)
              .map((x) => x.title)
              .join('; ')}`
          : (d.notes[0] ?? 'nothing found for show night'),
      };
    }).catch((e: Error): DisruptionReport => {
      warn(`Disruption check failed: ${e.message}`);
      return { disruptions: [], notes: [] };
    }),
  ]);
  for (const n of disrupt.notes) if (!n.includes('NYC-only')) warn(n);

  const home =
    result.show.city === 'nyc'
      ? await step('gettingHome', async () => {
          const h = await gettingHome(result, deps, disrupt.disruptions);
          const st = h?.stations[0];
          return {
            value: h,
            summary: st
              ? `${st.name}, ${st.walkMinutes} min walk${h?.suggestedRoute ? ', suggested route ready' : ''}`
              : 'no station data',
          };
        }).catch((e: Error) => {
          warn(`Getting-home check failed: ${e.message}`);
          return undefined;
        })
      : undefined;

  const streetTeam = await step('streetTeam', async () => {
    const r = streetTeamRoutes(result);
    return {
      value: r,
      summary: r.length
        ? r.map((x) => `${x.stops.length} stops, ~${x.walkMinutes} min walk`).join('; ')
        : 'not enough mapped places nearby',
    };
  });

  const facts = factsFrom(result, {
    venueFit: {
      score: fit.score,
      diagnosis: fit.diagnosis,
      reasons: fit.reasons.map((r) => r.text),
    },
    openers: openers.map((o) => o.artist.name),
    partners: partners.map((p) => ({
      place: p.place.name,
      offer: p.offer,
      segmentId: p.segmentId,
    })),
    disruptions: disrupt.disruptions.slice(0, 5).map((d) => `${d.title}: ${d.effect}`),
  });

  let writer = deps.llm ? deps.llm.name : 'template';
  let draft = await step('brief', async () => {
    let out: WriterOutput;
    if (deps.llm) {
      try {
        out = await writeWithLlm(facts, deps);
      } catch (e) {
        warn(`Brief writer fell back to the template: ${(e as Error).message}`);
        writer = 'template';
        out = writeTemplate(facts);
      }
    } else out = writeTemplate(facts);
    return {
      value: out,
      summary: `${out.segments.reduce((n, s) => n + s.copy.length, 0)} ad variants, ${out.schedule.length} schedule steps`,
    };
  });

  const critic = await step('critic', async () => {
    const reviewer = deps.llm && writer !== 'template' ? deps.llm.name : 'deterministic';
    let rounds = 1;
    let issues = checkText(draft, facts);
    const extra: string[] = [];
    // A failed review or rewrite must not fail the run: rule checks still apply.
    const safeReview = async (d: WriterOutput) => {
      try {
        return await llmReview(d, facts, deps);
      } catch (e) {
        extra.push(`LLM review unavailable (${(e as Error).message}); rule checks still applied`);
        return { pass: true, issues: [] as string[] };
      }
    };
    let review =
      writer === 'template' ? { pass: true, issues: [] as string[] } : await safeReview(draft);
    if ((issues.length || !review.pass) && deps.llm && writer !== 'template') {
      rounds = 2;
      try {
        draft = await writeWithLlm(facts, deps, [...issues, ...review.issues]);
        issues = checkText(draft, facts);
        review = await safeReview(draft);
      } catch (e) {
        extra.push(`Rewrite failed (${(e as Error).message}); kept the first draft`);
      }
    }
    const notes = [...issues, ...(review.pass ? [] : review.issues), ...extra];
    if (issues.some((i) => i.includes('protected trait'))) {
      // Never ship copy that mentions protected traits: fall back to the factual template.
      draft = writeTemplate(facts);
      writer = 'template';
      notes.push(
        'Copy replaced with the factual template after failing the protected-traits check.',
      );
    }
    const known = deps.knownCallIds ? await deps.knownCallIds() : undefined;
    return {
      value: { known, notes, rounds, reviewer, passed: issues.length === 0 && review.pass },
      summary:
        issues.length === 0 && review.pass
          ? `passed in ${rounds} round${rounds > 1 ? 's' : ''}`
          : `${notes.length} notes`,
    };
  });

  const segments = verifyClaims(
    result.segments.map((s) => ({
      ...s,
      copy: draft.segments.find((d) => d.id === s.id)?.copy ?? [],
    })),
    critic.known,
  );
  const reasons = verifyClaims([{ reasons: fit.reasons }], critic.known);
  const checkedOpeners = verifyClaims(openers, critic.known);
  const dropped = segments.dropped + reasons.dropped + checkedOpeners.dropped;
  if (dropped)
    warn(
      `${dropped} claim${dropped > 1 ? 's' : ''} removed: source not found in this run's Qloo calls`,
    );

  return CampaignBriefSchema.parse({
    show: { ...result.show, artistEntityId: result.artist.entityId },
    artist: result.artist,
    summary: draft.summary,
    core: result.core,
    segments: segments.items,
    conflicts: result.conflicts.events.map((e) => ({ name: e.name, venue: e.venue, time: e.time })),
    schedule: [...draft.schedule].sort((a, b) => b.daysOut - a.daysOut),
    baselineComparison: baseline ? { llmOnly: baseline } : undefined,
    venueFit: { score: fit.score, reasons: reasons.items[0]?.reasons ?? [] },
    openers: checkedOpeners.items,
    partnerDeals: partners,
    disruptions: disrupt.disruptions.length ? disrupt.disruptions : undefined,
    streetTeam: streetTeam.length ? streetTeam : undefined,
    gettingHome: home,
    access: result.access,
    critic: report({
      passed: critic.passed && dropped === 0,
      rounds: critic.rounds,
      droppedClaims: dropped,
      notes: critic.notes,
      reviewer: critic.reviewer,
    }),
    warnings,
    writer,
  });
}
