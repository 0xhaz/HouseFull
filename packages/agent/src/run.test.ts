import { Ticketmaster } from '@housefull/events';
import { MemoryBudget, QlooClient } from '@housefull/qloo-client';
import { type RunEvent, RunResultSchema, type ShowInput } from '@housefull/shared';
import { describe, expect, it } from 'vitest';
import { describeDemographics, runAgent } from './run.js';
import { fakeFetch, geo } from './testkit.js';

const show: ShowInput = {
  artist: 'Synthetic Headliner',
  venue: { name: 'Test Hall', lat: 40.72, lng: -73.94 },
  city: 'nyc',
  date: '2026-11-20',
};

describe('runAgent', () => {
  it('runs steps 1–6 into a valid result with sourced claims', async () => {
    const calls: string[] = [];
    const events: RunEvent[] = [];
    const qloo = new QlooClient({
      apiKey: 'test',
      fetch: fakeFetch(calls),
      budget: new MemoryBudget(100, 100),
    });
    const result = await runAgent(show, {
      runId: 'r1',
      qloo,
      geo,
      ticketmaster: new Ticketmaster(),
      emit: (e) => events.push(e),
    });

    expect(RunResultSchema.safeParse(result).success).toBe(true);
    expect(result.artist.name).toBe('Synthetic Headliner');
    expect(result.segments.length).toBeGreaterThanOrEqual(2);
    for (const s of result.segments) {
      expect(s.seeds.length).toBeGreaterThan(0);
      expect(s.why.every((c) => c.sourceRef.length > 0)).toBe(true);
      expect(s.neighborhoods.length).toBeGreaterThan(0);
      expect(s.channels.partnerPlaces[0]?.distanceM).toBe(420);
    }
    expect(result.core.tags.map((t) => t.name)).toEqual(['Jazz', 'Intimate']);
    expect(result.core.demographics?.ageSkew).toContain('35 to 44');
    expect(result.conflicts).toMatchObject({ available: false });
    expect(result.access).toEqual({ mode: 'transit', method: 'gtfs' });

    const done = events
      .filter((e) => e.type === 'step' && e.status === 'done')
      .map((e) => (e as { step: string }).step);
    for (const s of ['resolve', 'core', 'ring', 'geography', 'channels', 'conflicts'])
      expect(done).toContain(s);
    // NYC: no visitor-source step.
    expect(done).not.toContain('visitors');
    // Budget: 1 search + 2 core + 1 ring + per segment (1 heatmap + 4 channels).
    expect(calls.length).toBe(4 + result.segments.length * 5);
  });

  it('adds visitor source cities in New Orleans', async () => {
    const qloo = new QlooClient({
      apiKey: 'test',
      fetch: fakeFetch([]),
      budget: new MemoryBudget(100, 100),
    });
    const events: RunEvent[] = [];
    await runAgent(
      { ...show, city: 'nola' },
      { runId: 'r2', qloo, geo, ticketmaster: new Ticketmaster(), emit: (e) => events.push(e) },
    );
    expect(
      events.some((e) => e.type === 'step' && e.step === 'visitors' && e.status !== 'started'),
    ).toBe(true);
  });

  it('fails clearly when the artist is unknown', async () => {
    const empty = (async () =>
      new Response(JSON.stringify({ results: [] }))) as unknown as typeof fetch;
    const qloo = new QlooClient({ apiKey: 'test', fetch: empty });
    await expect(
      runAgent(show, { runId: 'r3', qloo, geo, ticketmaster: new Ticketmaster(), emit: () => {} }),
    ).rejects.toThrow(/no artist matching/);
  });
});

describe('describeDemographics', () => {
  it('summarizes skews without listing every band', () => {
    expect(
      describeDemographics({
        age: { '25_to_29': 0.2, '35_to_44': 0.3, '55_and_older': -0.5 },
        gender: { male: -0.16 },
      }),
    ).toEqual({
      ageSkew: 'over-indexes 35 to 44 (+0.30), 25 to 29 (+0.20)',
      genderSkew: 'leans female (+0.16)',
    });
    expect(describeDemographics({}).ageSkew).toBe('no strong age skew');
  });
});
