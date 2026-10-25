import { type Db, runEvents } from '@housefull/db';
import type { RunEvent } from '@housefull/shared';
import { Injectable, Logger } from '@nestjs/common';
import { InjectDb } from '../db/db.module.js';

/**
 * Appends events to a run's ordered log. Writes are chained so `seq` order
 * matches emit order even though the agent emits synchronously.
 */
@Injectable()
export class RunEventLog {
  private readonly logger = new Logger(RunEventLog.name);
  private readonly runs = new Map<string, { seq: number; chain: Promise<void>; gone?: boolean }>();

  constructor(@InjectDb() private readonly db: Db) {}

  open(runId: string) {
    this.runs.set(runId, { seq: 0, chain: Promise.resolve() });
  }

  append(runId: string, event: RunEvent) {
    const run = this.runs.get(runId);
    if (!run) return;
    const seq = ++run.seq;
    // A failed write must never reject the chain: nothing awaits it until close(), and an
    // unhandled rejection takes the whole API down. The usual cause is the run being deleted
    // mid-flight (its workspace was removed); stop writing for it then.
    run.chain = run.chain.then(async () => {
      if (run.gone) return;
      try {
        await this.db.insert(runEvents).values({ runId, seq, event });
      } catch (e) {
        run.gone = true;
        this.logger.warn(
          `run ${runId}: event log write failed, dropping the rest (${(e as Error).message.split('\n')[0]})`,
        );
      }
    });
  }

  /** Waits for every pending write, then forgets the run. */
  async close(runId: string) {
    await this.runs.get(runId)?.chain;
    this.runs.delete(runId);
  }
}
