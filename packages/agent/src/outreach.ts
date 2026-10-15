import {
  type CampaignBrief,
  CITY_META,
  type ContactKind,
  type OutreachContact,
  type OutreachDraft,
  type OutreachPurpose,
  type Persona,
  type WorkspaceProfile,
} from '@housefull/shared';
import { z } from 'zod';
import { protectedTraitIn } from './brief/critic.js';
import type { LlmAdapter } from './llm.js';

const PLACE_KINDS = new Set(['bar', 'cafe', 'record store', 'restaurant']);
const PODCASTS_PER_SEGMENT = 2;

type Draftable = Omit<OutreachContact, 'status' | 'note' | 'updatedAt'>;

const showLabel = (b: CampaignBrief) =>
  `${b.show.artist} at ${b.show.venue.name}, ${new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${b.show.date}T00:00:00Z`))}`;

const listOf = (xs: string[]) =>
  xs.length < 2 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;

const metres = (m: number) =>
  m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`;

/**
 * Everyone worth contacting, from the workspace's briefs: partner places near each venue,
 * opening acts, and the podcasts each audience listens to. One entry per Qloo entity,
 * with the reasons from every show it appears in. Newest show first.
 */
export function contactsFromBriefs(
  briefs: Array<{ runId: string; brief: CampaignBrief }>,
): Draftable[] {
  const out = new Map<string, Draftable>();
  const add = (
    id: string,
    kind: ContactKind,
    name: string,
    subtype: string | undefined,
    reason: string,
    show: { runId: string; label: string; distanceM?: number },
    extra: Partial<Draftable> = {},
  ) => {
    const c =
      out.get(id) ??
      ({ id, kind, name, subtype, reasons: [], shows: [] } satisfies Draftable as Draftable);
    if (!c.reasons.includes(reason)) c.reasons.push(reason);
    if (!c.shows.some((s) => s.runId === show.runId)) c.shows.push(show);
    out.set(id, { ...c, ...Object.fromEntries(Object.entries(extra).filter(([, v]) => v)) });
  };

  for (const { runId, brief } of briefs) {
    const label = showLabel(brief);
    const venue = brief.show.venue.name;
    // A place can suit several audiences of one show: one reason listing them all.
    const places = new Map<
      string,
      {
        p: (typeof brief.segments)[number]['channels']['partnerPlaces'][number];
        audiences: string[];
      }
    >();
    for (const s of brief.segments) {
      const fans = s.seeds
        .slice(0, 2)
        .map((x) => x.name)
        .join(' and ');
      for (const p of s.channels.partnerPlaces) {
        if (!p.kind || !PLACE_KINDS.has(p.kind)) continue;
        const entry = places.get(p.entityId) ?? { p, audiences: [] };
        if (!entry.audiences.includes(s.name)) entry.audiences.push(s.name);
        places.set(p.entityId, entry);
      }
      for (const pod of s.channels.podcasts.slice(0, PODCASTS_PER_SEGMENT))
        add(
          pod.entityId,
          'media',
          pod.name,
          'podcast',
          `The ${s.name} audience (fans of ${fans}) listens to it`,
          { runId, label },
        );
    }
    for (const { p, audiences } of places.values()) {
      const deal = brief.partnerDeals.find((d) => d.place.entityId === p.entityId);
      add(
        p.entityId,
        'place',
        p.name,
        p.kind,
        `${metres(p.distanceM)} from ${venue}; popular with the ${listOf(audiences)} audience${audiences.length > 1 ? 's' : ''}`,
        { runId, label, distanceM: p.distanceM },
        { hours: p.hours, suggestedOffer: deal?.offer },
      );
    }
    for (const o of brief.openers) {
      const brings = brief.segments
        .filter((s) => o.bringsSegments.includes(s.id))
        .map((s) => s.name);
      add(
        o.artist.entityId,
        'act',
        o.artist.name,
        'artist',
        brings.length
          ? `Their fans overlap with the ${listOf(brings)} audience for ${brief.show.artist}`
          : `Suggested opener for ${brief.show.artist}`,
        { runId, label },
      );
    }
  }
  const order: Record<ContactKind, number> = { place: 0, act: 1, media: 2 };
  return [...out.values()].sort((a, b) => order[a.kind] - order[b.kind]);
}

/** Contact details from a full Qloo entity (places have address, phone, website, Google id). */
export function contactDetails(props: Record<string, unknown> | undefined, external?: unknown) {
  const p = props ?? {};
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
  const ext = (external ?? p.external) as
    | { google_place?: { place_id?: string }; instagram?: { id?: string } }
    | undefined;
  const placeId = ext?.google_place?.place_id;
  return {
    address: str(p.address),
    phone: str(p.phone),
    website: str(p.website),
    description: str(p.short_description) ?? str(p.description),
    instagram: ext?.instagram?.id ? `https://www.instagram.com/${ext.instagram.id}` : undefined,
    mapsUrl: placeId
      ? `https://www.google.com/maps/place/?q=place_id:${placeId}`
      : str(p.address)
        ? `https://www.google.com/maps/search/?${new URLSearchParams({ api: '1', query: str(p.address) as string })}`
        : undefined,
  };
}

