import { type Db, workspaceRuns, workspaces } from '@housefull/db';
import {
  type CampaignBrief,
  type CreateWorkspace,
  PersonaSchema,
  type RunSummary,
  type ShowInput,
  type Workspace,
  type WorkspaceOverview,
  WorkspaceProfileSchema,
} from '@housefull/shared';
import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Caller } from '../auth/clerk-auth.js';
import { ClerkAuth } from '../auth/clerk-auth.js';
import { InjectDb } from '../db/db.module.js';
import { PRESETS } from '../shows/presets.js';
import { DEMO_WORKSPACES } from './demo.js';

type Row = typeof workspaces.$inferSelect;

/** Places worth a cross-promotion call (not other venues, not unrelated shops). */
const PARTNER_KINDS = new Set(['bar', 'cafe', 'record store', 'restaurant']);

const toWorkspace = (r: Row): Workspace => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  persona: PersonaSchema.parse(r.persona),
  isDemo: r.isDemo,
  profile: WorkspaceProfileSchema.parse(r.profile),
});

@Injectable()
export class WorkspacesService implements OnModuleInit {
  private readonly logger = new Logger(WorkspacesService.name);

  constructor(
    @InjectDb() private readonly db: Db,
    private readonly auth: ClerkAuth,
  ) {}

  /** Demo workspaces are config, not data: (re)written on boot so a fresh database has them. */
  async onModuleInit() {
    try {
      for (const d of DEMO_WORKSPACES)
        await this.db
          .insert(workspaces)
          .values({ ...d, isDemo: true })
          .onConflictDoUpdate({
            target: workspaces.slug,
            set: { name: d.name, persona: d.persona, profile: d.profile, isDemo: true },
          });
    } catch (e) {
      // No database yet (e.g. /health smoke tests): workspaces simply aren't available.
      this.logger.warn(`demo workspaces not seeded: ${(e as Error).message}`);
    }
  }

  async demos(): Promise<Workspace[]> {
    const rows = await this.db.select().from(workspaces).where(eq(workspaces.isDemo, true));
    const order = DEMO_WORKSPACES.map((d) => d.slug);
    return rows.map(toWorkspace).sort((a, b) => order.indexOf(a.slug) - order.indexOf(b.slug));
  }

  /** The workspace for the caller's active Clerk organization, if it has been set up. */
  async current(caller: Caller | null): Promise<Workspace | null> {
    if (!caller) throw new UnauthorizedException('Sign in first');
    if (!caller.orgId) return null;
    const [row] = await this.db
      .select()
      .from(workspaces)
      .where(eq(workspaces.clerkOrgId, caller.orgId));
    return row ? toWorkspace(row) : null;
  }

  /**
   * Demo workspaces are open to everyone. Others need the caller's *active* organization to
   * be the workspace's org: switching orgs in Clerk switches what the API will show.
   */
  async access(slug: string, caller: Caller | null): Promise<Workspace> {
    const [row] = await this.db.select().from(workspaces).where(eq(workspaces.slug, slug));
    if (!row) throw new NotFoundException(`Workspace ${slug} not found`);
    if (row.isDemo) return toWorkspace(row);
    if (!caller) throw new UnauthorizedException('Sign in to open this workspace');
    if (caller.orgId !== row.clerkOrgId)
      throw new ForbiddenException('Switch to this workspace’s organization to open it');
    return toWorkspace(row);
  }

  /** Sets up (or re-profiles) the workspace for the caller's active organization. Admins only. */
  async upsert(caller: Caller | null, body: CreateWorkspace): Promise<Workspace> {
    if (!caller) throw new UnauthorizedException('Sign in first');
    if (!caller.orgId) throw new ForbiddenException('Create or pick an organization first');
    if (caller.orgRole !== 'org:admin')
      throw new ForbiddenException('Only organization admins can set up the workspace');
    const org = await this.auth.client?.organizations.getOrganization({
      organizationId: caller.orgId,
    });
    const slug = (caller.orgSlug || org?.slug || caller.orgId).toLowerCase();
    const name = org?.name || slug;
    const [row] = await this.db
      .insert(workspaces)
      .values({
        slug,
        name,
        persona: body.persona,
        profile: body.profile,
        clerkOrgId: caller.orgId,
      })
      .onConflictDoUpdate({
        target: workspaces.clerkOrgId,
        set: { slug, name, persona: body.persona, profile: body.profile },
      })
      .returning();
    return toWorkspace(row as Row);
  }

