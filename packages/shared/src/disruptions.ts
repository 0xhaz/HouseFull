import { z } from 'zod';
import { DataSourceSchema } from './refs.js';

/** F7: show-night disruption (NYC only for the hackathon). */
export const DisruptionSchema = z.object({
  kind: z.enum(['city_event', 'transit_planned', 'transit_alert', 'weather']),
  title: z.string(),
  window: z.object({
    start: z.iso.datetime({ offset: true }),
    end: z.iso.datetime({ offset: true }),
  }),
  severity: z.enum(['info', 'warn', 'high']),
  affects: z.object({
    segmentIds: z.array(z.string()),
    neighborhoods: z.array(z.string()),
    routes: z.array(z.string()).optional(),
  }),
  /** What HouseFull changed: access score, copy hint, schedule shift. */
  effect: z.string(),
  source: DataSourceSchema,
});
export type Disruption = z.infer<typeof DisruptionSchema>;
