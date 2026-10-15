import { z } from 'zod';
import { DisruptionSchema } from './disruptions.js';
import { GettingHomeSchema } from './getting-home.js';
import { ClaimSchema, CopyVariantSchema, QlooRefSchema } from './refs.js';
import { ShowInputSchema } from './show.js';

export const SegmentSchema = z.object({
  id: z.string(),
  /** e.g. "Neo-soul & late-night radio" */
  name: z.string(),
  /** Explainability-backed reasons. */
  why: z.array(ClaimSchema),
  seeds: z.array(QlooRefSchema),
  /** Aggregate skews only, never used to exclude people. */
  demographics: z.object({ ageSkew: z.string(), genderSkew: z.string() }).optional(),
  neighborhoods: z.array(z.object({ name: z.string(), lift: z.number(), accessMin: z.number() })),
  /** Travel mode (NOLA). */
  sourceCities: z.array(z.object({ metro: z.string(), score: z.number() })).optional(),
  channels: z.object({
    podcasts: z.array(QlooRefSchema),
    tvShows: z.array(QlooRefSchema),
    brands: z.array(QlooRefSchema),
    partnerPlaces: z.array(
      QlooRefSchema.extend({
        distanceM: z.number().nonnegative(),
        /** Coarse kind from Qloo place tags: bar, restaurant, cafe, record store, other. */
        kind: z.string().optional(),
        /** Opening hours on the show's weekday, e.g. "17:00–02:00"; absent if unknown. */
        hours: z.string().optional(),
        lat: z.number().optional(),
        lng: z.number().optional(),
      }),
    ),
    adTargeting: z.object({ interests: z.array(z.string()), geos: z.array(z.string()) }),
  }),
  copy: z.array(CopyVariantSchema),
});
export type Segment = z.infer<typeof SegmentSchema>;

export const OpenerSchema = z.object({
  artist: QlooRefSchema,
  openerScore: z.number(),
  /** Segment ids this act reaches. */
  bringsSegments: z.array(z.string()),
  why: z.array(ClaimSchema),
  localEvents: z
    .array(z.object({ name: z.string(), date: z.string(), venue: z.string() }))
    .optional(),
});
export type Opener = z.infer<typeof OpenerSchema>;

export const PartnerDealSchema = z.object({
  place: QlooRefSchema.extend({
    distanceM: z.number().nonnegative(),
    hours: z.string().optional(),
  }),
  segmentId: z.string(),
  offer: z.string(),
  outreachMessage: z.string(),
});
export type PartnerDeal = z.infer<typeof PartnerDealSchema>;

export const StreetTeamRouteSchema = z.object({
  segmentId: z.string(),
  stops: z.array(
    QlooRefSchema.extend({ order: z.number().int(), lat: z.number(), lng: z.number() }),
  ),
  walkMinutes: z.number().nonnegative(),
});
export type StreetTeamRoute = z.infer<typeof StreetTeamRouteSchema>;

export const AdExportSchema = z.object({
  segmentId: z.string(),
  platform: z.enum(['meta', 'tiktok']),
  interests: z.array(z.string()),
  zipCodes: z.array(z.string()),
  /** Drop-pin targeting: top neighborhoods as point + radius (we have no ZIP boundaries). */
  pins: z
    .array(z.object({ name: z.string(), lat: z.number(), lng: z.number(), radiusKm: z.number() }))
    .optional(),
  variants: z.array(CopyVariantSchema),
});
export type AdExport = z.infer<typeof AdExportSchema>;

/** Aggregate skews only, never used to exclude people. */
export const CoreProfileSchema = z.object({
  tags: z.array(QlooRefSchema),
  demographics: z.object({ ageSkew: z.string(), genderSkew: z.string() }).optional(),
});
export type CoreProfile = z.infer<typeof CoreProfileSchema>;

export const AccessInfoSchema = z.object({
  mode: z.enum(['transit', 'drive']),
  method: z.enum(['gtfs', 'distance']),
});

export const CriticReportSchema = z.object({
  passed: z.boolean(),
  rounds: z.number().int().nonnegative(),
  /** Claims removed because their source couldn't be verified. */
  droppedClaims: z.number().int().nonnegative(),
  notes: z.array(z.string()),
  /** "deterministic" when no LLM was available for the review pass. */
  reviewer: z.string(),
});
export type CriticReport = z.infer<typeof CriticReportSchema>;

export const CampaignBriefSchema = z.object({
  show: ShowInputSchema.extend({ artistEntityId: z.string() }),
  artist: QlooRefSchema,
  /** One-paragraph diagnosis that opens the brief. */
  summary: z.string(),
  core: CoreProfileSchema,
  segments: z.array(SegmentSchema),
  conflicts: z.array(z.object({ name: z.string(), venue: z.string(), time: z.string() })),
  schedule: z.array(
    z.object({ daysOut: z.number().int(), action: z.string(), segmentId: z.string() }),
  ),
  /** The "Without Qloo" toggle. */
  baselineComparison: z.object({ llmOnly: z.string() }).optional(),
  venueFit: z.object({ score: z.number().min(0).max(100), reasons: z.array(ClaimSchema) }), // F3
  openers: z.array(OpenerSchema), // F1
  partnerDeals: z.array(PartnerDealSchema), // F4
  streetTeam: z.array(StreetTeamRouteSchema).optional(), // F5
  adExport: z.array(AdExportSchema).optional(), // F6
  disruptions: z.array(DisruptionSchema).optional(), // F7
  gettingHome: GettingHomeSchema.optional(), // F8
  access: AccessInfoSchema,
  critic: CriticReportSchema,
  warnings: z.array(z.string()),
  /** Which model wrote the copy ("template" without an LLM). */
  writer: z.string(),
});
export type CampaignBrief = z.infer<typeof CampaignBriefSchema>;
