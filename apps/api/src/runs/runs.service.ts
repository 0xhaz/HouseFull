import {
  type AgentDeps,
  createVertexLlm,
  type LlmAdapter,
  planBrief,
  RunFailed,
  runAgent,
} from '@housefull/agent';
import { briefVersions, type Db, qlooCalls, runEvents, runs } from '@housefull/db';
import { Ticketmaster } from '@housefull/events';
import type { QlooClient } from '@housefull/qloo-client';
import { type RunEvent, type RunStatus, type ShowInput, ShowInputSchema } from '@housefull/shared';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, gt, isNull, or, sql } from 'drizzle-orm';
import { Observable } from 'rxjs';
import { InjectDb } from '../db/db.module.js';
import { InjectQloo } from '../qloo/qloo.module.js';
import { RunEventLog } from '../qloo/run-events.js';
import { PRESETS } from '../shows/presets.js';
import { DbGeoStore } from './geo-store.js';

export type SseMessage = { id?: string; type?: string; data: unknown };

/** A run stuck in `running` this long is treated as lost (its instance died). */
const STALE_MS = 5 * 60 * 1000;
const POLL_MS = 250;
const HEARTBEAT_MS = 15_000;
/** Replaying a finished run: pace events so the step tracker still visibly plays (~2 s for a full run). */
const REPLAY_MS = 40;

@Injectable()
export class RunsService {
  private readonly logger = new Logger(RunsService.name);
  private readonly ticketmaster = new Ticketmaster({
    apiKey: process.env.TICKETMASTER_API_KEY || undefined,
  });
  private readonly llm: LlmAdapter | undefined = createVertexLlm();

  constructor(
    @InjectDb() private readonly db: Db,
    @InjectQloo() private readonly qloo: QlooClient,
    private readonly geo: DbGeoStore,
    private readonly log: RunEventLog,
  ) {
    this.logger.log(
      `llm=${this.llm?.name ?? 'none (deterministic segment names)'} ticketmaster=${this.ticketmaster.configured}`,
    );
  }

  resolveInput(body: { presetId?: string; show?: ShowInput }): ShowInput {
    if (body.presetId) {
      const preset = PRESETS.find((p) => p.id === body.presetId);
      if (!preset) throw new NotFoundException(`Unknown preset ${body.presetId}`);
      return preset.show;
    }
    return ShowInputSchema.parse(body.show);
  }

  /**
   * Presets reuse the latest finished run for the same show (within PRESET_REUSE_HOURS):
   * judges get the result in seconds and Qloo/Gemini budgets stay intact. The stream
   * replays the recorded event log, so the steps still play back.
   */
  async create(
    input: ShowInput,
    ipHash: string,
    opts: { preset?: boolean; fresh?: boolean; workspaceId?: string } = {},
  ) {
    if (opts.preset && !opts.fresh) {
      const hours = Number(process.env.PRESET_REUSE_HOURS || 24);
      const [hit] = await this.db
        .select({ id: runs.id })
        .from(runs)
        .where(
          and(
            eq(runs.status, 'done'),
            sql`${runs.input} = ${JSON.stringify(input)}::jsonb`,
            // Never hand out another workspace's run.
            opts.workspaceId
              ? or(isNull(runs.workspaceId), eq(runs.workspaceId, opts.workspaceId))
              : isNull(runs.workspaceId),
            gt(runs.createdAt, new Date(Date.now() - hours * 3_600_000)),
          ),
        )
        .orderBy(desc(runs.createdAt))
        .limit(1);
      if (hit) return { runId: hit.id, reused: true };
    }
    const [row] = await this.db
      .insert(runs)
      .values({ input, ipHash, status: 'queued', workspaceId: opts.workspaceId })
      .returning({ id: runs.id });
    return { runId: row?.id as string, reused: false };
  }

  async get(id: string) {
    const [row] = await this.db.select().from(runs).where(eq(runs.id, id));
    if (!row) throw new NotFoundException(`Run ${id} not found`);
    return {
      id: row.id,
      status: row.status as RunStatus,
      input: row.input,
      result: row.brief,
      createdAt: row.createdAt,
    };
  }

