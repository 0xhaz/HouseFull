import { ShowInputSchema } from '@housefull/shared';
import {
  Body,
  Controller,
  Get,
  Ip,
  Param,
  ParseUUIDPipe,
  Post,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Observable } from 'rxjs';
import { z } from 'zod';
import { type Caller, CallerAuth, ClerkAuthGuard } from '../auth/clerk-auth.js';
import { dailyIpHash } from '../common/ip.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { WorkspacesService } from '../workspaces/workspaces.service.js';
import { RunsService, type SseMessage } from './runs.service.js';

/** `workspace` (a slug) files the run under that workspace's dashboard. */
const InWorkspace = z.object({ workspace: z.string().min(1).optional() });
const CreateRunSchema = z.union([
  /** `fresh` skips reusing a recent finished run of the same preset. */
  InWorkspace.extend({ presetId: z.string().min(1), fresh: z.boolean().optional() }),
  InWorkspace.extend({ show: ShowInputSchema }),
]);
type CreateRun = z.infer<typeof CreateRunSchema>;

const RUNS_PER_HOUR = Number(process.env.RUNS_PER_HOUR || 20);

@Controller('runs')
export class RunsController {
  constructor(
    private readonly runs: RunsService,
    private readonly workspaces: WorkspacesService,
  ) {}

  /** Creates a run; it starts when the client opens `/runs/:id/stream`. */
  @Post()
  @UseGuards(ThrottlerGuard, ClerkAuthGuard)
  @Throttle({ default: { limit: RUNS_PER_HOUR, ttl: 60 * 60 * 1000 } })
  async create(
    @Body(new ZodPipe(CreateRunSchema)) body: CreateRun,
    @Ip() ip: string,
    @CallerAuth() caller: Caller | null,
  ) {
    // Check access before spending anything on the run.
    const ws = body.workspace ? await this.workspaces.access(body.workspace, caller) : undefined;
    const input = this.runs.resolveInput(body);
    const preset = 'presetId' in body;
    const run = await this.runs.create(input, dailyIpHash(ip), {
      preset,
      fresh: preset && body.fresh,
      workspaceId: ws?.id,
    });
    if (ws) await this.workspaces.addRun(ws.id, run.runId);
    return run;
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.runs.get(id);
  }

  /** SSE: step events, Qloo calls and warnings, then `done`. */
  @Sse(':id/stream')
  stream(@Param('id', ParseUUIDPipe) id: string): Observable<SseMessage> {
    return this.runs.stream(id);
  }
}
