import type { Claim, CriticReport } from '@housefull/shared';
import { z } from 'zod';
import type { AgentDeps } from '../deps.js';
import type { WriterFacts, WriterOutput } from './writer.js';

/** Protected traits must never be targeted or mentioned in copy (architecture §10). */
const PROTECTED =
  /\b(women|woman|men|male|female|girls?|guys|black|white|latin[oax]?|asian|hispanic|jewish|muslim|christian|gay|lesbian|queer|trans|millennials?|gen ?z|boomers?|\d0s\b|twenty-?somethings?|thirty-?somethings?)\b/i;

export type CheckResult = { notes: string[]; textIssues: string[] };

/** The protected trait a text mentions, if any. Known names ("TV Girl") are masked first. */
export function protectedTraitIn(text: string, names: string[] = []): string | undefined {
  const masked = names
    .filter((n) => n && n.length > 1)
    .sort((a, b) => b.length - a.length)
    .reduce(
      (t, n) => t.replace(new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ' '),
      text,
    );
  return masked.match(PROTECTED)?.[0];
}

/** Every claim must cite a Qloo call made in this run; unknown sources are dropped. */
export function verifyClaims<T extends { why?: Claim[]; reasons?: Claim[] }>(
  items: T[],
  known: Set<string> | undefined,
): { items: T[]; dropped: number } {
  let dropped = 0;
  const ok = (c: Claim) => {
    const good = c.sourceRef.length > 0 && (!known || known.has(c.sourceRef));
    if (!good) dropped += 1;
    return good;
  };
  return {
    items: items.map((i) => ({
      ...i,
      ...(i.why ? { why: i.why.filter(ok) } : {}),
      ...(i.reasons ? { reasons: i.reasons.filter(ok) } : {}),
    })),
    dropped,
  };
}

/** Deterministic text checks on the writer's output. */
export function checkText(out: WriterOutput, facts: WriterFacts): string[] {
  const issues: string[] = [];
  const allowedNumbers = new Set(
    JSON.stringify(facts)
      .match(/\d+/g)
      ?.map((n) => n.replace(/^0+(?=\d)/, '')) ?? [],
  );
  // Names from the facts (artists like "Men I Trust" or "TV Girl", places, shows) are not trait
  // mentions; mask them before scanning. Longest first so "TV Girl" goes before "Girl".
  const names = [
    facts.show.artist,
    facts.show.venue,
    ...facts.segments.flatMap((s) => [
      s.name,
      ...s.fansOf,
      ...s.neighborhoods,
      ...s.podcasts,
      ...s.tvShows,
      ...(s.sourceCities ?? []),
    ]),
    ...facts.openers,
    ...facts.partners.map((p) => p.place),
    ...facts.conflicts,
  ]
    .filter((n) => n && n.length > 1)
    .sort((a, b) => b.length - a.length);
  const mask = (text: string) =>
    names.reduce(
      (t, n) => t.replace(new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ' '),
      text,
    );
  const texts: Array<[where: string, text: string]> = [
    ['summary', out.summary],
    ...out.segments.flatMap((s) =>
      s.copy.flatMap(
        (c, i) =>
          [[`${s.id} copy ${i + 1}`, `${c.headline} ${c.body} ${c.cta}`]] as Array<
            [string, string]
          >,
      ),
    ),
    ...out.schedule.map((s) => [`schedule day ${s.daysOut}`, s.action] as [string, string]),
  ];
  for (const [where, text] of texts) {
    const p = mask(text).match(PROTECTED);
    if (p) issues.push(`${where}: mentions a protected trait ("${p[0]}")`);
    // Budget splits ("shift 50%") and timing ("within 24 hours") in the plan are advice, not claims.
    const advice = /\d+\s?(?:%|(?:percent|hours?|hrs?|minutes?|mins?|days?|weeks?)\b)/gi;
    const checked =
      where === 'summary' || where.startsWith('schedule') ? text.replace(advice, ' ') : text;
    for (const n of checked.match(/\d+/g) ?? [])
      if (!allowedNumbers.has(n.replace(/^0+(?=\d)/, '')))
        issues.push(`${where}: number "${n}" isn't in the facts`);
  }
  return issues;
}

// No length limits in what we ask the model for: a long issue list must not fail the run. Trimmed after.
const ReviewSchema = z.object({ pass: z.boolean(), issues: z.array(z.string()) });

/** One LLM review for tone and logic against the facts (decision: critic = rules + one LLM pass). */
export async function llmReview(
  out: WriterOutput,
  facts: WriterFacts,
  deps: AgentDeps,
): Promise<{ pass: boolean; issues: string[] }> {
  if (!deps.llm) return { pass: true, issues: [] };
  const r = await deps.llm.object({
    tier: 'pro',
    schema: ReviewSchema,
    temperature: 0,
    system:
      'You review a concert campaign brief against its facts. Fail it only for real problems: a claim not supported by ' +
      'the facts, invented numbers, mentions of protected traits, copy that misrepresents the show, or a schedule step ' +
      'set more days out than the show is away. Leaving out an optional fact (a minor transit notice, a partner, a podcast) ' +
      'is NOT a failure. daysOut counts down to the show: 0 is show day, so a day-0 step is valid. Be brief and specific.',
    prompt: JSON.stringify({ facts, draft: out }),
  });
  return { pass: r.pass, issues: r.issues.slice(0, 8).map((i) => i.slice(0, 240)) };
}

export function report(
  p: Partial<CriticReport> & Pick<CriticReport, 'passed' | 'rounds' | 'reviewer'>,
): CriticReport {
  return { droppedClaims: 0, notes: [], ...p };
}
