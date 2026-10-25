import {
  type CampaignBrief,
  CampaignBriefSchema,
  type PresetShow,
  PresetShowSchema,
  type ReplanResult,
  RunStatusSchema,
  type Workspace,
  type WorkspaceOverview,
  WorkspaceOverviewSchema,
  WorkspaceSchema,
} from '@housefull/shared';
import { z } from 'zod';

/** The web app talks only to the HouseFull API; no secrets live here. */
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4100';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

/** `token` is the caller's Clerk session token, for workspace-scoped reads. */
async function getJson<S extends z.ZodType>(
  path: string,
  schema: S,
  token?: string | null,
): Promise<z.infer<S>> {
  let res: Response;
  try {
    res = await fetch(new URL(path, API_BASE), {
      headers: token ? { authorization: `Bearer ${token}` } : undefined,
    });
  } catch {
    throw new ApiError(`HouseFull API unreachable at ${API_BASE}`);
  }
  if (!res.ok) throw new ApiError(`GET ${path} failed: ${res.status}`, res.status);
  return schema.parse(await res.json());
}

export const getDemoWorkspaces = (): Promise<Workspace[]> =>
  getJson('/workspaces/demo', z.array(WorkspaceSchema));

export const getCurrentWorkspace = (token: string) =>
  getJson('/workspaces/current', z.object({ workspace: WorkspaceSchema.nullable() }), token).then(
    (r) => r.workspace,
  );

export const getWorkspace = (slug: string, token?: string | null): Promise<WorkspaceOverview> =>
  getJson(`/workspaces/${encodeURIComponent(slug)}`, WorkspaceOverviewSchema, token);

export const getPresets = (): Promise<PresetShow[]> =>
  getJson('/shows/presets', z.array(PresetShowSchema));

const RunSchema = z.object({
  id: z.string(),
  status: RunStatusSchema,
  input: z.unknown(),
  result: CampaignBriefSchema.nullable(),
});
export type RunWithBrief = z.infer<typeof RunSchema>;
export const getRun = (id: string) => getJson(`/runs/${id}`, RunSchema);

const VersionSchema = z.object({
  version: z.number(),
  createdAt: z.string(),
  changeNote: z.unknown().nullable(),
});
export type VersionInfo = z.infer<typeof VersionSchema>;
export const getVersions = (id: string) => getJson(`/runs/${id}/versions`, z.array(VersionSchema));

export const getVersion = (id: string, v: number) =>
  getJson(
    `/runs/${id}/versions/${v}`,
    z.object({
      version: z.number(),
      brief: CampaignBriefSchema,
      changeNote: z.unknown().nullable(),
    }),
  );

/** A change note is a ReplanResult for v2+, `{ kind: 'initial' }` for v1. */
export function asReplan(note: unknown): ReplanResult | undefined {
  return note && typeof note === 'object' && 'changes' in note ? (note as ReplanResult) : undefined;
}

export type { CampaignBrief };

const ScoreboardSchema = z.object({
  ready: z.boolean(),
  sample: z.boolean(),
  segments: z.array(
    z.object({
      segmentId: z.string(),
      clicks: z.number(),
      sales: z.number(),
      spendUsd: z.number(),
      metric: z.number(),
      metricLabel: z.string(),
    }),
  ),
});
export const getScoreboard = (id: string) => getJson(`/runs/${id}/checkins`, ScoreboardSchema);
