import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { z } from 'zod';
import { type Caller, CallerAuth, ClerkAuthGuard } from '../auth/clerk-auth.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { WorkspacesService } from '../workspaces/workspaces.service.js';
import { AskService } from './ask.service.js';

const AskSchema = z.object({ question: z.string().trim().min(3).max(500) });
const ASKS_PER_HOUR = Number(process.env.ASKS_PER_HOUR || 60);

@Controller('workspaces')
export class AskController {
  constructor(
    private readonly ask: AskService,
    private readonly workspaces: WorkspacesService,
  ) {}

  /** "Ask your workspace": a grounded answer over the workspace's briefs and results. */
  @Post(':slug/ask')
  @UseGuards(ThrottlerGuard, ClerkAuthGuard)
  @Throttle({ default: { limit: ASKS_PER_HOUR, ttl: 60 * 60 * 1000 } })
  async answer(
    @Param('slug') slug: string,
    @Body(new ZodPipe(AskSchema)) body: z.infer<typeof AskSchema>,
    @CallerAuth() caller: Caller | null,
  ) {
    return this.ask.ask(await this.workspaces.access(slug, caller), body.question);
  }
}
