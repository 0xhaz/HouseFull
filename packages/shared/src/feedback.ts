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
      kind: z.enum(['budget', 'new_segment', 'drop_segment', 'copy', 'schedule']),
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
