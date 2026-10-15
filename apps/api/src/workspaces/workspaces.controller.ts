import { type CreateWorkspace, CreateWorkspaceSchema } from '@housefull/shared';
import { Body, Controller, Delete, Get, Param, Put, UseGuards } from '@nestjs/common';
import { type Caller, CallerAuth, ClerkAuthGuard } from '../auth/clerk-auth.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { WorkspacesService } from './workspaces.service.js';

@Controller('workspaces')
@UseGuards(ClerkAuthGuard)
export class WorkspacesController {
  constructor(private readonly workspaces: WorkspacesService) {}

  /** Public demo workspaces (no sign-in). */
  @Get('demo')
  demos() {
    return this.workspaces.demos();
  }

  /** The workspace for the caller's active organization; `null` until it's set up. */
  @Get('current')
  async current(@CallerAuth() caller: Caller | null) {
    return { workspace: await this.workspaces.current(caller) };
  }

  /** Set up or re-profile the active organization's workspace (org admins). */
  @Put('current')
  upsert(
    @CallerAuth() caller: Caller | null,
    @Body(new ZodPipe(CreateWorkspaceSchema)) body: CreateWorkspace,
  ) {
    return this.workspaces.upsert(caller, body);
  }

  /** Delete the active organization's workspace and its runs (org admins). */
  @Delete('current')
  remove(@CallerAuth() caller: Caller | null) {
    return this.workspaces.remove(caller);
  }

  @Get(':slug')
  async overview(@Param('slug') slug: string, @CallerAuth() caller: Caller | null) {
    return this.workspaces.overview(await this.workspaces.access(slug, caller));
  }
}
