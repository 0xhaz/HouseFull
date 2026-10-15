import { z } from 'zod';
import { CitySchema, ShowInputSchema } from './show.js';

/** Who the workspace is for; picks the dashboard. */
export const PersonaSchema = z.enum(['promoter', 'venue', 'artist']);
export type Persona = z.infer<typeof PersonaSchema>;

export const PERSONA_META: Record<Persona, { label: string; blurb: string }> = {
  promoter: {
    label: 'Promoter',
    blurb: 'Every show you’re selling, how far along each is, and where to spend next.',
  },
  venue: {
    label: 'Venue',
    blurb:
      'Your room’s upcoming calendar, the audience it draws, and the local partners it shares.',
  },
  artist: {
    label: 'Artist team',
    blurb: 'One artist across a run of cities: who the new fans are in each, side by side.',
  },
};

export const WorkspaceProfileSchema = z.object({
  /** Promoter: the cities they book. */
  cities: z.array(CitySchema).optional(),
  /** Venue: the room itself. */
  venue: ShowInputSchema.shape.venue.extend({ city: CitySchema }).optional(),
  /** Artist team: the act they manage. */
  artist: z.string().min(1).optional(),
});
export type WorkspaceProfile = z.infer<typeof WorkspaceProfileSchema>;

export const SlugSchema = z
  .string()
  .min(3)
  .max(48)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const WorkspaceSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  persona: PersonaSchema,
  isDemo: z.boolean(),
  profile: WorkspaceProfileSchema,
});
export type Workspace = z.infer<typeof WorkspaceSchema>;

export const CreateWorkspaceSchema = z.object({
  persona: PersonaSchema,
  profile: WorkspaceProfileSchema,
});
export type CreateWorkspace = z.infer<typeof CreateWorkspaceSchema>;

/** One run as a dashboard row: enough to list, compare and roll up without loading full briefs. */
export const RunSummarySchema = z.object({
  id: z.string(),
  status: z.string(),
  createdAt: z.string(),
  /** `owner` if this workspace planned it, `shared` if another workspace shared it. */
  role: z.enum(['owner', 'shared']),
  show: ShowInputSchema,
  summary: z.string().nullable(),
  version: z.number(),
  checkins: z.number(),
  criticPassed: z.boolean().nullable(),
  venueFit: z.number().nullable(),
  disruptions: z.number(),
  segments: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      fansOf: z.array(z.string()),
      neighborhoods: z.array(z.string()),
      sourceCities: z.array(z.string()),
    }),
  ),
  partners: z.array(z.object({ name: z.string(), kind: z.string().optional() })),
  /** The brief's countdown, so dashboards can show what's due now. */
  schedule: z.array(z.object({ daysOut: z.number(), action: z.string() })),
});
export type RunSummary = z.infer<typeof RunSummarySchema>;

export const WorkspaceOverviewSchema = z.object({
  workspace: WorkspaceSchema,
  runs: z.array(RunSummarySchema),
});
export type WorkspaceOverview = z.infer<typeof WorkspaceOverviewSchema>;
