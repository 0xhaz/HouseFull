import { createHash, randomUUID } from 'node:crypto';
import type { z } from 'zod';
import {
  compact,
  type InsightsParams,
  insightsQuery,
  type Query,
  type QueryValue,
} from './params.js';
import {
  AudiencesResponseSchema,
  CompareResponseSchema,
  EntitiesResponseSchema,
  InsightsResponseSchema,
  SearchResponseSchema,
  TagsResponseSchema,
} from './schemas.js';
import {
  type BudgetStore,
  type CacheStore,
  type FixtureStore,
  MemoryBudget,
  MemoryCache,
  noopTrace,
  type QlooCallRecord,
  type TraceSink,
} from './stores.js';

const HOUR = 60 * 60;

/** Cache TTLs from architecture §6.1. */
export const TTL = {
  default: 24 * HOUR,
  heatmap: 72 * HOUR,
  baseline: 7 * 24 * HOUR,
} as const;

export type CallContext = {
  runId?: string;
  /** Salted daily hash of the caller IP, for the per-IP cap. Never the raw IP. */
  ipHash?: string;
  /** Baseline heatmaps are kept for 7 days. */
  baseline?: boolean;
};

export type QlooResult<T> = {
  data: T;
  meta: {
    callId: string;
    source: 'live' | 'cache' | 'fixture';
    status: number;
    ms: number;
  };
};

export type QlooClientOptions = {
  apiKey?: string;
  baseUrl?: string;
  cache?: CacheStore;
  budget?: BudgetStore;
  fixtures?: FixtureStore;
  trace?: TraceSink;
  /** Serve fixtures only; never call Qloo. */
  demoMode?: boolean;
  /** Write live responses to the fixture store (preset recording). */
  recordFixtures?: boolean;
  /** Path for compare; confirmed by the probe (#9). */
  comparePath?: string;
  maxRetries?: number;
  timeoutMs?: number;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
};

export class QlooError extends Error {
  constructor(
    message: string,
    readonly kind: 'http' | 'budget' | 'unavailable' | 'shape',
    readonly status?: number,
  ) {
    super(message);
    this.name = 'QlooError';
  }
}

/** Stable cache/fixture key: endpoint + params sorted by name. */
export function requestKey(path: string, query: Query): string {
  const sorted = Object.keys(query)
    .sort()
    .map((k) => `${k}=${query[k]}`)
    .join('&');
  return createHash('sha256').update(`${path}?${sorted}`).digest('hex');
}

/** Small digest for qloo_calls: enough to back a claim, not the whole response. */
export function digest(body: unknown, top = 10): unknown {
  const results = (body as { results?: unknown } | null)?.results;
  const pick = (items: unknown[]) => ({
    count: items.length,
    top: items.slice(0, top).map((raw) => {
      const i = raw as Record<string, unknown>;
      const q = (i.query ?? {}) as Record<string, unknown>;
      const loc = (i.location ?? {}) as Record<string, unknown>;
      return {
        id: i.entity_id ?? i.id ?? i.tag_id ?? loc.geohash,
        name: i.name,
        affinity: q.affinity,
      };
    }),
  });
  if (Array.isArray(results)) return pick(results);
  if (results && typeof results === 'object') {
    for (const [k, v] of Object.entries(results))
      if (Array.isArray(v)) return { kind: k, ...pick(v) };
  }
  return { count: 0 };
}

const RETRYABLE = new Set([429, 500, 502, 503, 504]);

export class QlooClient {
  private readonly baseUrl: string;
  private readonly cache: CacheStore;
  private readonly budget: BudgetStore;
  private readonly trace: TraceSink;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(private readonly opts: QlooClientOptions = {}) {
    this.baseUrl = opts.baseUrl ?? 'https://hackathon.api.qloo.com';
    this.cache = opts.cache ?? new MemoryCache();
    this.budget = opts.budget ?? new MemoryBudget(1500, 200);
    this.trace = opts.trace ?? noopTrace;
    this.fetchImpl = opts.fetch ?? fetch;
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    if (!opts.demoMode && !opts.apiKey) {
      throw new QlooError('QLOO_API_KEY is required unless demoMode is on', 'unavailable');
    }
  }

  search(p: { query: string; types?: string[]; take?: number }, ctx?: CallContext) {
    const q = compact({ query: p.query, types: p.types?.join(','), take: p.take });
    return this.request('/search', q, SearchResponseSchema, ctx);
  }

  /** Full entities (with properties: address, phone, website, hours…) by id. Probe: max 50 ids. */
  entities(ids: string[], ctx?: CallContext) {
    return this.request(
      '/entities',
      compact({ entity_ids: [...new Set(ids)].sort().join(',') }),
      EntitiesResponseSchema,
      ctx,
    );
  }

