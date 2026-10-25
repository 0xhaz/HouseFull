import type { Persona, ShowInput, WorkspaceProfile } from '@housefull/shared';
import { z } from 'zod';
import { protectedTraitIn } from './brief/critic.js';
import type { LlmAdapter } from './llm.js';

/** One show as the model sees it. `ref` (S1, S2…) is what answers cite. */
export type AskShow = {
  ref: string;
  runId: string;
  show: ShowInput;
  daysOut: number;
  version: number;
  summary: string | null;
  venueFit: number | null;
  dueNow?: string;
  segments: Array<{
    id: string;
    name: string;
    fansOf: string[];
    neighborhoods: string[];
    sourceCities: string[];
    /** Explainability-backed reasons; `sourceRef` is the Qloo call id. */
    reasons: Array<{ text: string; sourceRef: string }>;
  }>;
  openers: string[];
  partners: string[];
  results?: {
    ready: boolean;
    reason: string;
    sample: boolean;
    bySegment: Array<{ segmentId: string; clicks: number; sales: number; spendUsd: number }>;
    missing: string[];
  };
  /** Post-show survey: satisfaction per audience (taste-attributed). */
  survey?: {
    responses: number;
    sample: boolean;
    avgRating: number | null;
    wouldReturnPct: number | null;
    bySegment: Array<{
      segmentId: string;
      name: string;
      responses: number;
      avgRating: number | null;
      wouldReturnPct: number | null;
    }>;
    heardVia: Array<{ channel: string; share: number }>;
  };
};

export type AskFacts = {
  workspace: { name: string; persona: Persona; profile: WorkspaceProfile };
  today: string;
  shows: AskShow[];
};

export type AskSource = { ref: string; runId: string; segmentId?: string; label: string };
export type AskResult = { answer: string; sources: AskSource[]; followUps: string[] };

// Lenient for the model; trimmed and validated after.
const LlmAnswerSchema = z.object({
  answer: z.string(),
  cites: z.array(z.string()),
  followUps: z.array(z.string()),
});

const PERSONA_LENS: Record<Persona, string> = {
  promoter: 'a promoter selling several shows: think about budget, risk and what to do this week',
  venue: 'a venue: think about the room’s audience across shows, its calendar and local partners',
  artist: 'an artist team on tour: think about how audiences differ or carry across cities',
};

const SYSTEM = (persona: Persona) =>
  [
    `You answer questions for ${PERSONA_LENS[persona]}, using ONLY the facts given (their campaign briefs and results).`,
    'Be direct and practical: lead with the answer, then the reason, in at most 120 words. Plain sentences, no markdown headings.',
    'Every claim must come from the facts. If the facts don’t cover the question, say what is missing and what would answer it (e.g. "check in results first").',
    'Never invent numbers. Only use numbers that appear in the facts.',
    'Never describe or target people by age, gender, ethnicity, religion or sexuality; audiences are defined by taste.',
    'Refer to audiences by their name, never by id (say "Dream Pop & Ethereal Indie", not "s2"), and to shows by artist and venue, never by ref.',
    'Results or surveys marked sample:true are sample data: say so if you rely on them.',
    'A show’s survey is what attendees said after the show (rating out of 5, % who would come back), per audience.',
    'In `cites`, list what you used: a show ref like "S1", a segment like "S1/s2", or a reason sourceRef. Up to 5.',
    'In `followUps`, suggest up to 3 short next questions this user might ask.',
  ].join('\n');

/** "Ask your workspace": one grounded answer over the workspace's briefs, with checked citations. */
export async function askWorkspace(
  question: string,
  facts: AskFacts,
  llm: LlmAdapter | undefined,
): Promise<AskResult> {
  if (!facts.shows.length)
    return {
      answer: 'There are no shows in this workspace yet. Plan one and ask again.',
      sources: [],
      followUps: [],
    };
  if (!llm)
    return {
      answer: 'Asking needs the language model, which isn’t configured on this server.',
      sources: [],
      followUps: [],
    };

  const r = await llm.object({
    tier: 'fast',
    temperature: 0.2,
    schema: LlmAnswerSchema,
    system: SYSTEM(facts.workspace.persona),
    prompt: JSON.stringify({ question, facts }),
  });

  const names = facts.shows.flatMap((s) => [
    s.show.artist,
    s.show.venue.name,
    ...s.segments.flatMap((g) => [g.name, ...g.fansOf, ...g.neighborhoods, ...g.sourceCities]),
    ...s.openers,
    ...s.partners,
  ]);
  const trait = protectedTraitIn(`${r.answer} ${r.followUps.join(' ')}`, names);
  if (trait)
    return {
      answer:
        'I can’t answer in terms of age, gender or other personal traits. HouseFull describes audiences by taste: try asking which audience or neighborhood is doing best.',
      sources: [],
      followUps: ['Which audience is converting best?', 'Where should the next ad dollars go?'],
    };

  return {
    answer: r.answer.trim().slice(0, 1200),
    sources: resolveCites(r.cites, facts),
    followUps: r.followUps
      .map((f) => f.trim())
      .filter(Boolean)
      .slice(0, 3),
  };
}

const shortDate = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});
const when = (s: AskShow) => shortDate.format(new Date(`${s.show.date}T00:00:00Z`));

/** Keeps only citations that point at something in the facts; anything else is dropped. */
export function resolveCites(cites: string[], facts: AskFacts): AskSource[] {
  const out = new Map<string, AskSource>();
  for (const raw of cites) {
    const c = raw.trim();
    const [showRef, segId] = c.split('/');
    const show = facts.shows.find((s) => s.ref === showRef);
    if (show) {
      const seg = segId ? show.segments.find((g) => g.id === segId) : undefined;
      if (segId && !seg) continue;
      const key = seg ? `${show.ref}/${seg.id}` : show.ref;
      out.set(key, {
        ref: key,
        runId: show.runId,
        segmentId: seg?.id,
        label: seg
          ? `${show.show.artist}, ${when(show)}: ${seg.name}`
          : `${show.show.artist} at ${show.show.venue.name}, ${when(show)}`,
      });
      continue;
    }
    // A Qloo call id behind one of the reasons.
    for (const s of facts.shows)
      for (const g of s.segments)
        if (g.reasons.some((x) => x.sourceRef === c))
          out.set(`${s.ref}/${g.id}`, {
            ref: `${s.ref}/${g.id}`,
            runId: s.runId,
            segmentId: g.id,
            label: `${s.show.artist}, ${when(s)}: ${g.name}`,
          });
  }
  return [...out.values()].slice(0, 5);
}
