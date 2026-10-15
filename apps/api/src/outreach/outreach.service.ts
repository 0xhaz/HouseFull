import {
  contactDetails,
  contactsFromBriefs,
  createVertexLlm,
  draftOutreach,
  type LlmAdapter,
} from '@housefull/agent';
import { type Db, outreach } from '@housefull/db';
import type { CallContext, QlooClient } from '@housefull/qloo-client';
import {
  type CampaignBrief,
  type DraftRequest,
  OUTREACH_PURPOSES,
  type OutreachContact,
  type OutreachDraft,
  type OutreachStatus,
  type OutreachUpdate,
  type Workspace,
} from '@housefull/shared';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { InjectDb } from '../db/db.module.js';
import { InjectQloo } from '../qloo/qloo.module.js';
import { CheckinsService } from '../runs/checkins.service.js';
import { WorkspacesService } from '../workspaces/workspaces.service.js';

const MAX_SHOWS = 12;
/** The /entities endpoint takes up to 50 ids per call (probe, Oct 14). */
const ENTITY_BATCH = 50;
const STATUS_ORDER: Record<OutreachStatus, number> = {
  replied: 0,
  contacted: 1,
  drafted: 2,
  new: 3,
  declined: 4,
};

@Injectable()
export class OutreachService {
  private readonly logger = new Logger(OutreachService.name);
  private readonly llm: LlmAdapter | undefined = createVertexLlm();

  constructor(
    @InjectDb() private readonly db: Db,
    @InjectQloo() private readonly qloo: QlooClient,
    private readonly workspaces: WorkspacesService,
    private readonly checkins: CheckinsService,
  ) {}

  /** Briefs (latest version) of the workspace's finished shows, newest show date first. */
  private async briefs(ws: Workspace) {
    const { runs } = await this.workspaces.overview(ws);
    const done = runs
      .filter((r) => r.status === 'done')
      .sort((a, b) => b.show.date.localeCompare(a.show.date))
      .slice(0, MAX_SHOWS);
    const out = await Promise.all(
      done.map(async (r) => {
        const latest = await this.checkins.latest(r.id).catch(() => undefined);
        return latest ? { runId: r.id, brief: latest.brief } : undefined;
      }),
    );
    return out.filter((b): b is { runId: string; brief: CampaignBrief } => Boolean(b));
  }

  /** Every contact from the briefs, with Qloo contact details and this workspace's status. */
  async contacts(ws: Workspace, ctx: CallContext): Promise<OutreachContact[]> {
    const base = contactsFromBriefs(await this.briefs(ws));
    const details = new Map<string, ReturnType<typeof contactDetails>>();
    const ids = base.map((c) => c.id);
    for (let i = 0; i < ids.length; i += ENTITY_BATCH) {
      try {
        const r = await this.qloo.entities(ids.slice(i, i + ENTITY_BATCH), ctx);
        for (const e of r.data.results)
          details.set(
            e.entity_id,
            contactDetails(e.properties, (e as { external?: unknown }).external),
          );
      } catch (e) {
        // Demo mode or a Qloo hiccup: contacts still list, just without phone and website.
        this.logger.warn(`contact details unavailable: ${(e as Error).message}`);
      }
    }
    const saved = new Map(
      (await this.db.select().from(outreach).where(eq(outreach.workspaceId, ws.id))).map((r) => [
        r.entityId,
        r,
      ]),
    );
    return base
      .map((c): OutreachContact => {
        const d = details.get(c.id);
        const s = saved.get(c.id);
        return {
          ...c,
          ...Object.fromEntries(Object.entries(d ?? {}).filter(([, v]) => v)),
          status: (s?.status as OutreachStatus) ?? 'new',
          note: s?.note ?? undefined,
          updatedAt: s?.updatedAt.toISOString(),
        };
      })
      .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
  }

  async draft(ws: Workspace, req: DraftRequest): Promise<OutreachDraft> {
    const briefs = await this.briefs(ws);
    const contact = contactsFromBriefs(briefs).find((c) => c.id === req.contactId);
    if (!contact) throw new NotFoundException('That contact isn’t in this workspace’s briefs');
    const purpose = OUTREACH_PURPOSES[ws.persona][contact.kind].find((p) => p.id === req.purpose);
    if (!purpose) throw new BadRequestException(`Unknown purpose ${req.purpose}`);
    const brief = briefs.find((b) => b.runId === req.runId)?.brief;
    if (!brief || !contact.shows.some((s) => s.runId === req.runId))
      throw new BadRequestException('Pick a show this contact is linked to');
    return draftOutreach(
      {
        sender: {
          workspace: ws.name.replace(/ \(demo\)$/, ''),
          persona: ws.persona,
          profile: ws.profile,
        },
        show: {
          artist: brief.show.artist,
          venue: brief.show.venue.name,
          city: brief.show.city,
          date: brief.show.date,
        },
        contact: {
          name: contact.name,
          kind: contact.kind,
          subtype: contact.subtype,
          reasons: contact.reasons.filter(
            (r) => r.includes(brief.show.venue.name) || contact.kind !== 'place',
          ),
          suggestedOffer: contact.suggestedOffer,
        },
        purpose,
        note: req.note,
      },
      this.llm,
    );
  }

  /** Demo workspaces are shared by everyone, so their status lives in each visitor's browser. */
  async update(ws: Workspace, entityId: string, body: OutreachUpdate) {
    if (ws.isDemo) throw new ForbiddenException('Demo workspaces don’t save outreach status');
    await this.db
      .insert(outreach)
      .values({ workspaceId: ws.id, entityId, status: body.status, note: body.note })
      .onConflictDoUpdate({
        target: [outreach.workspaceId, outreach.entityId],
        set: { status: body.status, note: body.note, updatedAt: new Date() },
      });
    return { ok: true };
  }
}
