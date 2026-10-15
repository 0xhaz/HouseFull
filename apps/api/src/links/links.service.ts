import { type Db, linkClicks, runs, trackingLinks } from '@housefull/db';
import { clickDedupeHash, generateCode, isSafeTargetUrl, utcDay } from '@housefull/feedback';
import type { TrackingLink } from '@housefull/shared';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { InjectDb } from '../db/db.module.js';

export type NewLink = Omit<TrackingLink, 'code' | 'runId'>;

@Injectable()
export class LinksService {
  private readonly salt: string;

  constructor(@InjectDb() private readonly db: Db) {
    const salt = process.env.CLICK_SALT;
    if (!salt && process.env.NODE_ENV === 'production')
      throw new Error('CLICK_SALT is required in production');
    this.salt = salt ?? 'dev-only-click-salt';
  }

  async create(runId: string, links: NewLink[]): Promise<TrackingLink[]> {
    for (const l of links)
      if (!isSafeTargetUrl(l.targetUrl))
        throw new BadRequestException(`Unsafe targetUrl: ${l.targetUrl}`);
    const [run] = await this.db.select({ id: runs.id }).from(runs).where(eq(runs.id, runId));
    if (!run) throw new NotFoundException(`Run ${runId} not found`);

    const created: TrackingLink[] = [];
    for (const l of links) {
      // Retry on the rare short-code collision.
      for (let attempt = 0; ; attempt++) {
        const code = generateCode(attempt < 3 ? 4 : 6);
        const [row] = await this.db
          .insert(trackingLinks)
          .values({ code, runId, ...l })
          .onConflictDoNothing()
          .returning();
        if (row) {
          created.push({ ...l, code, runId });
          break;
        }
        if (attempt > 5) throw new Error('Could not allocate a tracking code');
      }
    }
    return created;
  }

  /** Returns the target URL and logs the click with only a salted per-day hash. */
  async resolve(code: string, visitor: { ip: string; userAgent: string }): Promise<string | null> {
    const [link] = await this.db
      .select({ targetUrl: trackingLinks.targetUrl })
      .from(trackingLinks)
      .where(eq(trackingLinks.code, code));
    if (!link) return null;
    const day = utcDay();
    await this.db.insert(linkClicks).values({
      code,
      day,
      dedupeHash: clickDedupeHash({ ...visitor, day, salt: this.salt }),
    });
    return link.targetUrl;
  }
}
