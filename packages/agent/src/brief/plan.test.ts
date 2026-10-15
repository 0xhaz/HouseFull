import { Ticketmaster } from '@housefull/events';
import { MemoryBudget, type QlooCallRecord, QlooClient } from '@housefull/qloo-client';
import { CampaignBriefSchema, type RunEvent, type ShowInput } from '@housefull/shared';
import { describe, expect, it } from 'vitest';
import type { AgentDeps } from '../deps.js';
import type { LlmAdapter } from '../llm.js';
import { runAgent } from '../run.js';
import { fakeFetch, geo } from '../testkit.js';
import { checkText } from './critic.js';
import { planBrief } from './plan.js';
import { writeTemplate } from './writer.js';

const show: ShowInput = {
  artist: 'Synthetic Headliner',
  venue: { name: 'Test Hall', lat: 40.72, lng: -73.94 },
  city: 'nyc',
  date: '2026-11-20', // a Friday
};

function setup(llm?: LlmAdapter) {
  const calls: QlooCallRecord[] = [];
  const events: RunEvent[] = [];
  const qloo = new QlooClient({
    apiKey: 'test',
    fetch: fakeFetch([]),
    budget: new MemoryBudget(500, 500),
    trace: { record: (c) => void calls.push(c) },
  });
  const deps: AgentDeps = {
    runId: 'r1',
    qloo,
    geo,
    ticketmaster: new Ticketmaster(),
    llm,
    emit: (e) => events.push(e),
    knownCallIds: async () => new Set(calls.map((c) => c.id)),
  };
  return { deps, events, calls };
}

/** Scripted LLM: answers by schema shape; the first draft mentions a protected trait. */
function fakeLlm(): LlmAdapter & { drafts: number } {
  const llm = {
    name: 'fake-llm',
    drafts: 0,
    async text() {
      return 'Target young professionals on Instagram.';
    },
    async object({
      schema,
      prompt,
    }: {
      schema: { parse: (x: unknown) => unknown };
      prompt: string;
    }) {
      const p = JSON.parse(prompt);
      if (p.segments && !p.facts) return schema.parse({ segments: [] }); // segment naming: keep fallbacks
      if (p.places) return schema.parse({ deals: [] }); // partner drafts: keep templates
      if (p.draft) {
        const bad = JSON.stringify(p.draft).includes('women');
        return schema.parse({ pass: !bad, issues: bad ? ['mentions a protected trait'] : [] });
      }
      llm.drafts += 1;
      const facts = p.facts;
      return schema.parse({
        summary: `${facts.venueFit.diagnosis} Lead with ${facts.segments[0].name}.`,
        segments: facts.segments.map((s: { id: string; fansOf: string[] }) => ({
          id: s.id,
          copy: [
            {
              headline:
                llm.drafts === 1 ? 'Calling all women who love jazz' : `Into ${s.fansOf[0]}?`,
              body: `${facts.show.artist} at ${facts.show.venue}.`,
              cta: 'Get tickets',
            },
          ],
        })),
        schedule: [{ daysOut: 7, action: 'Launch ads', segmentId: 'all' }],
      });
    },
  };
  return llm as unknown as LlmAdapter & { drafts: number };
}

