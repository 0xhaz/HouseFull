import {
  type DraftRequest,
  DraftRequestSchema,
  type OutreachUpdate,
  OutreachUpdateSchema,
} from '@housefull/shared';
import { Body, Controller, Get, Ip, Param, Post, Put, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { type Caller, CallerAuth, ClerkAuthGuard } from '../auth/clerk-auth.js';
import { dailyIpHash } from '../common/ip.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { WorkspacesService } from '../workspaces/workspaces.service.js';
import { OutreachService } from './outreach.service.js';

const DRAFTS_PER_HOUR = Number(process.env.DRAFTS_PER_HOUR || 60);

@Controller('workspaces/:slug/outreach')
@UseGuards(ThrottlerGuard, ClerkAuthGuard)
export class OutreachController {
  constructor(
    private readonly outreach: OutreachService,
    private readonly workspaces: WorkspacesService,
  ) {}

  /** Places, acts and media from the workspace's briefs, with contact details and status. */
  @Get()
  async contacts(
    @Param('slug') slug: string,
    @CallerAuth() caller: Caller | null,
    @Ip() ip: string,
  ) {
    const ws = await this.workspaces.access(slug, caller);
    return this.outreach.contacts(ws, { ipHash: dailyIpHash(ip) });
  }

  /** A draft email for one contact and purpose. Nothing is sent: the user copies or opens it. */
  @Post('draft')
  @Throttle({ default: { limit: DRAFTS_PER_HOUR, ttl: 60 * 60 * 1000 } })
  async draft(
    @Param('slug') slug: string,
    @Body(new ZodPipe(DraftRequestSchema)) body: DraftRequest,
    @CallerAuth() caller: Caller | null,
  ) {
    return this.outreach.draft(await this.workspaces.access(slug, caller), body);
  }

  @Put(':entityId')
  async update(
    @Param('slug') slug: string,
    @Param('entityId') entityId: string,
    @Body(new ZodPipe(OutreachUpdateSchema)) body: OutreachUpdate,
    @CallerAuth() caller: Caller | null,
  ) {
    return this.outreach.update(await this.workspaces.access(slug, caller), entityId, body);
  }
}
