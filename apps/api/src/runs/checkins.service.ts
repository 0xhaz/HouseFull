import { NotReadyForReplan, replan, streetTeamGpx } from '@housefull/agent';
import {
  briefVersions,
  checkins,
  type Db,
  linkClicks,
  neighborhoodPoints,
  runs,
  trackingLinks,
} from '@housefull/db';
import {
  type CheckinSource,
  parseMetaAdsCsv,
  type Scoreboard,
  type SegmentResult,
  scoreSegments,
} from '@housefull/feedback';
import { type CampaignBrief, CampaignBriefSchema, type ReplanResult } from '@housefull/shared';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import { InjectDb } from '../db/db.module.js';
import { adExportCsv, buildAdExport } from './ads.js';
import { RunsService } from './runs.service.js';

@Injectable()
export class CheckinsService {
  constructor(
    @InjectDb() private readonly db: Db,
    private readonly runs: RunsService,
  ) {}

  /** Latest brief version for a finished run. */
  async latest(runId: string): Promise<{ version: number; brief: CampaignBrief }> {
    const [v] = await this.db
      .select({ version: briefVersions.version, brief: briefVersions.brief })
      .from(briefVersions)
      .where(eq(briefVersions.runId, runId))
      .orderBy(desc(briefVersions.version))
      .limit(1);
    if (!v) throw new NotFoundException(`Run ${runId} has no brief yet`);
    return { version: v.version, brief: CampaignBriefSchema.parse(v.brief) };
  }

  async add(
    runId: string,
    body: { bySegment?: SegmentResult[]; csv?: string; source?: CheckinSource },
  ) {
    const { version, brief } = await this.latest(runId);
    let bySegment: SegmentResult[];
    let source: CheckinSource;
    let unmatched: string[] = [];
    if (body.csv) {
      try {
        ({ results: bySegment, unmatched } = parseMetaAdsCsv(body.csv));
      } catch (e) {
        throw new BadRequestException((e as Error).message);
      }
      source = 'meta_csv';
    } else {
      bySegment = body.bySegment ?? [];
      source = body.source === 'sample' ? 'sample' : 'manual';
    }
    const known = new Set(brief.segments.map((s) => s.id));
    const unknown = bySegment.filter((r) => !known.has(r.segmentId)).map((r) => r.segmentId);
    bySegment = bySegment.filter((r) => known.has(r.segmentId));
    if (bySegment.length === 0)
      throw new BadRequestException("No results matched this brief's segments");
    await this.db.insert(checkins).values({ runId, briefVersion: version, bySegment, source });
    return {
      saved: bySegment.length,
      unmatched: [...unmatched, ...unknown],
      scoreboard: await this.scoreboard(runId),
    };
  }

  /** Check-ins plus tracking-link clicks (unique visitors per day), scored per segment. */
  async scoreboard(
    runId: string,
  ): Promise<Scoreboard & { version: number; sources: CheckinSource[]; sample: boolean }> {
    const { version, brief } = await this.latest(runId);
    const rows = await this.db.select().from(checkins).where(eq(checkins.runId, runId));
    const clicks = await this.db
      .select({
        segmentId: trackingLinks.segmentId,
        clicks: sql<number>`count(DISTINCT (${linkClicks.day}, ${linkClicks.dedupeHash}))::int`,
      })
      .from(linkClicks)
      .innerJoin(trackingLinks, eq(trackingLinks.code, linkClicks.code))
      .where(eq(trackingLinks.runId, runId))
      .groupBy(trackingLinks.segmentId);
    const entries = rows.map((r) => ({
      source: r.source as CheckinSource,
      at: r.createdAt,
      bySegment: r.bySegment as SegmentResult[],
    }));
    if (clicks.length)
      entries.push({
        source: 'links',
        at: new Date(),
        bySegment: clicks.map((c) => ({ segmentId: c.segmentId, clicks: c.clicks })),
      });
    const sources = [...new Set(entries.map((e) => e.source))];
    return {
      version,
      sources,
      /** True when any result is the labelled demo sample, so the UI can say so. */
      sample: sources.includes('sample'),
      ...scoreSegments(
        brief.segments.map((s) => s.id),
        entries,
      ),
    };
  }

  async replan(
    runId: string,
    force: boolean,
  ): Promise<{ version: number; result: ReplanResult; brief: CampaignBrief }> {
    const [run] = await this.db
      .select({ status: runs.status, ipHash: runs.ipHash })
      .from(runs)
      .where(eq(runs.id, runId));
    if (!run) throw new NotFoundException(`Run ${runId} not found`);
    if (run.status !== 'done')
      throw new ConflictException('The run must finish before it can be re-planned');
    const { version, brief } = await this.latest(runId);
    const board = await this.scoreboard(runId);
    try {
      const deps = this.runs.agentDeps(runId, run.ipHash ?? undefined, () => {});
      const out = await replan(brief, version, board, deps, { force });
      if (board.sample) out.result.summary = `[Sample data] ${out.result.summary}`;
      await this.db.transaction(async (tx) => {
        await tx.insert(briefVersions).values({
          runId,
          version: out.result.toVersion,
          brief: out.brief,
          changeNote: out.result,
        });
        await tx.update(runs).set({ brief: out.brief }).where(eq(runs.id, runId));
      });
      return { version: out.result.toVersion, result: out.result, brief: out.brief };
    } catch (e) {
      if (e instanceof NotReadyForReplan) throw new ConflictException(e.message);
      throw e;
    }
  }

  versions(runId: string) {
    return this.db
      .select({
        version: briefVersions.version,
        changeNote: briefVersions.changeNote,
        createdAt: briefVersions.createdAt,
      })
      .from(briefVersions)
      .where(eq(briefVersions.runId, runId))
      .orderBy(briefVersions.version);
  }

  async version(runId: string, version: number) {
    const [v] = await this.db
      .select()
      .from(briefVersions)
      .where(and(eq(briefVersions.runId, runId), eq(briefVersions.version, version)));
    if (!v) throw new NotFoundException(`Version ${version} not found`);
    return v;
  }

  async adExport(runId: string, platform: 'meta' | 'tiktok') {
    const { version, brief } = await this.latest(runId);
    const names = [...new Set(brief.segments.flatMap((s) => s.neighborhoods.map((n) => n.name)))];
    const points = await neighborhoodPoints(this.db, brief.show.city, names);
    const exports = buildAdExport(brief, platform, points);
    return { version, exports, csv: adExportCsv(brief, exports) };
  }

  async streetTeamGpx(runId: string, segmentId?: string) {
    const { brief } = await this.latest(runId);
    const route = brief.streetTeam?.find((r) => !segmentId || r.segmentId === segmentId);
    if (!route) throw new NotFoundException('No street-team route for this brief');
    const seg = brief.segments.find((s) => s.id === route.segmentId);
    const title = `HouseFull street team: ${brief.artist.name} · ${seg?.name ?? route.segmentId}`;
    return {
      gpx: streetTeamGpx(brief.show.venue, route, title),
      name: `housefull-street-team-${route.segmentId}`,
    };
  }
}
