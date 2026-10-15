import type { Disruption, GettingHome, RunResult } from '@housefull/shared';
import type { AgentDeps, LateStationInfo } from '../deps.js';

const WALK_M_PER_MIN = 80;
const DETOUR = 1.3;
const SHOW_WINDOW = { start: '21:00', end: '03:00' };
export const GETTING_HOME_DISCLAIMER =
  'Suggested route only, based on public data (OpenStreetMap, MTA timetables, NYPD reports). Not a safety guarantee.';

const walkMin = (m: number) => Math.max(1, Math.round((m * DETOUR) / WALK_M_PER_MIN));

/** GTFS service day for trains leaving after a show that night. */
export function dayTypeOf(isoDate: string): 'weekday' | 'saturday' | 'sunday' {
  const d = new Date(`${isoDate}T12:00:00Z`).getUTCDay();
  return d === 6 ? 'saturday' : d === 0 ? 'sunday' : 'weekday';
}

/** "in line with" within ±25% of peers; never "safe" or "unsafe". */
function compare(here: number, peer: number) {
  if (peer === 0) return here === 0 ? 'in line with' : 'above';
  const r = here / peer;
  return r > 1.25 ? 'above' : r < 0.75 ? 'below' : 'in line with';
}

/**
 * F8, NYC only. Promoter context (plain counts vs similar nightlife areas),
 * the best late-night station, and a suggested walking route to it.
 * Never used to rank or exclude audiences.
 */
export async function gettingHome(
  result: RunResult,
  deps: AgentDeps,
  disruptions: Disruption[] = [],
): Promise<GettingHome | undefined> {
  const { show } = result;
  const g = deps.geo;
  if (show.city !== 'nyc' || !g.lateStations || !g.incidentsNear || !g.walkRoute) return undefined;
  const venue = { lng: show.venue.lng, lat: show.venue.lat };
  const day = dayTypeOf(show.date);

  const [stations, here, peer, areaRoutes] = await Promise.all([
    g.lateStations(show.city, venue.lng, venue.lat, day),
    g.incidentsNear(show.city, venue.lng, venue.lat),
    g.peerIncidents?.(show.city, venue.lng, venue.lat),
    g.neighborhoodRoutes?.(show.city, [
      ...new Set(result.segments.flatMap((s) => s.neighborhoods.slice(0, 3).map((n) => n.name))),
    ]),
  ]);
  if (stations.length === 0) return undefined;

  const audienceRoutes = new Set([...(areaRoutes?.values() ?? [])].flat());
  const disrupted = new Set(
    disruptions
      .filter((d) => d.kind !== 'city_event' && d.severity !== 'info')
      .flatMap((d) => d.affects.routes ?? []),
  );
  const usable = (s: LateStationInfo) => s.routes.filter((r) => !disrupted.has(r.route));
  const score = (s: LateStationInfo) => {
    const ok = usable(s);
    const wait = ok.length ? Math.min(...ok.map((r) => r.headwayMin)) / 2 : 30;
    const serves = s.routes.some((r) => audienceRoutes.has(r.route)) ? 3 : 0;
    return walkMin(s.meters) + wait - serves;
  };
  const ranked = [...stations]
    .filter((s) => s.routes.length > 0)
    .sort((a, b) => score(a) - score(b));
  const best = ranked[0];

  const route = best
    ? await g.walkRoute(show.city, venue, { lng: best.lng, lat: best.lat })
    : undefined;
  // Verb phrases, so they read as "Our suggested route <why>".
  const why: string[] = [];
  if (route) {
    const longer = route.meters / Math.max(route.shortestMeters, 1) - 1;
    if (route.mainStreetPct >= 40)
      why.push(`stays on main streets for ${route.mainStreetPct}% of the walk`);
    if (route.litPct !== null && route.litPct >= 50)
      why.push(`keeps to streets mapped as lit for ${route.litPct}% of the way`);
    if (route.fellBackToShortest || longer < 0.03)
      why.push('follows the most direct walk to the station');
    else
      why.push(
        `takes a ${Math.round(longer * 100)}% longer walk along busier streets than the shortest path`,
      );
  }
  const routeMin = route ? walkMin(route.meters / DETOUR) : undefined;
  const minutesTo = (s: LateStationInfo) =>
    s === best && routeMin !== undefined ? routeMin : walkMin(s.meters);

  const lines = (s: LateStationInfo) =>
    usable(s)
      .slice(0, 3)
      .map((r) => `${r.route} every ~${Math.round(r.headwayMin)} min`)
      .join(', ');
  const attendeeCopy = ranked
    .slice(0, 2)
    .map(
      (s) =>
        `${s.name} (${minutesTo(s)} min walk): ${lines(s) || 'check MTA service that night'} after the show`,
    );
  if (best && route && !route.fellBackToShortest && why.length)
    attendeeCopy.push(`Heading to ${best.name}? Our suggested route ${why[0]}.`);

  const peerNote = peer
    ? `Person-related reports are ${compare(here.person, peer.person)} similar nightlife areas; property reports are ${compare(here.property, peer.property)} them.`
    : 'Not enough similar nightlife areas to compare with.';

  return {
    venueContext: {
      window: SHOW_WINDOW,
      incidentsNearVenue: [
        { category: 'incidents against people', count: here.person },
        { category: 'property incidents', count: here.property },
      ],
      peerMedian: peer
        ? [
            { category: 'incidents against people', count: peer.person },
            { category: 'property incidents', count: peer.property },
          ]
        : [],
      note: `Within 300 m of the venue, 9pm–3am, last 12 months of NYPD reports. ${peerNote} Reports reflect what was reported, not all incidents.`,
      source: {
        dataset: 'NYPD Complaint Data Current (Year To Date), 5uac-w243',
        url: 'https://data.cityofnewyork.us/d/5uac-w243',
        period: 'last 12 months of available data',
      },
    },
    stations: ranked.slice(0, 3).map((s) => ({
      name: s.name,
      gtfsStopId: s.gtfsStopId,
      walkMinutes: minutesTo(s),
      lateRoutes: s.routes.map((r) => ({ route: r.route, headwayMinAfterShow: r.headwayMin })),
      disruptions: disruptions
        .filter(
          (d) =>
            d.kind !== 'city_event' &&
            (d.affects.routes ?? []).some((r) => s.routes.some((x) => x.route === r)),
        )
        .map((d) => d.title),
    })),
    suggestedRoute:
      best && route && route.geometry.coordinates.length >= 2
        ? {
            toStationId: best.gtfsStopId,
            geometry: route.geometry,
            walkMinutes: routeMin as number,
            extraVsShortestPct: Math.min(
              25,
              Math.max(0, Math.round((route.meters / Math.max(route.shortestMeters, 1) - 1) * 100)),
            ),
            why,
          }
        : undefined,
    attendeeCopy,
    disclaimer: GETTING_HOME_DISCLAIMER,
  };
}
