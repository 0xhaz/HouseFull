import type { PartnerDeal, RunResult } from '@housefull/shared';
import { z } from 'zod';
import type { AgentDeps } from '../deps.js';
import { openAt } from '../places.js';

const PARTNER_KINDS = new Set(['bar', 'restaurant', 'cafe', 'record store']);
const PER_SEGMENT = 3;
/** Pre-show window partners should be open for. */
const DOORS = '19:00';

const TEMPLATE: Record<string, { offer: string; pitch: string }> = {
  bar: { offer: 'Show your ticket for a 2-for-1 drink before 8pm', pitch: 'pre-show drinks' },
  restaurant: {
    offer: 'Ticket holders get a set early-dinner deal before doors',
    pitch: 'pre-show dinner',
  },
  cafe: { offer: 'Pre-show coffee discount with a ticket', pitch: 'pre-show coffee' },
  'record store': {
    offer: 'Ticket + vinyl bundle, or a signed poster with a ticket purchase',
    pitch: 'a ticket and record bundle',
  },
};

type Candidate = PartnerDeal['place'] & { kind: string; segmentId: string; segmentName: string };

/** F4: taste-matched places near the venue that are open before the show, with a drafted offer each. */
export async function partnerDeals(result: RunResult, deps: AgentDeps): Promise<PartnerDeal[]> {
  const seen = new Set<string>();
  const picks: Candidate[] = [];
  for (const s of result.segments) {
    let n = 0;
    for (const p of s.channels.partnerPlaces) {
      if (n >= PER_SEGMENT || seen.has(p.entityId) || !p.kind || !PARTNER_KINDS.has(p.kind))
        continue;
      if (openAt(p.hours, DOORS) === false) continue; // unknown hours stay in, marked "check hours"
      seen.add(p.entityId);
      picks.push({ ...p, kind: p.kind, segmentId: s.id, segmentName: s.name });
      n += 1;
    }
  }
  if (picks.length === 0) return [];

  const drafted = deps.llm
    ? await draftWithLlm(picks, result, deps).catch(() => undefined)
    : undefined;
  return picks.map((p, i) => {
    const t = TEMPLATE[p.kind] ?? TEMPLATE.bar;
    const d = drafted?.find((x) => x.index === i);
    const { kind: _k, segmentId, segmentName: _s, ...place } = p;
    return {
      place: { ...place, hours: p.hours ?? 'check hours' },
      segmentId,
      offer: d?.offer ?? (t as { offer: string }).offer,
      outreachMessage:
        d?.outreach ??
        `Hi ${p.name} team! We're promoting ${result.artist.name} at ${result.show.venue.name} on ${result.show.date}, ` +
          `${Math.round(p.distanceM)}m from you. Their fans overlap with your regulars, so we'd love to offer ` +
          `${(t as { pitch: string }).pitch} to ticket holders. Interested in a quick chat?`,
    };
  });
}

const DraftSchema = z.object({
  deals: z.array(
    z.object({
      index: z.number().int(),
      offer: z.string().max(140),
      outreach: z.string().max(500),
    }),
  ),
});

async function draftWithLlm(picks: Candidate[], result: RunResult, deps: AgentDeps) {
  const out = await deps.llm?.object({
    tier: 'fast',
    schema: DraftSchema,
    system:
      'You draft partnership offers between a concert promoter and nearby businesses. Offers are concrete, cheap to run ' +
      'and tied to the ticket (e.g. "ticket + 2 drinks before 8pm"). Outreach messages are short, friendly and specific. ' +
      'Use only the facts given. Never promise anything on behalf of the artist; never invent prices or numbers of attendees. ' +
      "Don't restate the date or opening hours in the offer; they are shown next to it.",
    prompt: JSON.stringify({
      show: { artist: result.artist.name, venue: result.show.venue.name, date: result.show.date },
      places: picks.map((p, index) => ({
        index,
        name: p.name,
        kind: p.kind,
        distanceM: Math.round(p.distanceM),
        hoursOnShowDay: p.hours ?? 'unknown',
        audienceSegment: p.segmentName,
      })),
    }),
  });
  return out?.deals;
}