  tags(p: { query: string; take?: number; extra?: Record<string, QueryValue> }, ctx?: CallContext) {
    const q = compact({ 'filter.query': p.query, take: p.take, ...p.extra });
    return this.request('/v2/tags', q, TagsResponseSchema, ctx);
  }

  audiences(
    p: { query?: string; take?: number; extra?: Record<string, QueryValue> },
    ctx?: CallContext,
  ) {
    const q = compact({ 'filter.query': p.query, take: p.take, ...p.extra });
    return this.request('/v2/audiences', q, AudiencesResponseSchema, ctx);
  }

  insights(p: InsightsParams, ctx?: CallContext) {
    return this.request('/v2/insights', insightsQuery(p), InsightsResponseSchema, ctx);
  }

  /** Raw dotted params: `a.signal.interests.entities`, `b.signal.interests.entities` (entities only, both sides). */
  compare(params: Record<string, QueryValue>, ctx?: CallContext) {
    const path = this.opts.comparePath ?? '/v2/insights/compare';
    return this.request(path, compact(params), CompareResponseSchema, ctx);
  }

  remainingBudget() {
    return this.budget.remaining();
  }

  private ttlFor(query: Query, ctx?: CallContext) {
    if (ctx?.baseline) return TTL.baseline;
    if (query['filter.type'] === 'urn:heatmap') return TTL.heatmap;
    return TTL.default;
  }

  private async request<S extends z.ZodType>(
    path: string,
    query: Query,
    schema: S,
    ctx?: CallContext,
  ): Promise<QlooResult<z.infer<S>>> {
    const key = requestKey(path, query);
    const started = performance.now();

    const finish = async (
      body: unknown,
      source: QlooCallRecord['source'],
      status: number,
    ): Promise<QlooResult<z.infer<S>>> => {
      const data = schema.parse(body);
      const call: QlooCallRecord = {
        id: randomUUID(),
        runId: ctx?.runId,
        endpoint: path,
        params: query,
        status,
        ms: Math.round(performance.now() - started),
        source,
        cached: source !== 'live',
        responseDigest: digest(body),
        createdAt: new Date().toISOString(),
      };
      await this.trace.record(call);
      return { data, meta: { callId: call.id, source, status, ms: call.ms } };
    };

    const fromFixture = async (reason: string, status?: number) => {
      const fx = await this.opts.fixtures?.get(key);
      if (fx === undefined) {
        const kind = reason === 'budget' ? 'budget' : status ? 'http' : 'unavailable';
        throw new QlooError(`Qloo ${path} failed (${reason}) and no fixture exists`, kind, status);
      }
      return finish(fx, 'fixture', 200);
    };

    if (this.opts.demoMode) return fromFixture('demo mode');

    const cached = await this.cache.get(key);
    if (cached !== undefined) return finish(cached, 'cache', 200);

    const url = new URL(path, this.baseUrl);
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);

    const maxRetries = this.opts.maxRetries ?? 3;
    let lastStatus: number | undefined;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const decision = await this.budget.consume(ctx?.ipHash);
      if (!decision.ok) return fromFixture('budget');

      let res: Response;
      try {
        res = await this.fetchImpl(url, {
          headers: { 'X-Api-Key': this.opts.apiKey as string, Accept: 'application/json' },
          signal: AbortSignal.timeout(this.opts.timeoutMs ?? 15_000),
        });
      } catch {
        lastStatus = undefined;
        if (attempt < maxRetries) await this.sleep(backoff(attempt));
        continue;
      }

      lastStatus = res.status;
      if (res.ok) {
        const body: unknown = await res.json();
        const parsed = schema.safeParse(body);
        if (!parsed.success) {
          throw new QlooError(
            `Unexpected ${path} response shape: ${parsed.error.message}`,
            'shape',
            res.status,
          );
        }
        await this.cache.set(key, body, this.ttlFor(query, ctx));
        if (this.opts.recordFixtures) await this.opts.fixtures?.set?.(key, body);
        return finish(body, 'live', res.status);
      }
      // 403 here usually means an unsupported entity type, so retrying won't help.
      if (!RETRYABLE.has(res.status)) break;
      if (attempt < maxRetries) await this.sleep(backoff(attempt, res.headers.get('retry-after')));
    }
    return fromFixture(lastStatus ? `HTTP ${lastStatus}` : 'network', lastStatus);
  }
}

function backoff(attempt: number, retryAfter?: string | null) {
  const hinted = retryAfter ? Number(retryAfter) * 1000 : Number.NaN;
  if (Number.isFinite(hinted) && hinted > 0) return Math.min(hinted, 10_000);
  return 250 * 4 ** attempt + Math.random() * 100;
}
