import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Response cache. Values are parsed JSON bodies. */
export interface CacheStore {
  get(key: string): Promise<unknown | undefined>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
}

export type BudgetDecision = { ok: true } | { ok: false; reason: 'daily' | 'ip' };

/** Counts live Qloo requests: a global daily cap plus a per-IP daily cap. */
export interface BudgetStore {
  consume(ipHash?: string): Promise<BudgetDecision>;
  remaining(): Promise<number>;
}

/** Recorded responses for presets and demo mode. Never stored in the public repo. */
export interface FixtureStore {
  get(key: string): Promise<unknown | undefined>;
  set?(key: string, value: unknown): Promise<void>;
}

export type QlooCallRecord = {
  /** Becomes `sourceRef` on every claim built from this call. */
  id: string;
  runId?: string;
  endpoint: string;
  params: Record<string, string>;
  status: number;
  ms: number;
  source: 'live' | 'cache' | 'fixture';
  cached: boolean;
  /** Trimmed: count + top items only. */
  responseDigest: unknown;
  createdAt: string;
};

/** Persists calls (qloo_calls table) and streams them to the run view. */
export interface TraceSink {
  record(call: QlooCallRecord): void | Promise<void>;
}

export const utcDay = (now = new Date()) => now.toISOString().slice(0, 10);

export class MemoryCache implements CacheStore {
  private readonly map = new Map<string, { value: unknown; expires: number }>();
  constructor(private readonly now: () => number = Date.now) {}

  async get(key: string) {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (hit.expires <= this.now()) {
      this.map.delete(key);
      return undefined;
    }
    return hit.value;
  }

  async set(key: string, value: unknown, ttlSeconds: number) {
    this.map.set(key, { value, expires: this.now() + ttlSeconds * 1000 });
  }
}

export class MemoryBudget implements BudgetStore {
  private day = utcDay();
  private total = 0;
  private readonly perIp = new Map<string, number>();

  constructor(
    private readonly dailyLimit: number,
    private readonly perIpLimit: number,
  ) {}

  private roll() {
    const today = utcDay();
    if (today !== this.day) {
      this.day = today;
      this.total = 0;
      this.perIp.clear();
    }
  }

  async consume(ipHash?: string): Promise<BudgetDecision> {
    this.roll();
    if (this.total >= this.dailyLimit) return { ok: false, reason: 'daily' };
    if (ipHash) {
      const used = this.perIp.get(ipHash) ?? 0;
      if (used >= this.perIpLimit) return { ok: false, reason: 'ip' };
      this.perIp.set(ipHash, used + 1);
    }
    this.total += 1;
    return { ok: true };
  }

  async remaining() {
    this.roll();
    return Math.max(0, this.dailyLimit - this.total);
  }
}

export class MemoryFixtures implements FixtureStore {
  constructor(private readonly map = new Map<string, unknown>()) {}
  async get(key: string) {
    return this.map.get(key);
  }
  async set(key: string, value: unknown) {
    this.map.set(key, value);
  }
}

/** Reads `<dir>/<key>.json` (local dev only; the folder is gitignored). */
export class FileFixtures implements FixtureStore {
  constructor(private readonly dir: string) {}
  async get(key: string) {
    try {
      return JSON.parse(await readFile(join(this.dir, `${key}.json`), 'utf8'));
    } catch {
      return undefined;
    }
  }
}

export const noopTrace: TraceSink = { record() {} };
