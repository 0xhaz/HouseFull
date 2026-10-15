import { z } from 'zod';
import type { Persona } from './workspace.js';

/** Who a workspace can reach out to, all taken from its briefs. */
export const ContactKindSchema = z.enum(['place', 'act', 'media']);
export type ContactKind = z.infer<typeof ContactKindSchema>;

export const OutreachStatusSchema = z.enum(['new', 'drafted', 'contacted', 'replied', 'declined']);
export type OutreachStatus = z.infer<typeof OutreachStatusSchema>;

export const OUTREACH_STATUS_LABEL: Record<OutreachStatus, string> = {
  new: 'Not contacted',
  drafted: 'Drafted',
  contacted: 'Contacted',
  replied: 'Replied',
  declined: 'Declined',
};

export const OutreachContactSchema = z.object({
  /** Qloo entity id. */
  id: z.string(),
  kind: ContactKindSchema,
  name: z.string(),
  /** bar, cafe, record store, restaurant · artist · podcast */
  subtype: z.string().optional(),
  description: z.string().optional(),
  /** Why this contact matters, from the briefs: "Fans of Clairo (Bedroom Pop) hang out here". */
  reasons: z.array(z.string()),
  /** The shows it's relevant to (newest first); drafts default to the first. */
  shows: z.array(
    z.object({ runId: z.string(), label: z.string(), distanceM: z.number().optional() }),
  ),
  /** A deal the brief already suggested (partner places). */
  suggestedOffer: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().optional(),
  mapsUrl: z.string().optional(),
  instagram: z.string().optional(),
  /** Opening hours on the show's weekday, e.g. "17:00–02:00". */
  hours: z.string().optional(),
  status: OutreachStatusSchema,
  note: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type OutreachContact = z.infer<typeof OutreachContactSchema>;

/** What a team might want from a contact; the draft is written for one of these. */
export type OutreachPurpose = { id: string; label: string; brief: string };

const P = (id: string, label: string, brief: string): OutreachPurpose => ({ id, label, brief });

export const OUTREACH_PURPOSES: Record<Persona, Record<ContactKind, OutreachPurpose[]>> = {
  promoter: {
    place: [
      P(
        'cross-promo',
        'Cross-promotion',
        'Swap promotion: they share the show with their regulars, we feature them to ticket buyers.',
      ),
      P(
        'pre-show',
        'Pre-show deal',
        'A pre-show offer for ticket holders on show night (e.g. a drink or food deal with a ticket).',
      ),
      P('posters', 'Posters and flyers', 'Ask to put up a poster and leave flyers for the show.'),
      P(
        'giveaway',
        'Ticket giveaway',
        'Offer a pair of tickets to give away to their customers or followers.',
      ),
    ],
    act: [
      P(
        'support',
        'Opening slot',
        'Invite them to open the show; their fans overlap with the audience we want.',
      ),
    ],
    media: [
      P(
        'ad-read',
        'Sponsored mention',
        'Ask about a sponsored mention or ad read before the show.',
      ),
      P(
        'interview',
        'Interview pitch',
        'Pitch an interview or feature with the headliner ahead of the show.',
      ),
    ],
  },
  venue: {
    place: [
      P(
        'partnership',
        'Neighborhood partnership',
        'An ongoing partnership: shared promotion across the venue’s calendar.',
      ),
      P('pre-show', 'Pre-show deal', 'A pre-show offer for ticket holders on show nights.'),
      P(
        'co-host',
        'Co-hosted event',
        'Co-host an after-party, listening session or pre-show event.',
      ),
    ],
    act: [
      P(
        'booking',
        'Booking enquiry',
        'Ask about booking them for a date at the venue; their fans match the room.',
      ),
    ],
    media: [
      P('interview', 'Feature pitch', 'Pitch a feature on the venue and its upcoming shows.'),
      P(
        'ad-read',
        'Sponsored mention',
        'Ask about a sponsored mention for the venue’s upcoming shows.',
      ),
    ],
  },
  artist: {
    place: [
      P(
        'in-store',
        'In-store or signing',
        'Propose an in-store session, signing or listening party on the tour stop.',
      ),
      P('posters', 'Posters and flyers', 'Ask to put up a poster and leave flyers for the show.'),
      P(
        'giveaway',
        'Ticket giveaway',
        'Offer a pair of tickets to give away to their customers or followers.',
      ),
    ],
    act: [
      P(
        'support',
        'Support slot',
        'Invite them to support on this tour stop; their fans overlap with ours.',
      ),
      P(
        'collab',
        'Collaboration',
        'Suggest a collaboration or shared social post around the show.',
      ),
    ],
    media: [
      P(
        'guest',
        'Guest appearance',
        'Pitch the artist as a guest on the show ahead of the tour stop.',
      ),
      P('interview', 'Interview pitch', 'Pitch an interview or feature around the tour.'),
    ],
  },
};

export const DraftRequestSchema = z.object({
  contactId: z.string().min(1),
  runId: z.string().uuid(),
  purpose: z.string().min(1),
  /** Anything the sender wants included: "we can offer 2 tickets", "sign as Sam". */
  note: z.string().max(500).optional(),
});
export type DraftRequest = z.infer<typeof DraftRequestSchema>;

export const OutreachDraftSchema = z.object({ subject: z.string(), body: z.string() });
export type OutreachDraft = z.infer<typeof OutreachDraftSchema>;

export const OutreachUpdateSchema = z.object({
  status: OutreachStatusSchema,
  note: z.string().max(1000).optional(),
});
export type OutreachUpdate = z.infer<typeof OutreachUpdateSchema>;
