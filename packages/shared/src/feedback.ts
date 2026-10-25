import { z } from 'zod';
import { QlooRefSchema } from './refs.js';

/** F9a */
export const TrackingLinkSchema = z.object({
  /** Short code, e.g. "hf-7k2". */
  code: z.string().min(1),
  runId: z.string(),
  segmentId: z.string(),
  channel: z.string(),
  /** signup = promoter's own early-access / RSVP page. */
  destination: z.enum(['tickets', 'signup']),
  targetUrl: z.url(),
  /** Suggested; promoter creates it in their ticketing tool. */
  promoCode: z.string().optional(),
});
export type TrackingLink = z.infer<typeof TrackingLinkSchema>;

/** F9b */
export const CheckInSchema = z.object({
  runId: z.string(),
  at: z.iso.datetime({ offset: true }),
  briefVersion: z.number().int().positive(),
  bySegment: z.array(
    z.object({
      segmentId: z.string(),
      clicks: z.number().int().nonnegative().optional(),
      sales: z.number().int().nonnegative().optional(),
      spendUsd: z.number().nonnegative().optional(),
      source: z.enum(['manual', 'meta_csv', 'links']),
    }),
  ),
});
export type CheckIn = z.infer<typeof CheckInSchema>;

export const ReplanResultSchema = z.object({
  fromVersion: z.number().int().positive(),
  toVersion: z.number().int().positive(),
  changes: z.array(
    z.object({
      kind: z.enum(['budget', 'new_segment', 'drop_segment', 'copy', 'schedule', 'survey']),
      detail: z.string(),
      sourceRef: z.string().optional(),
    }),
  ),
  summary: z.string(),
});
export type ReplanResult = z.infer<typeof ReplanResultSchema>;

/** F9c: anonymous, no PII. */
export const SurveyResponseSchema = z.object({
  surveyId: z.string(),
  rating: z.number().int().min(1).max(5),
  heardVia: z.string().optional(),
  /** Qloo entity IDs. */
  alsoLikes: z.array(z.string()),
  wouldReturn: z.boolean().optional(),
  comment: z.string().max(2000).optional(),
});
export type SurveyResponse = z.infer<typeof SurveyResponseSchema>;

export const SignupDestinationSchema = z.object({
  kind: z.enum(['webhook', 'export']),
  /** e.g. Laylo, Zapier. */
  webhookUrl: z.url().optional(),
  /** Shown in consent text: "Sent to <label>". */
  label: z.string().min(1),
});
export type SignupDestination = z.infer<typeof SignupDestinationSchema>;

/** Transient: forwarded or queued, never joined to SurveyResponse. */
export const SurveySignupSchema = z.object({
  surveyId: z.string(),
  email: z.email(),
  consentText: z.string().min(1),
  at: z.iso.datetime({ offset: true }),
});
export type SurveySignup = z.infer<typeof SurveySignupSchema>;

/** Results shown only when responses >= SURVEY_MIN_RESPONSES. */
export const SURVEY_MIN_RESPONSES = 10;

export const VenueTasteProfileSchema = z.object({
  venueId: z.string(),
  responses: z.number().int().nonnegative(),
  topEntities: z.array(QlooRefSchema.extend({ share: z.number().min(0).max(1) })),
  heardVia: z.array(z.object({ channel: z.string(), share: z.number().min(0).max(1) })),
  themes: z.array(z.object({ theme: z.string(), mentions: z.number().int().nonnegative() })),
  avgRating: z.number().min(1).max(5),
});
export type VenueTasteProfile = z.infer<typeof VenueTasteProfileSchema>;

// ─── Post-show survey (F9c) ───────────────────────────────────────────────────
// Anonymous: no names, emails or IPs are stored with a response.

export const SURVEY_HEARD_VIA = [
  'Instagram or Facebook ad',
  'TikTok',
  'A podcast',
  'A friend',
  'The venue',
  'A poster or flyer',
  'Ticketmaster',
  'HouseFull Tonight',
  'I was already a fan',
  'Somewhere else',
] as const;

export const SURVEY_TAGS = [
  'Great sound',
  'Great crowd',
  'Great venue',
  'Easy to get home',
  'Would bring friends',
] as const;

/** What a respondent sees. Options are the audiences' seed artists, shuffled and unlabeled. */
export const SurveyInfoSchema = z.object({
  surveyId: z.string(),
  runId: z.string(),
  show: z.object({ artist: z.string(), venue: z.string(), city: z.string(), date: z.string() }),
  options: z.array(z.object({ entityId: z.string(), name: z.string() })),
  heardVia: z.array(z.string()),
  tags: z.array(z.string()),
});
export type SurveyInfo = z.infer<typeof SurveyInfoSchema>;

export const SurveyAnswerSchema = z.object({
  rating: z.number().int().min(1).max(5),
  wouldReturn: z.boolean().optional(),
  heardVia: z.enum(SURVEY_HEARD_VIA).optional(),
  /** Entity ids from the survey's options. */
  alsoLikes: z.array(z.string()).max(20).default([]),
  tags: z.array(z.enum(SURVEY_TAGS)).max(SURVEY_TAGS.length).default([]),
  comment: z.string().trim().max(500).optional(),
  /** Seeded demo data, labelled as such everywhere. */
  sample: z.boolean().optional(),
});
export type SurveyAnswer = z.infer<typeof SurveyAnswerSchema>;

const Satisfaction = z.object({
  responses: z.number().int().nonnegative(),
  avgRating: z.number().nullable(),
  /** 0–100, of those who answered. */
  wouldReturnPct: z.number().nullable(),
});

/** Per-audience results: a respondent counts for every audience whose artists they ticked. */
export const SurveySummarySchema = z.object({
  responses: z.number().int().nonnegative(),
  /** Shown in full once there are this many responses (small numbers can identify people). */
  enough: z.boolean(),
  sample: z.boolean(),
  overall: Satisfaction,
  bySegment: z.array(Satisfaction.extend({ segmentId: z.string(), name: z.string() })),
  /** Ticked none of the audiences' artists, or said they were already a fan. */
  coreFans: Satisfaction,
  heardVia: z.array(z.object({ channel: z.string(), share: z.number() })),
  tags: z.array(z.object({ tag: z.string(), count: z.number().int() })),
  comments: z.array(z.string()),
});
export type SurveySummary = z.infer<typeof SurveySummarySchema>;

/** A fan's rating of a show they went to, from Tonight. Shared only if they opt in. */
export const TonightRatingSchema = z.object({
  artist: z.string().min(1).max(200),
  venue: z.string().min(1).max(200),
  date: z.iso.date(),
  rating: z.number().int().min(1).max(5),
  wouldReturn: z.boolean().optional(),
  tags: z.array(z.enum(SURVEY_TAGS)).default([]),
  /** Qloo ids of artists the fan likes: lets the organizer see which audience they belong to. */
  likes: z.array(z.string()).max(10).default([]),
});
export type TonightRating = z.infer<typeof TonightRatingSchema>;
