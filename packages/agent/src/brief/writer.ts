import type { CopyVariant, RunResult } from '@housefull/shared';
import { z } from 'zod';
import type { AgentDeps } from '../deps.js';

/** What we ask the model for: loose, so one long line or a stringified number doesn't fail the brief. */
const LlmWriterSchema = z.object({
  summary: z.string(),
  segments: z.array(
    z.object({
      id: z.coerce.string(),
      copy: z.array(
        z.object({
          headline: z.string(),
          body: z.string(),
          cta: z.string().default('Get tickets'),
        }),
      ),
    }),
  ),
  schedule: z.array(
    z.object({
      daysOut: z.coerce.number(),
      action: z.string(),
      segmentId: z.coerce.string().default('all'),
    }),
  ),
});

/** What the brief stores: trimmed and bounded. */
export const WriterOutputSchema = z.object({
  summary: z.string().max(600),
  segments: z.array(
    z.object({
      id: z.string(),
      copy: z
        .array(
          z.object({
            headline: z.string().max(90),
            body: z.string().max(260),
            cta: z.string().max(40),
          }),
        )
        .min(1)
        .max(3),
    }),
  ),
  schedule: z
    .array(
      z.object({
        daysOut: z.number().int().min(0),
        action: z.string().max(240),
        segmentId: z.string(),
      }),
    )
    .max(14),
});
export type WriterOutput = z.infer<typeof WriterOutputSchema>;

export type WriterFacts = {
  show: {
    artist: string;
    venue: string;
    date: string;
    daysOut: number;
    soldPct?: number;
    budgetUsd?: number;
  };
  venueFit: { score: number; diagnosis: string; reasons: string[] };
  segments: Array<{
    id: string;
    name: string;
    fansOf: string[];
    tasteTags: string[];
    neighborhoods: string[];
    podcasts: string[];
    tvShows: string[];
    sourceCities?: string[];
  }>;
  openers: string[];
  partners: Array<{ place: string; offer: string; segmentId: string }>;
  conflicts: string[];
  /** F7: transit work and street events on show night, with what to do about them. */
  disruptions?: string[];
};

export const WRITER_SYSTEM = `You write a campaign brief for a concert promoter whose show isn't selling well enough.
Rules:
- Use ONLY the facts provided. Do not invent statistics, prices, percentages, attendance or sales numbers.
- Ad copy speaks to fans of the listed artists and taste tags. 3 variants per segment, each different in angle.
- Never target or mention age, gender, race, ethnicity, religion, sexuality or other protected traits.
- Openers are candidates the promoter might book, not confirmed acts: never name them in ad copy. Partner offers are drafts: don't promise them in copy either.
- The summary is 2–3 plain sentences: the venue-fit diagnosis, who the new buyers are, and the first move.
- The schedule counts down in days before the show (daysOut), uses segment ids or "all", and fits the time left.
- If there are show-night disruptions, add a last-week schedule step that warns fans, naming the lines or streets involved.`;

export function factsFrom(
  result: RunResult,
  extra: Omit<WriterFacts, 'show' | 'segments' | 'conflicts'>,
): WriterFacts {
  const daysOut = Math.max(
    0,
    Math.round((Date.parse(`${result.show.date}T20:00:00Z`) - Date.now()) / 86_400_000),
  );
  return {
    show: {
      artist: result.artist.name,
      venue: result.show.venue.name,
      date: result.show.date,
      daysOut,
      soldPct: result.show.soldPct,
      budgetUsd: result.show.budgetUsd,
    },
    segments: result.segments.map((s) => ({
      id: s.id,
      name: s.name,
      fansOf: s.seeds.map((x) => x.name),
      tasteTags: s.channels.adTargeting.interests,
      neighborhoods: s.neighborhoods.map((n) => n.name),
      podcasts: s.channels.podcasts.map((p) => p.name),
      tvShows: s.channels.tvShows.map((p) => p.name),
      sourceCities: s.sourceCities?.map((c) => c.metro),
    })),
    conflicts: result.conflicts.events.map((e) => `${e.name} at ${e.venue}`),
    ...extra,
  };
}

export async function writeWithLlm(
  facts: WriterFacts,
  deps: AgentDeps,
  issues: string[] = [],
): Promise<WriterOutput> {
  if (!deps.llm) throw new Error('No LLM configured');
  const raw = await deps.llm.object({
    tier: 'pro',
    schema: LlmWriterSchema,
    system: WRITER_SYSTEM,
    prompt: JSON.stringify({
      facts,
      ...(issues.length ? { fixTheseIssuesFromReview: issues } : {}),
    }),
  });
  const cut = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t);
  return WriterOutputSchema.parse({
    summary: cut(raw.summary, 600),
    segments: raw.segments
      .filter((s) => s.copy.length > 0)
      .map((s) => ({
        id: s.id,
        copy: s.copy.slice(0, 3).map((c) => ({
          headline: cut(c.headline, 90),
          body: cut(c.body, 260),
          cta: cut(c.cta, 40),
        })),
      })),
    schedule: raw.schedule
      .filter((x) => Number.isFinite(x.daysOut) && x.daysOut >= 0)
      .slice(0, 14)
      .map((x) => ({
        daysOut: Math.round(x.daysOut),
        action: cut(x.action, 240),
        segmentId: x.segmentId,
      })),
  });
}

/** Deterministic brief when no LLM is configured: plain, factual, no invented claims. */
export function writeTemplate(facts: WriterFacts): WriterOutput {
  const d = facts.show.daysOut;
  const copy = (s: WriterFacts['segments'][number]): CopyVariant[] => {
    const fans = s.fansOf.slice(0, 2).join(' or ');
    return [
      {
        headline: `Into ${fans}? See ${facts.show.artist}.`,
        body: `${facts.show.artist} plays ${facts.show.venue} on ${facts.show.date}.`,
        cta: 'Get tickets',
      },
      {
        headline: `${s.tasteTags.slice(0, 2).join(', ')} night at ${facts.show.venue}`,
        body: `For fans of ${s.fansOf.slice(0, 3).join(', ')}.`,
        cta: 'See the show',
      },
      {
        headline: `${facts.show.artist}, live`,
        body: `${facts.show.date} at ${facts.show.venue}. Tickets are still available.`,
        cta: 'Book now',
      },
    ];
  };
  const steps: Array<[number, string, string]> = [
    [
      Math.min(d, 21),
      'Launch paid social to each segment with variant A; set up tracking links per segment',
      'all',
    ],
    [Math.min(d, 14), 'Partner outreach: send the drafted offers to nearby bars and shops', 'all'],
    [
      Math.min(d, 10),
      'Podcast and newsletter placements for the top segment',
      facts.segments[0]?.id ?? 'all',
    ],
    [
      Math.min(d, 7),
      'Check results; shift budget to the segment with the best clicks per dollar',
      'all',
    ],
    [
      Math.min(d, 3),
      'Final push: variant C with the date front and centre; street-team the top neighborhoods',
      'all',
    ],
  ];
  return {
    summary: `${facts.venueFit.diagnosis} The best new buyers are fans of ${facts.segments
      .map((s) => s.fansOf[0])
      .filter(Boolean)
      .join(', ')}. Start with ${facts.segments[0]?.name ?? 'the top segment'}.`,
    segments: facts.segments.map((s) => ({ id: s.id, copy: copy(s) })),
    schedule: steps
      .filter(([days], i, a) => i === 0 || days < (a[i - 1]?.[0] as number))
      .map(([daysOut, action, segmentId]) => ({ daysOut, action, segmentId })),
  };
}
