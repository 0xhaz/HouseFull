import { briefVersions, type Db, runs, surveyResponses, surveys } from '@housefull/db';
import { type SurveyOption, summarizeSurvey, surveyOptions } from '@housefull/feedback';
import {
  type CampaignBrief,
  CITY_META,
  SURVEY_HEARD_VIA,
  SURVEY_TAGS,
  type SurveyAnswer,
  type SurveyInfo,
  type SurveySummary,
  type TonightRating,
} from '@housefull/shared';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import { InjectDb } from '../db/db.module.js';

/** Survey options also remember which audience each artist stood for (never shown). */
type StoredOption = SurveyOption & { segmentName: string };

/**
 * F9c post-show survey. One per show, created on first use from the brief's audiences.
 * Answers are anonymous: no names, emails or IPs are stored with a response.
 */
@Injectable()
export class SurveysService {
  constructor(@InjectDb() private readonly db: Db) {}

  private async latestBrief(runId: string): Promise<CampaignBrief> {
    const [run] = await this.db
      .select({ status: runs.status })
      .from(runs)
      .where(eq(runs.id, runId));
    if (!run) throw new NotFoundException(`Run ${runId} not found`);
    if (run.status !== 'done') throw new ConflictException('The show’s brief isn’t ready yet');
    const [v] = await this.db
      .select({ brief: briefVersions.brief })
      .from(briefVersions)
      .where(eq(briefVersions.runId, runId))
      .orderBy(desc(briefVersions.version))
      .limit(1);
    if (!v) throw new NotFoundException(`Run ${runId} has no brief`);
    return v.brief as CampaignBrief;
  }

  /** The show's survey, created from its brief the first time anyone asks. */
  async ensure(runId: string) {
    const [hit] = await this.db.select().from(surveys).where(eq(surveys.runId, runId));
    if (hit) return { ...hit, options: hit.options as StoredOption[] };
    const brief = await this.latestBrief(runId);
    const names = new Map(brief.segments.map((s) => [s.id, s.name]));
    const options: StoredOption[] = surveyOptions(brief.segments).map((o) => ({
      ...o,
      segmentName: names.get(o.segmentId) ?? o.segmentId,
    }));
    await this.db.insert(surveys).values({ runId, options }).onConflictDoNothing();
    const [row] = await this.db.select().from(surveys).where(eq(surveys.runId, runId));
    if (!row) throw new NotFoundException('Survey could not be created');
    return { ...row, options: row.options as StoredOption[] };
  }

  async info(runId: string): Promise<SurveyInfo> {
    const [survey, brief] = await Promise.all([this.ensure(runId), this.latestBrief(runId)]);
    return {
      surveyId: survey.id,
      runId,
      show: {
        artist: brief.show.artist,
        venue: brief.show.venue.name,
        city: CITY_META[brief.show.city].name,
        date: brief.show.date,
      },
      // Artist names only: which audience each stands for stays private.
      options: survey.options.map((o) => ({ entityId: o.entityId, name: o.name })),
      heardVia: [...SURVEY_HEARD_VIA],
      tags: [...SURVEY_TAGS],
    };
  }

  async answer(surveyId: string, a: SurveyAnswer) {
    const [survey] = await this.db.select().from(surveys).where(eq(surveys.id, surveyId));
    if (!survey) throw new NotFoundException('Survey not found');
    const allowed = new Set((survey.options as StoredOption[]).map((o) => o.entityId));
    if (a.alsoLikes.some((id) => !allowed.has(id)))
      throw new BadRequestException('Unknown artist in alsoLikes');
    await this.db.insert(surveyResponses).values({
      surveyId,
      rating: a.rating,
      heardVia: a.heardVia ?? null,
      alsoLikes: [...new Set(a.alsoLikes)],
      wouldReturn: a.wouldReturn ?? null,
      tags: [...new Set(a.tags)],
      comment: a.comment?.trim() || null,
      sample: Boolean(a.sample),
    });
    return { ok: true };
  }

  /** Results per audience; empty (not an error) when the show has no survey yet. */
  async summary(runId: string): Promise<SurveySummary | undefined> {
    const [survey] = await this.db.select().from(surveys).where(eq(surveys.runId, runId));
    if (!survey) return undefined;
    const options = survey.options as StoredOption[];
    const segments = [
      ...new Map(
        options.map((o) => [o.segmentId, { id: o.segmentId, name: o.segmentName }]),
      ).values(),
    ];
    const rows = await this.db
      .select()
      .from(surveyResponses)
      .where(eq(surveyResponses.surveyId, survey.id))
      .orderBy(surveyResponses.createdAt);
    return summarizeSurvey(options, segments, rows);
  }

  /**
   * A fan's rating from Tonight, shared with the organizer only if HouseFull planned the show.
   * Their liked artists (Qloo ids) place them in an audience, just like the survey's checkboxes.
   */
  async fromTonight(r: TonightRating): Promise<{ shared: boolean }> {
    const [run] = await this.db
      .select({ id: runs.id })
      .from(runs)
      .where(
        and(
          eq(runs.status, 'done'),
          sql`${runs.input}->>'date' = ${r.date}`,
          sql`lower(${runs.input}->>'artist') = lower(${r.artist})`,
          sql`(position(lower(${runs.input}->'venue'->>'name') in lower(${r.venue})) > 0 or position(lower(${r.venue}) in lower(${runs.input}->'venue'->>'name')) > 0)`,
        ),
      )
      .orderBy(desc(runs.createdAt))
      .limit(1);
    if (!run) return { shared: false };
    const survey = await this.ensure(run.id);
    const allowed = new Set(survey.options.map((o) => o.entityId));
    await this.answer(survey.id, {
      rating: r.rating,
      wouldReturn: r.wouldReturn,
      heardVia: 'HouseFull Tonight',
      alsoLikes: r.likes.filter((id) => allowed.has(id)),
      tags: r.tags,
    });
    return { shared: true };
  }
}
