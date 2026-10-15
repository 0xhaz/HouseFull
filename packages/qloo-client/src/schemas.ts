import { z } from 'zod';

/**
 * Response shapes are deliberately loose (unknown fields pass through) until the probe
 * confirms them against the hackathon host. Tighten here, not at call sites.
 */

export const QueryMetaSchema = z.looseObject({
  affinity: z.number().optional(),
  affinity_rank: z.number().optional(),
  popularity: z.number().optional(),
  explainability: z.unknown().optional(),
});

export const EntitySchema = z.looseObject({
  entity_id: z.string(),
  name: z.string(),
  type: z.string().optional(),
  types: z.array(z.string()).optional(),
  subtype: z.string().optional(),
  popularity: z.number().optional(),
  properties: z.record(z.string(), z.unknown()).optional(),
  location: z
    .looseObject({
      lat: z.number().optional(),
      lon: z.number().optional(),
      geohash: z.string().optional(),
    })
    .optional(),
  query: QueryMetaSchema.optional(),
  tags: z
    .array(z.looseObject({ id: z.string().optional(), name: z.string().optional() }))
    .optional(),
});
export type QlooEntity = z.infer<typeof EntitySchema>;

export const HeatmapCellSchema = z.looseObject({
  location: z.looseObject({
    latitude: z.number(),
    longitude: z.number(),
    geohash: z.string(),
  }),
  /** `popularity` is per cell: raw affinity tracks it at r≈0.99, hence lift (geo §5.3). */
  query: QueryMetaSchema.extend({ affinity: z.number(), popularity: z.number() }),
});
export type HeatmapCell = z.infer<typeof HeatmapCellSchema>;

export const TagSchema = z
  .looseObject({
    id: z.string().optional(),
    tag_id: z.string().optional(),
    name: z.string(),
    type: z.string().optional(),
    subtype: z.string().optional(),
    query: QueryMetaSchema.optional(),
  })
  .refine((t) => t.id ?? t.tag_id, { message: 'tag has no id or tag_id' });
export type QlooTag = z.infer<typeof TagSchema>;

export const InsightsResponseSchema = z.looseObject({
  success: z.boolean().optional(),
  results: z.looseObject({
    entities: z.array(EntitySchema).optional(),
    heatmap: z.array(HeatmapCellSchema).optional(),
    tags: z.array(TagSchema).optional(),
    demographics: z.array(z.unknown()).optional(),
  }),
  duration: z.number().optional(),
});
export type InsightsResponse = z.infer<typeof InsightsResponseSchema>;

export const SearchResponseSchema = z.looseObject({
  results: z.array(EntitySchema),
});
export type SearchResponse = z.infer<typeof SearchResponseSchema>;

export const EntitiesResponseSchema = z.looseObject({
  results: z.array(EntitySchema),
});
export type EntitiesResponse = z.infer<typeof EntitiesResponseSchema>;

export const TagsResponseSchema = z.looseObject({
  results: z.looseObject({ tags: z.array(TagSchema) }),
});
export type TagsResponse = z.infer<typeof TagsResponseSchema>;

export const AudiencesResponseSchema = z.looseObject({
  results: z.looseObject({
    audiences: z.array(z.looseObject({ id: z.string(), name: z.string() })),
  }),
});
export type AudiencesResponse = z.infer<typeof AudiencesResponseSchema>;

/**
 * Compare needs entity signals on both sides (a.signal.interests.entities,
 * b.signal.interests.entities); location signals are rejected and artist-vs-place
 * returns no tags (probe, Oct 13). Results are the shared tags, scored.
 */
export const CompareResponseSchema = z.looseObject({
  results: z.looseObject({
    tags: z.array(
      z.looseObject({
        tag_id: z.string(),
        name: z.string(),
        subtype: z.string().optional(),
        query: z.looseObject({ score: z.number() }).optional(),
      }),
    ),
  }),
});
export type CompareResponse = z.infer<typeof CompareResponseSchema>;
