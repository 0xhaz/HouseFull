import { z } from 'zod';

/** F2 (stretch). */
export const SeasonViewSchema = z.object({
  venueId: z.string(),
  shows: z.array(
    z.object({
      runId: z.string(),
      date: z.string(),
      artist: z.string(),
      soldPct: z.number().min(0).max(100).optional(),
      risk: z.enum(['low', 'med', 'high']),
    }),
  ),
  crossPromos: z.array(
    z.object({
      fromRunId: z.string(),
      toRunId: z.string(),
      sharedAffinity: z.number(),
      idea: z.string(),
    }),
  ),
});
export type SeasonView = z.infer<typeof SeasonViewSchema>;
