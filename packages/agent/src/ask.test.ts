import { describe, expect, it } from 'vitest';
import { type AskFacts, askWorkspace, resolveCites } from './ask.js';
import type { LlmAdapter } from './llm.js';

const facts: AskFacts = {
  workspace: { name: 'Demo', persona: 'promoter', profile: {} },
  today: '2026-10-14',
  shows: [
    {
      ref: 'S1',
      runId: 'run-1',
      show: {
        artist: 'TV Girl',
        venue: { name: 'Brooklyn Steel', lat: 40.7, lng: -73.9 },
        city: 'nyc',
        date: '2026-11-20',
        soldPct: 46,
      },
      daysOut: 37,
      version: 2,
      summary: 'Indie fans nearby.',
      venueFit: 60,
      segments: [
        {
          id: 's1',
          name: 'Bedroom pop',
          fansOf: ['Clairo'],
          neighborhoods: ['Williamsburg'],
          sourceCities: [],
          reasons: [{ text: 'Loves Clairo', sourceRef: 'call-9' }],
        },
      ],
      openers: [],
      partners: [],
    },
  ],
};

const llm = (out: unknown): LlmAdapter => ({
  name: 'fake',
  object: async () => out as never,
  text: async () => '',
});

describe('askWorkspace', () => {
  it('keeps only citations that exist in the facts', () => {
    expect(resolveCites(['S1', 'S1/s1', 'S1/s9', 'S7', 'call-9', 'nope'], facts)).toEqual([
      {
        ref: 'S1',
        runId: 'run-1',
        segmentId: undefined,
        label: 'TV Girl at Brooklyn Steel, Nov 20',
      },
      { ref: 'S1/s1', runId: 'run-1', segmentId: 's1', label: 'TV Girl, Nov 20: Bedroom pop' },
    ]);
  });

  it('answers with resolved sources', async () => {
    const r = await askWorkspace(
      'Where should I spend?',
      facts,
      llm({ answer: ' Put it on Bedroom pop. ', cites: ['S1/s1'], followUps: ['Why?', ''] }),
    );
    expect(r.answer).toBe('Put it on Bedroom pop.');
    expect(r.sources).toHaveLength(1);
    expect(r.followUps).toEqual(['Why?']);
  });

  it('refuses trait-based answers but not artist names that contain trait words', async () => {
    const ok = await askWorkspace(
      'q',
      facts,
      llm({ answer: 'TV Girl fans in Williamsburg.', cites: [], followUps: [] }),
    );
    expect(ok.answer).toBe('TV Girl fans in Williamsburg.');
    const bad = await askWorkspace(
      'q',
      facts,
      llm({ answer: 'Target young women.', cites: ['S1'], followUps: [] }),
    );
    expect(bad.answer).toMatch(/can’t answer in terms of age, gender/);
    expect(bad.sources).toEqual([]);
  });

  it('needs shows and a model', async () => {
    expect((await askWorkspace('q', { ...facts, shows: [] }, undefined)).answer).toMatch(
      /no shows/,
    );
    expect((await askWorkspace('q', facts, undefined)).answer).toMatch(/isn’t configured/);
  });
});
