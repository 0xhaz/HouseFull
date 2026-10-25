import { SURVEY_MIN_RESPONSES, type SurveySummary } from '@housefull/shared';

export type SurveyOption = { entityId: string; name: string; segmentId: string };
export type SurveyRow = {
  rating: number;
  wouldReturn: boolean | null;
  heardVia: string | null;
  alsoLikes: string[];
  tags: string[];
  comment: string | null;
  sample: boolean;
};

const ALREADY_A_FAN = 'I was already a fan';
const MAX_COMMENTS = 5;

/**
 * Options for a show's survey: each audience's top seed artists (the ones the brief says its
 * fans love), deduplicated and interleaved so no audience's block is recognizable.
 */
export function surveyOptions(
  segments: Array<{ id: string; seeds: Array<{ entityId: string; name: string }> }>,
  perSegment = 3,
): SurveyOption[] {
  const seen = new Set<string>();
  const columns = segments.map((s) =>
    s.seeds
      .filter((x) => {
        if (seen.has(x.entityId)) return false;
        seen.add(x.entityId);
        return true;
      })
      .slice(0, perSegment)
      .map((x) => ({ entityId: x.entityId, name: x.name, segmentId: s.id })),
  );
  const out: SurveyOption[] = [];
  for (let i = 0; i < perSegment; i++)
    for (const c of columns) {
      const o = c[i];
      if (o) out.push(o);
    }
  return out;
}

function satisfaction(rows: SurveyRow[]) {
  const answered = rows.filter((r) => r.wouldReturn !== null);
  return {
    responses: rows.length,
    avgRating: rows.length
      ? Math.round((rows.reduce((s, r) => s + r.rating, 0) / rows.length) * 10) / 10
      : null,
    wouldReturnPct: answered.length
      ? Math.round((answered.filter((r) => r.wouldReturn).length / answered.length) * 100)
      : null,
  };
}

/**
 * Taste-based attribution: a respondent belongs to every audience whose artists they ticked.
 * Those who ticked none, or said they were already a fan, are the core fans.
 */
export function summarizeSurvey(
  options: SurveyOption[],
  segments: Array<{ id: string; name: string }>,
  rows: SurveyRow[],
): SurveySummary {
  const segmentOf = new Map(options.map((o) => [o.entityId, o.segmentId]));
  const audiences = (r: SurveyRow) => new Set(r.alsoLikes.flatMap((id) => segmentOf.get(id) ?? []));
  const isCore = (r: SurveyRow) => r.heardVia === ALREADY_A_FAN || audiences(r).size === 0;

  const tally = <T extends string>(values: T[]) => {
    const m = new Map<T, number>();
    for (const v of values) m.set(v, (m.get(v) ?? 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1]);
  };
  const withChannel = rows.filter((r) => r.heardVia);

  return {
    responses: rows.length,
    enough: rows.length >= SURVEY_MIN_RESPONSES,
    sample: rows.some((r) => r.sample),
    overall: satisfaction(rows),
    bySegment: segments
      .map((s) => ({
        segmentId: s.id,
        name: s.name,
        ...satisfaction(rows.filter((r) => !isCore(r) && audiences(r).has(s.id))),
      }))
      .sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0)),
    coreFans: satisfaction(rows.filter(isCore)),
    heardVia: tally(withChannel.map((r) => r.heardVia as string)).map(([channel, n]) => ({
      channel,
      share: Math.round((n / withChannel.length) * 100) / 100,
    })),
    tags: tally(rows.flatMap((r) => r.tags)).map(([tag, count]) => ({ tag, count })),
    comments: rows
      .flatMap((r) => (r.comment?.trim() ? [r.comment.trim()] : []))
      .slice(-MAX_COMMENTS)
      .reverse(),
  };
}
