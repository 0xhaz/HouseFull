import { z } from 'zod';
import { AccessInfoSchema, CoreProfileSchema, SegmentSchema } from './brief.js';
import { ClaimSchema, DataSourceSchema, QlooRefSchema } from './refs.js';
import { ShowInputSchema } from './show.js';

export const StepIdSchema = z.enum([
  'resolve',
  'core',
  'ring',
  'geography',
  'visitors',
  'channels',
  'conflicts',
  'disruptions',
  'gettingHome',
  'venueFit',
  'openers',
  'partners',
  'streetTeam',
  'brief',
  'critic',
  'baseline',
]);
export type StepId = z.infer<typeof StepIdSchema>;

export const STEP_LABELS: Record<StepId, string> = {
  resolve: 'Resolve artist and venue',
  core: 'Core audience',
  ring: 'Next-ring audiences',
  geography: 'Where they are',
  visitors: 'Visitor source cities',
  channels: 'How to reach them',
  conflicts: 'Same-night conflicts',
  disruptions: 'Show-night disruptions',
  gettingHome: 'Getting home',
  venueFit: 'Venue fit',
  openers: 'Opening-act finder',
  partners: 'Partner deals',
  streetTeam: 'Street-team route',
  brief: 'Writing the brief',
  critic: 'Checking every claim',
  baseline: 'Without Qloo comparison',
};

export const RunStatusSchema = z.enum(['queued', 'running', 'done', 'failed']);
export type RunStatus = z.infer<typeof RunStatusSchema>;

export const RunEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('step'),
    step: StepIdSchema,
    status: z.enum(['started', 'done', 'skipped', 'failed']),
    /** Segment the step ran for (steps 4–5 run once per segment). */
    segmentId: z.string().optional(),
    summary: z.string().optional(),
    ms: z.number().optional(),
  }),
  z.object({
    type: z.literal('qloo'),
    callId: z.string(),
    endpoint: z.string(),
    filterType: z.string().optional(),
    status: z.number(),
    ms: z.number(),
    source: z.enum(['live', 'cache', 'fixture']),
  }),
  z.object({ type: z.literal('warning'), message: z.string() }),
  z.object({ type: z.literal('done'), status: RunStatusSchema }),
]);
export type RunEvent = z.infer<typeof RunEventSchema>;

/** Output of agent steps 1–6, before the brief writer (Phase 4). */
export const RunResultSchema = z.object({
  show: ShowInputSchema,
  artist: QlooRefSchema,
  core: CoreProfileSchema,
  segments: z.array(SegmentSchema),
  conflicts: z.object({
    available: z.boolean(),
    events: z.array(
      z.object({
        name: z.string(),
        venue: z.string(),
        time: z.string(),
        url: z.string().optional(),
      }),
    ),
    source: DataSourceSchema.optional(),
    note: z.string().optional(),
  }),
  /** How travel times were computed, shown next to the map. */
  access: AccessInfoSchema,
  warnings: z.array(z.string()),
  claims: z.array(ClaimSchema).optional(),
});
export type RunResult = z.infer<typeof RunResultSchema>;
