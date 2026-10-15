import { z } from 'zod';

/** Every claim in a brief must point to a stored Qloo call (`qloo_calls.id`) or data source. */
export const ClaimSchema = z.object({
  text: z.string().min(1),
  sourceRef: z.string().min(1),
});
export type Claim = z.infer<typeof ClaimSchema>;

export const QlooRefSchema = z.object({
  entityId: z.string().min(1),
  name: z.string(),
  type: z.string(),
  affinity: z.number().optional(),
  sourceRef: z.string().min(1),
});
export type QlooRef = z.infer<typeof QlooRefSchema>;

/** Link to an external public dataset record (F7, F8). */
export const DataSourceSchema = z.object({
  dataset: z.string(),
  recordId: z.string().optional(),
  url: z.url(),
  period: z.string().optional(),
});
export type DataSource = z.infer<typeof DataSourceSchema>;

export const LineStringSchema = z.object({
  type: z.literal('LineString'),
  coordinates: z.array(z.tuple([z.number(), z.number()])).min(2),
});
export type LineString = z.infer<typeof LineStringSchema>;

export const CopyVariantSchema = z.object({
  headline: z.string(),
  body: z.string(),
  cta: z.string(),
});
export type CopyVariant = z.infer<typeof CopyVariantSchema>;