  /**
   * SSE for a run. The first stream to see a queued run claims and executes it
   * inside this request (Cloud Run only guarantees CPU while a request is open).
   * Every stream, on any instance, follows the ordered event log in Postgres,
   * so reloads and late joiners get the full trace.
   */
  stream(id: string): Observable<SseMessage> {
    return new Observable<SseMessage>((sub) => {
      let closed = false;
      let lastSeq = 0;
      let lastSent = Date.now();
      const close = () => {
        closed = true;
      };

      void (async () => {
        try {
          const run = await this.get(id);
          const pace = run.status === 'done' ? REPLAY_MS : 0;
          if (run.status === 'queued') void this.claimAndExecute(id);
          else if (run.status === 'running' && Date.now() - run.createdAt.getTime() > STALE_MS)
            await this.markLost(id);

          while (!closed) {
            const rows = await this.db
              .select({ seq: runEvents.seq, event: runEvents.event })
              .from(runEvents)
              .where(and(eq(runEvents.runId, id), gt(runEvents.seq, lastSeq)))
              .orderBy(asc(runEvents.seq));
            for (const r of rows) {
              if (closed) return;
              if (pace) await new Promise((res) => setTimeout(res, pace));
              lastSeq = r.seq;
              lastSent = Date.now();
              sub.next({ id: String(r.seq), data: r.event });
              if ((r.event as RunEvent).type === 'done') {
                sub.complete();
                return;
              }
            }
            if (Date.now() - lastSent > HEARTBEAT_MS) {
              lastSent = Date.now();
              sub.next({ type: 'ping', data: {} });
            }
            await new Promise((r) => setTimeout(r, POLL_MS));
          }
        } catch (e) {
          sub.error(e);
        }
      })();
      return close;
    });
  }

  /** Runs a queued run to completion in this request (MCP `plan_campaign`); no-op if it's already claimed. */
  async runToCompletion(id: string) {
    await this.claimAndExecute(id);
    return this.get(id);
  }

  private async claimAndExecute(id: string) {
    const [claimed] = await this.db
      .update(runs)
      .set({ status: 'running' })
      .where(and(eq(runs.id, id), eq(runs.status, 'queued')))
      .returning({ input: runs.input, ipHash: runs.ipHash });
    if (!claimed) return; // another stream got there first

    this.log.open(id);
    const emit = (e: RunEvent) => this.log.append(id, e);
    let status: RunStatus = 'done';
    try {
      const deps = this.agentDeps(id, claimed.ipHash ?? undefined, emit);
      const result = await runAgent(claimed.input as ShowInput, deps);
      const brief = await planBrief(result, deps);
      await this.db.transaction(async (tx) => {
        await tx.update(runs).set({ status, brief }).where(eq(runs.id, id));
        await tx
          .insert(briefVersions)
          .values({ runId: id, version: 1, brief, changeNote: { kind: 'initial' } });
      });
    } catch (e) {
      status = 'failed';
      const message = e instanceof RunFailed ? e.message : 'The run failed unexpectedly';
      if (!(e instanceof RunFailed)) this.logger.error(`run ${id} failed`, (e as Error).stack);
      emit({ type: 'warning', message });
      await this.db.update(runs).set({ status }).where(eq(runs.id, id));
    } finally {
      emit({ type: 'done', status });
      await this.log.close(id);
    }
  }

  /** Everything the agent needs for one run (shared with re-plans). */
  agentDeps(id: string, ipHash: string | undefined, emit: (e: RunEvent) => void): AgentDeps {
    return {
      runId: id,
      qloo: this.qloo,
      geo: this.geo,
      ticketmaster: this.ticketmaster,
      llm: this.llm,
      ipHash,
      emit,
      knownCallIds: async () =>
        new Set(
          (
            await this.db
              .select({ id: qlooCalls.id })
              .from(qlooCalls)
              .where(eq(qlooCalls.runId, id))
          ).map((r) => r.id),
        ),
    };
  }

  private async markLost(id: string) {
    await this.db
      .update(runs)
      .set({ status: 'failed' })
      .where(and(eq(runs.id, id), eq(runs.status, 'running')));
    const [last] = await this.db
      .select({ seq: runEvents.seq })
      .from(runEvents)
      .where(eq(runEvents.runId, id))
      .orderBy(desc(runEvents.seq))
      .limit(1);
    const seq = (last?.seq ?? 0) + 1;
    await this.db
      .insert(runEvents)
      .values({ runId: id, seq, event: { type: 'done', status: 'failed' } satisfies RunEvent })
      .onConflictDoNothing();
  }
}
