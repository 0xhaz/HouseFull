import { type Db, runEvents } from '@housefull/db';
import type { RunEvent } from '@housefull/shared';
import { Injectable } from '@nestjs/common';
import { InjectDb } from '../db/db.module.js';

/**
 * Appends events to a run's ordered log. Writes are chained so `seq` order
 * matches emit order even though the agent emits synchronously.
 */
@Injectable()
export class RunEventLog {
  private readonly runs = new Map<string, { seq: number; chain: Promise<void> }>();

  constructor(@InjectDb() private readonly db: Db) {}

  open(runId: string) {
    this.runs.set(runId, { seq: 0, chain: Promise.resolve() });
  }

  append(runId: string, event: RunEvent) {
    const run = this.runs.get(runId);
    if (!run) return;
    const seq = ++run.seq;
    run.chain = run.chain.then(() =>
      this.db
        .insert(runEvents)
        .values({ runId, seq, event })
        .then(() => {}),
    );
  }

  /** Waits for every pending write, then forgets the run. */
  async close(runId: string) {
    await this.runs.get(runId)?.chain;
    this.runs.delete(runId);
  }
}
