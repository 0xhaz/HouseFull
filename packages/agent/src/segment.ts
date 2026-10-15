import { liftCells, metroLift, neighborhoodLift, rankNeighborhoods } from '@housefull/geo';
import type { Claim, Segment, ShowInput, StepId } from '@housefull/shared';
import type { AgentDeps, GeoStore } from './deps.js';
import { hoursOn, placeKind } from './places.js';
import { toRef } from './refs.js';

/** Partner places search radius around the venue (F4): walkable in NYC/NOLA, short drive in LA. */
const PLACE_RADIUS_M = { nyc: 1000, nola: 1000, la: 3000 } as const;
const TOP_NEIGHBORHOODS = 5;
/** A place this close to the venue is the venue itself. */
const SAME_PLACE_M = 75;

type Access = Awaited<ReturnType<GeoStore['access']>>;
type StepFn = <T>(
  id: StepId,
  fn: () => Promise<{ value: T; summary: string }>,
  segmentId?: string,
) => Promise<T>;

/** Everything a segment's reach steps need, computed once per run. */
export type SegmentContext = {
  show: ShowInput;
  bbox: string;
  baseline: Array<{ geohash: string; affinity: number }>;
  access: Access;
  deps: AgentDeps;
  step: StepFn;
  warn: (message: string) => void;
};

export type SegmentReach = {
  neighborhoods: Segment['neighborhoods'];
  claims: Claim[];
  sourceCities?: Segment['sourceCities'];
  channels: Omit<Segment['channels'], 'adTargeting'>;
};

