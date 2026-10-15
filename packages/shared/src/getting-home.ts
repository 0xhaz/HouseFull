import { z } from 'zod';
import { DataSourceSchema, LineStringSchema } from './refs.js';

const CategoryCountSchema = z.object({
  category: z.string(),
  count: z.number().int().nonnegative(),
});

/** F8: venue context (promoter-only) + late-night route. Never feeds audience ranking. */
export const GettingHomeSchema = z.object({
  venueContext: z.object({
    window: z.object({ start: z.string(), end: z.string() }),
    incidentsNearVenue: z.array(CategoryCountSchema),
    peerMedian: z.array(CategoryCountSchema),
    /** Neutral wording, e.g. "in line with similar nightlife areas". */
    note: z.string(),
    source: DataSourceSchema,
  }),
  stations: z.array(
    z.object({
      name: z.string(),
      gtfsStopId: z.string(),
      walkMinutes: z.number().nonnegative(),
      lateRoutes: z.array(
        z.object({
          route: z.string(),
          headwayMinAfterShow: z.number().nonnegative(),
          lastDeparture: z.string().optional(),
        }),
      ),
      /** From F7. */
      disruptions: z.array(z.string()),
    }),
  ),
  suggestedRoute: z
    .object({
      toStationId: z.string(),
      geometry: LineStringSchema,
      walkMinutes: z.number().nonnegative(),
      /** Capped at ~25%. */
      extraVsShortestPct: z.number().min(0).max(25),
      why: z.array(z.string()),
    })
    .optional(),
  rideshare: z.object({ pickupHint: z.string() }).optional(),
  attendeeCopy: z.array(z.string()),
  disclaimer: z.string().min(1),
});
export type GettingHome = z.infer<typeof GettingHomeSchema>;