  /** Deletes the active organization's workspace and every run it planned. Admins only. */
  async remove(caller: Caller | null): Promise<{ deleted: boolean }> {
    if (!caller) throw new UnauthorizedException('Sign in first');
    if (!caller.orgId || caller.orgRole !== 'org:admin')
      throw new ForbiddenException('Only organization admins can delete the workspace');
    const rows = await this.db
      .delete(workspaces)
      .where(eq(workspaces.clerkOrgId, caller.orgId))
      .returning({ id: workspaces.id });
    return { deleted: rows.length > 0 };
  }

  async addRun(workspaceId: string, runId: string) {
    await this.db.insert(workspaceRuns).values({ workspaceId, runId }).onConflictDoNothing();
  }

  /**
   * Runs as dashboard rows, one per show: finished first, then re-planned (the full loop), then newest.
   * Demo workspaces also see the finished runs that match their profile.
   */
  async overview(ws: Workspace): Promise<WorkspaceOverview> {
    const presetInputs = ws.persona === 'promoter' ? PRESETS.map((p) => p.show) : [];
    const rows = await this.db.$client<
      Array<{
        id: string;
        status: string;
        created_at: Date | string;
        input: ShowInput;
        brief: CampaignBrief | null;
        role: 'owner' | 'shared';
        version: number | null;
        checkins: number;
      }>
    >`
      with linked as (
        select run_id as id, role from workspace_runs where workspace_id = ${ws.id}
        union all
        -- Demo workspaces present matching runs as their own.
        select r.id, 'owner' from runs r
        where ${ws.isDemo} and r.status = 'done'
          -- Only anonymous or demo-planned runs: never one a private workspace owns.
          and (r.workspace_id is null
            or exists (select 1 from workspaces w where w.id = r.workspace_id and w.is_demo))
          and (
          r.input->'venue'->>'name' = ${ws.profile.venue?.name ?? null}
          or r.input->>'artist' = ${ws.profile.artist ?? null}
          or r.input in (select jsonb_array_elements(${JSON.stringify(presetInputs)}::jsonb))
        )
      ),
      picked as (
        select distinct on (r.input->>'artist', r.input->'venue'->>'name', r.input->>'date') r.id, r.status, r.created_at, r.input, r.brief,
          case when bool_or(l.role = 'owner') over (partition by r.id) then 'owner' else 'shared' end as role
        from linked l join runs r on r.id = l.id
        order by r.input->>'artist', r.input->'venue'->>'name', r.input->>'date', (r.status = 'done') desc,
          exists (select 1 from brief_versions v where v.run_id = r.id and v.version > 1) desc,
          r.created_at desc
      )
      select p.*,
        (select max(version) from brief_versions v where v.run_id = p.id) as version,
        (select count(*)::int from checkins c where c.run_id = p.id) as checkins
      from picked p
      order by (p.input->>'date') asc, p.created_at desc
    `;
    return { workspace: ws, runs: rows.map(summarize) };
  }
}

function summarize(r: {
  id: string;
  status: string;
  created_at: Date | string;
  input: ShowInput;
  brief: CampaignBrief | null;
  role: 'owner' | 'shared';
  version: number | null;
  checkins: number;
}): RunSummary {
  const b = r.brief;
  const partners = new Map<string, string | undefined>();
  for (const s of b?.segments ?? [])
    for (const p of s.channels.partnerPlaces.slice(0, 6))
      if (p.kind && PARTNER_KINDS.has(p.kind)) partners.set(p.name, p.kind);
  return {
    id: r.id,
    status: r.status,
    createdAt: new Date(r.created_at).toISOString(),
    role: r.role,
    show: r.input,
    summary: b?.summary ?? null,
    version: r.version ?? (b ? 1 : 0),
    checkins: r.checkins,
    criticPassed: b ? b.critic.passed : null,
    venueFit: b ? b.venueFit.score : null,
    disruptions: (b?.disruptions ?? []).filter((d) => d.severity !== 'info').length,
    segments: (b?.segments ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      fansOf: s.seeds.slice(0, 3).map((x) => x.name),
      neighborhoods: s.neighborhoods.slice(0, 3).map((n) => n.name),
      sourceCities: (s.sourceCities ?? []).slice(0, 3).map((c) => c.metro),
    })),
    partners: [...partners].slice(0, 8).map(([name, kind]) => ({ name, kind })),
    schedule: (b?.schedule ?? []).map((s) => ({ daysOut: s.daysOut, action: s.action })),
  };
}