/** Steps 4 (+4b in New Orleans) and 5 for one segment, in parallel. Shared by the first run and re-plans. */
export async function segmentReach(
  id: string,
  seedIds: string[],
  sc: SegmentContext,
): Promise<SegmentReach> {
  const { show, bbox, baseline, access, deps, step, warn } = sc;
  const { qloo, geo } = deps;
  const ctx = { runId: deps.runId, ipHash: deps.ipHash };

  const geographyP = step(
    'geography',
    async () => {
      const heat = await qloo.insights(
        {
          filterType: 'urn:heatmap',
          signal: { entities: seedIds },
          filter: { location: bbox },
        },
        ctx,
      );
      const target = (heat.data.results.heatmap ?? []).map((c) => ({
        geohash: c.location.geohash,
        affinity: c.query.affinity,
      }));
      const cells = liftCells(target, baseline);
      const snapped = await geo.snap(
        show.city,
        cells.map((c) => c.geohash),
      );
      const byGeohash = new Map(cells.map((c) => [c.geohash, c]));
      const groups = new Map<string, Array<(typeof cells)[number] & { share: number }>>();
      const names = new Map<string, string>();
      for (const s of snapped) {
        const c = byGeohash.get(s.geohash);
        if (!c) continue;
        names.set(s.neighborhoodId, s.name);
        groups.set(s.neighborhoodId, [
          ...(groups.get(s.neighborhoodId) ?? []),
          { ...c, share: s.share },
        ]);
      }
      const lifts = [...groups].flatMap(([n, cs]) => {
        const l = neighborhoodLift(n, cs);
        return l ? [l] : [];
      });
      const confident = rankNeighborhoods(lifts, access.minutes, access.mode).filter(
        (r) => !r.lowConfidence,
      );
      // Lead with areas where the segment over-indexes; fill with the next best only if too few.
      const over = confident.filter((r) => r.lift >= 1);
      const ranked = [...over, ...confident.filter((r) => r.lift < 1)].slice(0, TOP_NEIGHBORHOODS);
      if (over.length === 0)
        warn(`Segment ${id}: no neighborhood over-indexes; showing the closest matches`);
      const neighborhoods = ranked.map((r) => ({
        name: names.get(r.neighborhoodId) ?? r.neighborhoodId,
        lift: Math.round(r.lift * 100) / 100,
        accessMin: Math.round(r.accessMin),
      }));
      const claims: Claim[] = neighborhoods.slice(0, 2).map((n) => ({
        text: `${n.name}: ${n.lift}× the usual nightlife share for this segment, ${n.accessMin} min from the venue`,
        sourceRef: heat.meta.callId,
      }));
      return {
        value: { neighborhoods, claims },
        summary: neighborhoods.length
          ? neighborhoods
              .slice(0, 3)
              .map((n) => n.name)
              .join(', ')
          : 'no confident neighborhoods',
      };
    },
    id,
  ).catch((e: Error) => {
    warn(`Geography for segment ${id} failed: ${e.message}`);
    return { neighborhoods: [] as Segment['neighborhoods'], claims: [] as Claim[] };
  });

  const visitorsP =
    show.city === 'nola'
      ? step(
          'visitors',
          async () => {
            const heat = await qloo.insights(
              {
                filterType: 'urn:heatmap',
                signal: { entities: seedIds },
                filter: { locationQuery: 'United States' },
              },
              ctx,
            );
            const cells = (heat.data.results.heatmap ?? []).map((c) => ({
              lat: c.location.latitude,
              lng: c.location.longitude,
              affinity: c.query.affinity,
              popularity: c.query.popularity,
            }));
            const top = metroLift(cells).slice(0, 5);
            return {
              value: {
                sourceCities: top.map((m) => ({
                  metro: m.metro,
                  score: Math.round(m.score * 100) / 100,
                })),
                claim: top[0]
                  ? {
                      text: `${top[0].metro} over-indexes most for this segment among large US metros`,
                      sourceRef: heat.meta.callId,
                    }
                  : undefined,
              },
              summary: top.map((m) => m.metro).join(', ') || 'no metro signal',
            };
          },
          id,
        ).catch((e: Error) => {
          warn(`Visitor source cities for segment ${id} failed: ${e.message}`);
          return { sourceCities: undefined, claim: undefined };
        })
      : Promise.resolve({ sourceCities: undefined, claim: undefined });

  const channelsP = step(
    'channels',
    async () => {
      const pick = async (
        filterType: 'urn:entity:podcast' | 'urn:entity:tv_show' | 'urn:entity:brand',
      ) => {
        const r = await qloo.insights({ filterType, signal: { entities: seedIds }, take: 5 }, ctx);
        return (r.data.results.entities ?? []).map((e) => toRef(e, r.meta.callId));
      };
      const placesP = qloo
        .insights(
          {
            filterType: 'urn:entity:place',
            signal: { entities: seedIds },
            filter: {
              location: `POINT(${show.venue.lng} ${show.venue.lat})`,
              locationRadius: PLACE_RADIUS_M[show.city],
            },
            take: 10,
          },
          ctx,
        )
        .then((r) =>
          (r.data.results.entities ?? [])
            .map((e) => ({
              ...toRef(e, r.meta.callId),
              distanceM: Math.round(
                Number((e.query as Record<string, unknown> | undefined)?.distance ?? 0),
              ),
              kind: placeKind(e),
              hours: hoursOn(e, show.date),
              lat: e.location?.lat,
              lng: e.location?.lon,
            }))
            // The venue itself shows up as the nearest "place".
            .filter(
              (p) =>
                p.distanceM > SAME_PLACE_M &&
                p.name.toLowerCase() !== show.venue.name.toLowerCase(),
            ),
        );
      const [podcasts, tvShows, brands, partnerPlaces] = await Promise.all([
        pick('urn:entity:podcast'),
        pick('urn:entity:tv_show'),
        pick('urn:entity:brand'),
        placesP,
      ]);
      return {
        value: { podcasts, tvShows, brands, partnerPlaces },
        summary: `${podcasts.length} podcasts, ${tvShows.length} shows, ${brands.length} brands, ${partnerPlaces.length} places`,
      };
    },
    id,
  ).catch((e: Error) => {
    warn(`Channels for segment ${id} failed: ${e.message}`);
    return { podcasts: [], tvShows: [], brands: [], partnerPlaces: [] };
  });

  const [geography, visitors, channels] = await Promise.all([geographyP, visitorsP, channelsP]);
  return {
    neighborhoods: geography.neighborhoods,
    claims: [...geography.claims, ...(visitors.claim ? [visitors.claim] : [])],
    sourceCities: visitors.sourceCities,
    channels,
  };
}
