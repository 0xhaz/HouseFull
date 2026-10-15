import type { Redis } from '@upstash/redis';
import type { BudgetDecision, BudgetStore, CacheStore } from './stores.js';
import { utcDay } from './stores.js';

const DAY_SECONDS = 60 * 60 * 24;

export class UpstashCache implements CacheStore {
  constructor(
    private readonly redis: Redis,
    private readonly prefix = 'qloo:cache:',
  ) {}

  async get(key: string) {
    const v = await this.redis.get<unknown>(this.prefix + key);
    return v ?? undefined;
  }

  async set(key: string, value: unknown, ttlSeconds: number) {
    await this.redis.set(this.prefix + key, value, { ex: ttlSeconds });
  }
}

/**
 * Daily counters keyed by UTC day. INCR first, then compare, so concurrent
 * requests can't both slip under the cap.
 */
export class UpstashBudget implements BudgetStore {
  constructor(
    private readonly redis: Redis,
    private readonly dailyLimit: number,
    private readonly perIpLimit: number,
    private readonly prefix = 'qloo:budget:',
  ) {}

  private async bump(key: string) {
    const n = await this.redis.incr(key);
    if (n === 1) await this.redis.expire(key, 2 * DAY_SECONDS);
    return n;
  }

  async consume(ipHash?: string): Promise<BudgetDecision> {
    const day = utcDay();
    if (ipHash) {
      const used = await this.bump(`${this.prefix}ip:${ipHash}:${day}`);
      if (used > this.perIpLimit) return { ok: false, reason: 'ip' };
    }
    const total = await this.bump(`${this.prefix}total:${day}`);
    if (total > this.dailyLimit) return { ok: false, reason: 'daily' };
    return { ok: true };
  }

  async remaining() {
    const used = (await this.redis.get<number>(`${this.prefix}total:${utcDay()}`)) ?? 0;
    return Math.max(0, this.dailyLimit - used);
  }
}
