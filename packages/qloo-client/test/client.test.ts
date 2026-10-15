import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  insightsQuery,
  MemoryBudget,
  MemoryCache,
  MemoryFixtures,
  type QlooCallRecord,
  QlooClient,
  QlooError,
  requestKey,
  TTL,
} from '../src/index.js';

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures', `${name}.json`), 'utf8'));

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

function setup(
  responses: Array<Response | Error>,
  extra: Partial<ConstructorParameters<typeof QlooClient>[0]> = {},
) {
  const queue = [...responses];
  const fetchMock = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
    const next = queue.shift();
    if (!next) throw new Error('unexpected fetch');
    if (next instanceof Error) throw next;
    return next;
  });
  const calls: QlooCallRecord[] = [];
  const cache = new MemoryCache();
  const setSpy = vi.spyOn(cache, 'set');
  const client = new QlooClient({
    apiKey: 'test-key-not-real',
    fetch: fetchMock as unknown as typeof fetch,
    sleep: async () => {},
    cache,
    trace: { record: (c) => void calls.push(c) },
    ...extra,
  });
  return { client, fetchMock, calls, setSpy };
}

const ARTIST = 'SYN-ARTIST-0001';
const ringParams = {
  filterType: 'urn:entity:artist' as const,
  signal: { entities: [ARTIST] },
  filter: { excludeEntities: [ARTIST], popularityMax: 0.7 },
  explainability: true,
  take: 20,
};

describe('insightsQuery', () => {
  it('maps typed params to Qloo dotted query keys and drops empties', () => {
    expect(insightsQuery({ ...ringParams, signal: { entities: [ARTIST], tags: [] } })).toEqual({
      'filter.type': 'urn:entity:artist',
      'signal.interests.entities': ARTIST,
      'filter.exclude.entities': ARTIST,
      'filter.popularity.max': '0.7',
      'feature.explainability': 'true',
      take: '20',
    });
  });
});

describe('requestKey', () => {
  it('ignores param order', () => {
    expect(requestKey('/v2/insights', { a: '1', b: '2' })).toBe(
      requestKey('/v2/insights', { b: '2', a: '1' }),
    );
    expect(requestKey('/v2/insights', { a: '1' })).not.toBe(requestKey('/search', { a: '1' }));
  });
});

describe('QlooClient', () => {
  it('sends the key as X-Api-Key and never records it in the trace', async () => {
    const { client, fetchMock, calls } = setup([json(fixture('insights-artist'))]);
    const res = await client.insights(ringParams, { runId: 'run-1' });

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(String(url)).toContain('https://hackathon.api.qloo.com/v2/insights?');
    expect((init.headers as Record<string, string>)['X-Api-Key']).toBe('test-key-not-real');
    expect(String(url)).not.toContain('test-key-not-real');

    expect(res.meta.source).toBe('live');
    expect(res.data.results.entities?.[0]?.name).toBe('Fixture Collective');
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      id: res.meta.callId,
      runId: 'run-1',
      source: 'live',
      cached: false,
    });
    expect(JSON.stringify(calls)).not.toContain('test-key-not-real');
    expect(calls[0]?.responseDigest).toMatchObject({ kind: 'entities', count: 2 });
  });

  it('serves the second identical call from cache without fetching', async () => {
    const { client, fetchMock, calls } = setup([json(fixture('insights-artist'))]);
    await client.insights(ringParams);
    const second = await client.insights(ringParams);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second.meta.source).toBe('cache');
    expect(calls[1]?.cached).toBe(true);
  });

  it('uses 72h for heatmaps, 7d for baselines, 24h otherwise', async () => {
    const heat = fixture('insights-heatmap');
    const { client, setSpy } = setup([json(fixture('insights-artist')), json(heat), json(heat)]);
    await client.insights(ringParams);
    await client.insights({ filterType: 'urn:heatmap', signal: { entities: [ARTIST] } });
    await client.insights(
      { filterType: 'urn:heatmap', signal: { tags: ['t1'] } },
      { baseline: true },
    );
    expect(setSpy.mock.calls.map((c) => c[2])).toEqual([TTL.default, TTL.heatmap, TTL.baseline]);
  });

  it('retries 429/5xx with backoff, then succeeds', async () => {
    const { client, fetchMock } = setup([
      json({}, 429, { 'retry-after': '1' }),
      json({}, 503),
      json(fixture('search-artist')),
    ]);
    const res = await client.search({ query: 'The Synthetic Band', types: ['urn:entity:artist'] });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(res.data.results[0]?.entity_id).toBe(ARTIST);
  });

  it('does not retry a 400 and does not cache failures', async () => {
    const { client, fetchMock, setSpy } = setup([json({ error: 'bad' }, 400)]);
    await expect(client.search({ query: 'x' })).rejects.toMatchObject({
      kind: 'http',
      status: 400,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(setSpy).not.toHaveBeenCalled();
  });

  it('falls back to a fixture after retries are exhausted', async () => {
    const q = insightsQuery(ringParams);
    const fixtures = new MemoryFixtures(
      new Map([[requestKey('/v2/insights', q), fixture('insights-artist')]]),
    );
    const { client, fetchMock } = setup([json({}, 500), json({}, 500), new Error('ECONNRESET')], {
      fixtures,
      maxRetries: 2,
    });
    const res = await client.insights(ringParams);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(res.meta.source).toBe('fixture');
  });

  it('never calls Qloo in demo mode', async () => {
    const q = insightsQuery(ringParams);
    const fixtures = new MemoryFixtures(
      new Map([[requestKey('/v2/insights', q), fixture('insights-artist')]]),
    );
    const { client, fetchMock } = setup([], { demoMode: true, apiKey: undefined, fixtures });
    expect((await client.insights(ringParams)).meta.source).toBe('fixture');
    await expect(client.search({ query: 'not recorded' })).rejects.toMatchObject({
      kind: 'unavailable',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('stops at the daily budget and the per-IP cap', async () => {
    const body = fixture('search-artist');
    const { client, fetchMock } = setup([json(body), json(body), json(body)], {
      budget: new MemoryBudget(2, 1),
    });
    await client.search({ query: 'a' }, { ipHash: 'ip-1' });
    await expect(client.search({ query: 'b' }, { ipHash: 'ip-1' })).rejects.toMatchObject({
      kind: 'budget',
    });
    await client.search({ query: 'c' }, { ipHash: 'ip-2' });
    await expect(client.search({ query: 'd' }, { ipHash: 'ip-3' })).rejects.toMatchObject({
      kind: 'budget',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(await client.remainingBudget()).toBe(0);
  });

  it('rejects an unexpected response shape without caching it', async () => {
    const { client, setSpy } = setup([json({ results: { entities: [{ name: 'no id' }] } })]);
    const err = await client.insights(ringParams).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(QlooError);
    expect((err as QlooError).kind).toBe('shape');
    expect(setSpy).not.toHaveBeenCalled();
  });

  it('records live responses as fixtures when asked', async () => {
    const fixtures = new MemoryFixtures();
    const { client } = setup([json(fixture('tags'))], { fixtures, recordFixtures: true });
    await client.tags({ query: 'live music venue' });
    expect(
      await fixtures.get(requestKey('/v2/tags', { 'filter.query': 'live music venue' })),
    ).toEqual(fixture('tags'));
  });

  it('requires an API key outside demo mode', () => {
    expect(() => new QlooClient({})).toThrow(QlooError);
  });
});