export type DraftFacts = {
  sender: { workspace: string; persona: Persona; profile: WorkspaceProfile };
  show: { artist: string; venue: string; city: string; date: string };
  contact: Pick<
    Draftable,
    'name' | 'kind' | 'subtype' | 'reasons' | 'suggestedOffer' | 'description'
  >;
  purpose: OutreachPurpose;
  note?: string;
};

const LlmDraftSchema = z.object({ subject: z.string(), body: z.string() });

const SENDER: Record<Persona, string> = {
  promoter: 'the promoter of the show',
  venue: 'the venue',
  artist: 'the artist’s team',
};

const SYSTEM = [
  'You write short, warm, specific outreach emails for live music marketing.',
  'Use ONLY the facts given. Say why this contact is a good fit using the reasons (nearby, shared audience), in plain words.',
  'Make one clear ask that matches the purpose, and suggest a next step (a quick call or a reply).',
  'Never mention ticket sales, how many tickets are left, budgets, or that the show is not selling: it is confidential.',
  'Never describe people by age, gender, ethnicity, religion or sexuality. Audiences are about taste.',
  'Never invent numbers, prices, offers or facts. If the sender’s note offers something, you may include it.',
  'Under 160 words. No markdown. Format the body as a real email: the greeting on its own line, two or three short paragraphs separated by blank lines, then the sign-off on separate lines: "Thanks," then "[Your name]" then the sender’s organization.',
].join('\n');

/** Drafts one outreach email. Without a model, a plain template with the same facts. */
export async function draftOutreach(
  facts: DraftFacts,
  llm: LlmAdapter | undefined,
): Promise<OutreachDraft> {
  const fallback = templateDraft(facts);
  if (!llm) return fallback;
  try {
    const r = await llm.object({
      tier: 'fast',
      temperature: 0.6,
      schema: LlmDraftSchema,
      system: SYSTEM,
      prompt: JSON.stringify({
        ...facts,
        sender: { ...facts.sender, role: SENDER[facts.sender.persona] },
      }),
    });
    const draft = {
      subject: r.subject.trim().slice(0, 140),
      body: emailLayout(r.body.trim()).slice(0, 2000),
    };
    const names = [facts.show.artist, facts.show.venue, facts.contact.name, facts.sender.workspace];
    if (protectedTraitIn(`${draft.subject} ${draft.body}`, names)) return fallback;
    if (/\b\d{1,3}\s?%|sold|tickets left|budget/i.test(draft.body)) return fallback;
    return draft;
  } catch {
    return fallback;
  }
}

/**
 * Models often return the email as one block. Restore a real layout: greeting line, short
 * paragraphs, then the sign-off on its own lines. Bodies that already have line breaks pass.
 */
export function emailLayout(body: string): string {
  if (body.includes('\n')) return body;
  let text = body;
  let greeting = '';
  const g = text.match(/^((?:hi|hello|hey|dear)\b[^,.!]{0,60}[,!])\s*/i);
  if (g?.[1]) {
    greeting = g[1];
    text = text.slice(g[0].length);
  }
  let signoff = '';
  const s = text.match(
    /\s*((?:best|thanks|thank you|cheers|warm regards|kind regards|regards|all the best),?)\s*(\[Your name\]),?\s*(.*)$/i,
  );
  if (s?.index !== undefined) {
    signoff = [s[1], s[2], s[3]].filter(Boolean).join('\n');
    text = text.slice(0, s.index);
  }
  const sentences = text.match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g)?.map((x) => x.trim()) ?? [text];
  const per = Math.max(2, Math.ceil(sentences.length / 3));
  const paras: string[] = [];
  for (let i = 0; i < sentences.length; i += per) paras.push(sentences.slice(i, i + per).join(' '));
  return [greeting, ...paras, signoff].filter(Boolean).join('\n\n');
}

export function templateDraft(f: DraftFacts): OutreachDraft {
  const when = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${f.show.date}T00:00:00Z`));
  const why = f.contact.reasons[0]
    ? `We noticed ${f.contact.name} is a natural fit: ${f.contact.reasons[0].charAt(0).toLowerCase()}${f.contact.reasons[0].slice(1)}.`
    : '';
  const offer = f.contact.suggestedOffer ? ` One idea: ${f.contact.suggestedOffer}` : '';
  const city = CITY_META[f.show.city as keyof typeof CITY_META]?.name ?? f.show.city;
  return {
    subject: `${f.purpose.label}: ${f.show.artist} at ${f.show.venue}, ${when}`,
    body: [
      `Hi ${f.contact.name} team,`,
      '',
      `I'm reaching out from ${f.sender.workspace} about ${f.show.artist} at ${f.show.venue} in ${city} on ${when}. ${why}`,
      '',
      `${f.purpose.brief}${offer}`,
      f.note ? `\n${f.note}` : '',
      '',
      'Would you be open to a quick call this week?',
      '',
      'Thanks,',
      '[Your name]',
      f.sender.workspace,
    ]
      .filter((l, i, a) => !(l === '' && a[i - 1] === ''))
      .join('\n'),
  };
}
