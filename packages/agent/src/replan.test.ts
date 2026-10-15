import { Ticketmaster } from '@housefull/events';
import { scoreSegments } from '@housefull/feedback';
import { MemoryBudget, type QlooCallRecord, QlooClient } from '@housefull/qloo-client';
import { CampaignBriefSchema, type ShowInput } from '@housefull/shared';
import { describe, expect, it } from 'vitest';
import { planBrief } from './brief/plan.js';
import type { AgentDeps } from './deps.js';
import { NotReadyForReplan, replan } from './replan.js';
import { runAgent } from './run.js';
import { fakeFetch, geo } from './testkit.js';

const show: ShowInput = {
  artist: 'Synthetic Headliner',
  venue: { name: 'Test Hall', lat: 40.72, lng: -73.94 },
  city: 'nyc',
  date: '2099-11-20',
};

async function setup() {
  const calls: QlooCallRecord[] = [];
  const deps: AgentDeps = {
    runId: 'r1',
    qloo: new QlooClient({
      apiKey: 'test',
      fetch: fakeFetch([]),
      budget: new MemoryBudget(500, 500),
      trace: { record: (c) => void calls.push(c) },
    }),
    geo,
    ticketmaster: new Ticketmaster(),
    emit: () => {},
    knownCallIds: async () => new Set(calls.map((c) => c.id)),
  };
  const brief = await planBrief(await runAgent(show, deps), deps);
  return { deps, brief };
}

describe('replan', () => {
  it('refuses thin data unless forced', async () => {
    const { deps, brief } = await setup();
    const ids = brief.segments.map((s) => s.id);
    const board = scoreSegments(ids, [
      {
        source: 'links',
        at: new Date(),
        bySegment: ids.map((id) => ({ segmentId: id, clicks: 5 })),
      },
    ]);
    await expect(replan(brief, 1, board, deps)).rejects.toBeInstanceOf(NotReadyForReplan);
    const forced = await replan(brief, 1, board, deps, { force: true });
    expect(forced.result.toVersion).toBe(2);
  });

  it('shifts budget to the winner, adds lookalikes, drops a clear loser and keeps claims sourced', async () => {
    const { deps, brief } = await setup();
    const [a, b] = brief.segments;
    // Three segments so one can be dropped; the fake ring gives two clusters, so add a copy.
    const three = {
      ...brief,
      segments: [...brief.segments, { ...(b as typeof a & object), id: 's9', name: 'Spare' }],
    };
    const board = scoreSegments(
      three.segments.map((s) => s.id),
      [
        {
          source: 'manual',
          at: new Date(),
          bySegment: [
            { segmentId: a?.id as string, sales: 6, spendUsd: 60 },
            { segmentId: b?.id as string, sales: 2, spendUsd: 60 },
            { segmentId: 's9', sales: 1, spendUsd: 90 },
          ],
        },
      ],
    );
    const { brief: next, result } = await replan(three, 1, board, deps);
    expect(CampaignBriefSchema.safeParse(next).success).toBe(true);
    const kinds = result.changes.map((c) => c.kind);
    expect(kinds).toEqual(
      expect.arrayContaining(['new_segment', 'drop_segment', 'budget', 'schedule']),
    );
    expect(next.segments.some((s) => s.id === 's9')).toBe(false);
    const added = next.segments.find((s) => s.name.startsWith('More like'));
    expect(added?.seeds.length).toBeGreaterThanOrEqual(2);
    const usedBefore = new Set(three.segments.flatMap((s) => s.seeds.map((x) => x.entityId)));
    expect(added?.seeds.every((s) => !usedBefore.has(s.entityId))).toBe(true);
    expect(added?.copy.length).toBeGreaterThan(0);
    expect(next.segments.flatMap((s) => s.why).every((c) => c.sourceRef.length > 0)).toBe(true);
    expect(result.summary).toContain('$10.00 per sale');
    expect(next.schedule[0]?.action).toMatch(/Added|Moved/);
  });
});