describe('planBrief', () => {
  it('builds a valid brief with the template when no LLM is configured', async () => {
    const { deps, events } = setup();
    const brief = await planBrief(await runAgent(show, deps), deps);

    expect(CampaignBriefSchema.safeParse(brief).success).toBe(true);
    expect(brief.writer).toBe('template');
    expect(brief.critic).toMatchObject({ reviewer: 'deterministic', droppedClaims: 0 });
    expect(brief.baselineComparison).toBeUndefined();
    expect(brief.venueFit.score).toBeGreaterThanOrEqual(0);
    expect(brief.venueFit.reasons.length).toBeGreaterThan(0);
    // Mood: "Intimate" is in both the venue's ambience and the artist's tags.
    expect(brief.venueFit.reasons.some((r) => r.text.includes('Intimate'))).toBe(true);
    expect(brief.openers.length).toBeGreaterThan(0);
    expect(brief.openers[0]?.openerScore).toBeGreaterThan(0);
    expect(brief.openers[0]?.bringsSegments.length).toBeGreaterThan(0);
    // Partners: bars open before doors only. The cafe closes at 15:00; the tattoo shop isn't a partner kind.
    expect(brief.partnerDeals.map((d) => d.place.name)).toEqual(['Synthetic Bar']);
    expect(brief.partnerDeals[0]?.place.hours).toBe('17:00–02:00');
    for (const s of brief.segments) expect(s.copy.length).toBe(3);
    const steps = events
      .filter((e) => e.type === 'step' && e.status === 'done')
      .map((e) => (e as { step: string }).step);
    for (const s of ['venueFit', 'openers', 'partners', 'brief', 'critic'])
      expect(steps).toContain(s);
  });

  it('rewrites copy that fails the critic and adds the Without-Qloo comparison', async () => {
    const llm = fakeLlm();
    const { deps } = setup(llm);
    const brief = await planBrief(await runAgent(show, deps), deps);
    expect(llm.drafts).toBe(2);
    expect(brief.critic).toMatchObject({ rounds: 2, passed: true, reviewer: 'fake-llm' });
    expect(JSON.stringify(brief.segments)).not.toContain('women');
    expect(brief.baselineComparison?.llmOnly).toContain('Instagram');
    expect(brief.writer).toBe('fake-llm');
  });

  it('drops claims whose source is not a Qloo call from this run', async () => {
    const { deps } = setup();
    const result = await runAgent(show, deps);
    const seg0 = result.segments[0];
    if (seg0) seg0.why.push({ text: 'Fabricated claim', sourceRef: 'not-a-call' });
    const brief = await planBrief(result, deps);
    expect(brief.critic.droppedClaims).toBe(1);
    expect(JSON.stringify(brief)).not.toContain('Fabricated claim');
    expect(brief.warnings.some((w) => w.includes('1 claim removed'))).toBe(true);
  });
});

describe('checkText names', () => {
  it('does not flag trait words inside artist names', () => {
    const facts = {
      show: { artist: 'Men I Trust', venue: 'V', date: '2026-11-20', daysOut: 30 },
      venueFit: { score: 64, diagnosis: 'ok', reasons: [] },
      segments: [
        {
          id: 's1',
          name: 'S',
          fansOf: ['TV Girl'],
          tasteTags: [],
          neighborhoods: [],
          podcasts: [],
          tvShows: [],
        },
      ],
      openers: [],
      partners: [],
      conflicts: [],
    };
    const out = { ...writeTemplate(facts), summary: 'Fans of TV Girl will love Men I Trust.' };
    expect(checkText(out, facts)).toEqual([]);
    expect(checkText({ ...out, summary: 'Perfect for men who love TV Girl.' }, facts)[0]).toContain(
      'protected trait',
    );
  });
});

describe('checkText', () => {
  it('flags numbers that are not in the facts and protected traits', () => {
    const facts = {
      show: { artist: 'A', venue: 'V', date: '2026-11-20', daysOut: 30 },
      venueFit: { score: 64, diagnosis: 'ok', reasons: [] },
      segments: [
        {
          id: 's1',
          name: 'S',
          fansOf: ['X'],
          tasteTags: [],
          neighborhoods: [],
          podcasts: [],
          tvShows: [],
        },
      ],
      openers: [],
      partners: [],
      conflicts: [],
    };
    const out = writeTemplate(facts);
    expect(checkText(out, facts)).toEqual([]);
    const advice = {
      ...out,
      schedule: [
        { daysOut: 14, action: 'Shift 50% of budget to the winner', segmentId: 'all' },
        { daysOut: 1, action: 'Email ticket holders 24 hours before doors', segmentId: 'all' },
      ],
    };
    expect(checkText(advice, facts)).toEqual([]);
    const bad = { ...out, summary: 'Over 5000 fans in their 20s are waiting.' };
    const issues = checkText(bad, facts);
    expect(issues.some((i) => i.includes('"5000"'))).toBe(true);
    expect(issues.some((i) => i.includes('protected trait'))).toBe(true);
  });
});
