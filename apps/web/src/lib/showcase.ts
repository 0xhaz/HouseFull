import { CITY_META, type RunSummary, type WorkspaceOverview } from '@housefull/shared';
import { cache } from 'react';
import { ApiError, asReplan, getRun, getScoreboard, getVersion, getWorkspace } from '@/lib/api';

/**
 * Live material for the landing page's diagrams, read from the demo workspaces at request
 * time. Qloo-derived names are never written into the repo.
 */
export type Showcase = {
  runId: string;
  artist: string;
  venue: string;
  city: string;
  date: string;
  soldPct?: number;
  tags: string[];
  segments: Array<{
    id: string;
    name: string;
    fansOf: string[];
    neighborhoods: Array<{ name: string; lift: number; minutes: number }>;
    ad?: { headline: string; body: string; cta: string };
  }>;
  claims: number;
  criticPassed: boolean;
  results: Array<{ name: string; metric: number; label: string; sales: number; clicks: number }>;
  sample: boolean;
  version: number;
  changes: Array<{ kind: string; detail: string }>;
};

export type PersonaPreviews = {
  promoter?: WorkspaceOverview;
  venue?: WorkspaceOverview;
  artist?: WorkspaceOverview;
};

const quiet = <T>(p: Promise<T>) =>
  p.catch((e) => {
    if (e instanceof ApiError) return undefined;
    throw e;
  });

/** Cached per request: the flow diagram and the persona tabs share one load. */
export const loadShowcase = cache(
  async (): Promise<{
    showcase?: Showcase;
    personas: PersonaPreviews;
  }> => {
    const [promoter, venue, artist] = await Promise.all([
      quiet(getWorkspace('demo-promoter')),
      quiet(getWorkspace('demo-venue')),
      quiet(getWorkspace('demo-artist')),
    ]);
    const personas = { promoter, venue, artist };
    const pick: RunSummary | undefined =
      promoter?.runs.find((r) => r.status === 'done' && r.version > 1 && r.show.city === 'nyc') ??
      promoter?.runs.find((r) => r.status === 'done');
    if (!pick) return { personas };

    const [run, board, note] = await Promise.all([
      quiet(getRun(pick.id)),
      quiet(getScoreboard(pick.id)),
      pick.version > 1 ? quiet(getVersion(pick.id, pick.version)) : undefined,
    ]);
    const brief = run?.result;
    if (!brief) return { personas };
    const segName = new Map(brief.segments.map((s) => [s.id, s.name]));
    const replan = asReplan(note?.changeNote);
    return {
      personas,
      showcase: {
        runId: pick.id,
        artist: brief.artist.name,
        venue: brief.show.venue.name,
        city: CITY_META[brief.show.city].name,
        date: brief.show.date,
        soldPct: brief.show.soldPct,
        tags: brief.core.tags.slice(0, 6).map((t) => t.name),
        segments: brief.segments.slice(0, 3).map((s) => ({
          id: s.id,
          name: s.name,
          fansOf: s.seeds.slice(0, 3).map((x) => x.name),
          neighborhoods: s.neighborhoods
            .slice(0, 4)
            .map((n) => ({ name: n.name, lift: n.lift, minutes: Math.round(n.accessMin) })),
          ad: s.copy[0],
        })),
        claims:
          brief.segments.reduce((n, s) => n + s.why.length, 0) + brief.venueFit.reasons.length,
        criticPassed: brief.critic.passed,
        results: (board?.segments ?? []).map((r) => ({
          name: segName.get(r.segmentId) ?? r.segmentId,
          metric: r.metric,
          label: r.metricLabel,
          sales: r.sales,
          clicks: r.clicks,
        })),
        sample: board?.sample ?? false,
        version: pick.version,
        changes: (replan?.changes ?? [])
          .slice(0, 4)
          .map((c) => ({ kind: c.kind, detail: c.detail })),
      },
    };
  },
);
