import type { Opener, RunResult } from '@housefull/shared';
import type { AgentDeps } from '../deps.js';
import { toRef } from '../run.js';

/** Decision #10: up-and-coming openers sit at or below the 70th popularity percentile. */
export const OPENER_POPULARITY_MAX = 0.7;
const MAX_OPENERS = 5;

type Explained = { entity_id: string; score: number };

/**
 * F1. Candidates come from the next-ring segments' seeds (not the headliner),
 * so they bring new buyers. openerScore = affinity to the next ring − affinity
 * to the headliner's core fans: high when an act widens the audience.
 */
export async function findOpeners(result: RunResult, deps: AgentDeps): Promise<Opener[]> {
  const ctx = { runId: deps.runId, ipHash: deps.ipHash };
  const seeds = result.segments.flatMap((s) =>
    s.seeds.map((x) => ({ id: x.entityId, segmentId: s.id, name: x.name })),
  );
  if (seeds.length === 0) return [];
  const seedIds = [...new Set(seeds.map((s) => s.id))];

  const ring = await deps.qloo.insights(
    {
      filterType: 'urn:entity:artist',
      signal: { entities: seedIds },
      filter: {
        excludeEntities: [result.artist.entityId, ...seedIds],
        popularityMax: OPENER_POPULARITY_MAX,
      },
      explainability: true,
      take: 20,
    },
    ctx,
  );
  const candidates = ring.data.results.entities ?? [];
  if (candidates.length === 0) return [];

  const core = await deps.qloo.insights(
    {
      filterType: 'urn:entity:artist',
      signal: { entities: [result.artist.entityId] },
      filter: { resultsEntities: candidates.map((c) => c.entity_id) },
      take: candidates.length,
    },
    ctx,
  );
  const coreAffinity = new Map(
    (core.data.results.entities ?? []).map((e) => [e.entity_id, e.query?.affinity ?? 0]),
  );

  const seedById = new Map(seeds.map((s) => [s.id, s]));
  return candidates
    .map((c) => {
      const ringAff = c.query?.affinity ?? 0;
      const coreAff = coreAffinity.get(c.entity_id) ?? 0;
      const explained = (
        ((c.query?.explainability as Record<string, unknown> | undefined)?.[
          'signal.interests.entities'
        ] ?? []) as Explained[]
      ).filter((x) => x.score >= 0.1);
      const drivers = explained
        .sort((a, b) => b.score - a.score)
        .flatMap((x) => {
          const s = seedById.get(x.entity_id);
          return s ? [s] : [];
        });
      const bringsSegments = [...new Set(drivers.map((d) => d.segmentId))].slice(0, 2);
      const opener: Opener = {
        artist: toRef(c, ring.meta.callId),
        openerScore: Math.round((ringAff - coreAff) * 1000) / 1000,
        bringsSegments,
        why: [
          {
            text: `Fans of ${
              drivers
                .slice(0, 2)
                .map((d) => d.name)
                .join(' and ') || 'the next-ring artists'
            } also like ${c.name}`,
            sourceRef: ring.meta.callId,
          },
          {
            text: `${c.name} overlaps less with ${result.artist.name}'s existing fans, so they reach new buyers`,
            sourceRef: core.meta.callId,
          },
        ],
      };
      return opener;
    })
    .sort((a, b) => b.openerScore - a.openerScore)
    .slice(0, MAX_OPENERS);
}

/** Adds "has played locally" from Ticketmaster only; never claims availability. */
export async function addLocalEvents(
  openers: Opener[],
  result: RunResult,
  deps: AgentDeps,
): Promise<Opener[]> {
  if (!deps.ticketmaster.configured) return openers;
  return Promise.all(
    openers.map(async (o) => {
      const r = await deps.ticketmaster.find({
        keyword: o.artist.name,
        lat: result.show.venue.lat,
        lng: result.show.venue.lng,
      });
      if (!r.available) return o;
      const localEvents = r.events
        .filter((e) => e.name.toLowerCase().includes(o.artist.name.toLowerCase()))
        .slice(0, 3)
        .map((e) => ({ name: e.name, date: e.date, venue: e.venue }));
      return localEvents.length ? { ...o, localEvents } : o;
    }),
  );
}
