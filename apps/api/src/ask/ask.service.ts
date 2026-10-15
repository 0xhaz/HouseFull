import {
  type AskFacts,
  type AskResult,
  type AskShow,
  askWorkspace,
  createVertexLlm,
  type LlmAdapter,
} from '@housefull/agent';
import type { Workspace } from '@housefull/shared';
import { Injectable, Logger } from '@nestjs/common';
import { CheckinsService } from '../runs/checkins.service.js';
import { WorkspacesService } from '../workspaces/workspaces.service.js';

const MAX_SHOWS = 12;
const DAY = 86_400_000;

@Injectable()
export class AskService {
  private readonly logger = new Logger(AskService.name);
  private readonly llm: LlmAdapter | undefined = createVertexLlm();

  constructor(
    private readonly workspaces: WorkspacesService,
    private readonly checkins: CheckinsService,
  ) {}

  async ask(ws: Workspace, question: string): Promise<AskResult> {
    const facts = await this.facts(ws);
    try {
      return await askWorkspace(question, facts, this.llm);
    } catch (e) {
      this.logger.warn(`ask failed: ${(e as Error).message}`);
      return {
        answer: 'Couldn’t get an answer right now. Try again in a moment.',
        sources: [],
        followUps: [],
      };
    }
  }

  /** The workspace's shows, with the latest brief's reasons and results, as compact facts. */
  async facts(ws: Workspace): Promise<AskFacts> {
    const { runs } = await this.workspaces.overview(ws);
    const now = new Date();
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const done = runs.filter((r) => r.status === 'done').slice(0, MAX_SHOWS);
    const shows = await Promise.all(
      done.map(async (r, i): Promise<AskShow> => {
        const daysOut = Math.round((Date.parse(`${r.show.date}T00:00:00Z`) - today) / DAY);
        const [latest, board] = await Promise.all([
          this.checkins.latest(r.id).catch(() => undefined),
          r.checkins > 0 ? this.checkins.scoreboard(r.id).catch(() => undefined) : undefined,
        ]);
        const brief = latest?.brief;
        const due = [...r.schedule]
          .filter((s) => s.daysOut >= daysOut)
          .sort((a, b) => a.daysOut - b.daysOut)[0];
        return {
          ref: `S${i + 1}`,
          runId: r.id,
          show: r.show,
          daysOut,
          version: r.version,
          summary: r.summary,
          venueFit: r.venueFit,
          dueNow: due?.action,
          segments: r.segments.map((s) => ({
            ...s,
            reasons: (brief?.segments.find((b) => b.id === s.id)?.why ?? [])
              .slice(0, 3)
              .map((c) => ({ text: c.text, sourceRef: c.sourceRef })),
          })),
          openers: (brief?.openers ?? []).slice(0, 4).map((o) => o.artist.name),
          partners: r.partners.map((p) => p.name),
          results: board
            ? {
                ready: board.ready,
                reason: board.reason,
                sample: board.sample,
                bySegment: board.segments.map((s) => ({
                  segmentId: s.segmentId,
                  clicks: s.clicks,
                  sales: s.sales,
                  spendUsd: s.spendUsd,
                })),
                missing: board.missing,
              }
            : undefined,
        };
      }),
    );
    return {
      workspace: { name: ws.name, persona: ws.persona, profile: ws.profile },
      today: now.toISOString().slice(0, 10),
      shows,
    };
  }
}
