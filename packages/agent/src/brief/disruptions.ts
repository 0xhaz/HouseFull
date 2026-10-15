import {
  alertsFor,
  geocode,
  isPlanned,
  isSuspension,
  showWindow,
  subwayAlerts,
} from '@housefull/disruptions';
import { haversineKm } from '@housefull/geo';
import type { Disruption, RunResult } from '@housefull/shared';
import type { AgentDeps } from '../deps.js';

const EVENT_RADIUS_KM = 1;
const MAX_GEOCODES = 40;
const GEOCODE_CONCURRENCY = 8;
const MAX_INFO = 3;
const TOP_AREAS = 3;

export type DisruptionReport = { disruptions: Disruption[]; notes: string[] };

/**
 * F7, NYC only: permitted city events near the venue and subway alerts on the
 * lines that serve the venue or each segment's top neighborhoods, during the
 * show window (doors 18:00 → 01:00). Every hit keeps a source link.
 */
export async function showNightDisruptions(
  result: RunResult,
  deps: AgentDeps,
  fetchImpl: typeof fetch = fetch,
): Promise<DisruptionReport> {
  const { show } = result;
  const geo = deps.geo;
  if (show.city !== 'nyc')
    return { disruptions: [], notes: ['Disruption check is NYC-only for now'] };
  if (!geo.routesNear || !geo.neighborhoodRoutes || !geo.cityEvents)
    return { disruptions: [], notes: ['Disruption data not available'] };

  const window = showWindow(show.date);
  const notes: string[] = [];
  const disruptions: Disruption[] = [];
  const iso = (d: Date) => d.toISOString();

  // ── Transit ────────────────────────────────────────────────────────────────
  const venueStations = await geo.routesNear(show.city, show.venue.lng, show.venue.lat);
  const venueRoutes = new Set(venueStations.flatMap((s) => s.routes));
  const tops = result.segments.map((s) => ({
    seg: s,
    areas: s.neighborhoods.slice(0, TOP_AREAS).map((n) => n.name),
  }));
  const areaRoutes = await geo.neighborhoodRoutes(show.city, [
    ...new Set(tops.flatMap((t) => t.areas)),
  ]);
  const allRoutes = new Set([...venueRoutes, ...[...areaRoutes.values()].flat()]);
  try {
    const alerts = alertsFor(await subwayAlerts(fetchImpl), allRoutes, window);
    const seen = new Set<string>();
    for (const a of alerts) {
      const key = `${a.type}|${a.header}`;
      if (seen.has(key)) continue; // the MTA repeats alerts per direction
      seen.add(key);
      const hitsVenue = a.routes.some((r) => venueRoutes.has(r));
      const servesArea = (n: string) => (areaRoutes.get(n) ?? []).some((r) => a.routes.includes(r));
      const affected = tops.filter((t) => t.areas.some(servesArea));
      const affectedAreas = [...new Set(affected.flatMap((t) => t.areas.filter(servesArea)))];
      const lines = a.routes.filter((r) => allRoutes.has(r)).join('/');
      const otherVenueLines = [...venueRoutes].filter((r) => !a.routes.includes(r));
      disruptions.push({
        kind: isPlanned(a.type) ? 'transit_planned' : 'transit_alert',
        title: `${a.type}: ${lines}`,
        window: { start: iso(window.start), end: iso(window.end) },
        severity:
          hitsVenue && isSuspension(a.type)
            ? 'high'
            : hitsVenue || isSuspension(a.type)
              ? 'warn'
              : 'info',
        affects: {
          segmentIds: affected.map((t) => t.seg.id),
          neighborhoods: affectedAreas,
          routes: a.routes,
        },
        effect: hitsVenue
          ? `${lines} serves the venue: name alternatives${otherVenueLines.length ? ` (${otherVenueLines.join('/')})` : ''} in last-week copy and the ticket confirmation`
          : `Fans from ${affectedAreas.slice(0, 2).join(' and ') || 'top areas'} ride the ${lines}: flag it in last-week copy`,
        source: {
          dataset: 'MTA subway alerts (GTFS-RT)',
          recordId: a.id,
          url: 'https://new.mta.info/alerts',
        },
      });
    }
  } catch (e) {
    notes.push(`MTA alerts unavailable: ${(e as Error).message}`);
  }

  // ── Permitted city events near the venue ───────────────────────────────────
  const events = await geo.cityEvents(show.city, window.start, window.end);
  // Geocode unplaced permits a few at a time (each is cached in the DB afterwards).
  const toPlace = events
    .filter((ev) => (ev.lng === null || ev.lat === null) && ev.location)
    .slice(0, MAX_GEOCODES);
  const placed = new Map<string, { lng: number; lat: number }>();
  for (let i = 0; i < toPlace.length; i += GEOCODE_CONCURRENCY) {
    await Promise.all(
      toPlace.slice(i, i + GEOCODE_CONCURRENCY).map(async (ev) => {
        const g = await geocode(ev.location as string, ev.borough ?? undefined, fetchImpl);
        if (!g) return;
        placed.set(ev.id, { lng: g.lng, lat: g.lat });
        await geo.setEventPoint?.(ev.id, g.lng, g.lat);
      }),
    );
  }
  let failed = 0;
  let skipped = 0;
  for (const ev of events) {
    const point =
      ev.lng !== null && ev.lat !== null ? { lng: ev.lng, lat: ev.lat } : placed.get(ev.id);
    if (!point) {
      if (toPlace.includes(ev)) failed += 1;
      else skipped += 1;
      continue;
    }
    const km = haversineKm({ lat: show.venue.lat, lng: show.venue.lng }, point);
    if (km > EVENT_RADIUS_KM) continue;
    disruptions.push({
      kind: 'city_event',
      title: `${ev.title} (${ev.type})`,
      window: { start: iso(ev.startsAt), end: iso(ev.endsAt) },
      severity: km < 0.5 ? 'warn' : 'info',
      affects: { segmentIds: [], neighborhoods: [] },
      effect: `${Math.round(km * 1000)} m from the venue during the show: expect crowds or street closures; mention it in day-of messaging`,
      source: {
        dataset: 'NYC Permitted Event Information (tvpp-9vvx)',
        recordId: ev.sourceId,
        url: 'https://data.cityofnewyork.us/d/tvpp-9vvx',
      },
    });
  }
  if (failed)
    notes.push(
      `${failed} permitted event${failed > 1 ? 's' : ''} that night couldn't be placed (street segments need NYC Geoclient)`,
    );
  if (skipped)
    notes.push(`${skipped} more permitted events weren't checked this run (geocoding limit)`);

  const rank = { high: 0, warn: 1, info: 2 } as const;
  disruptions.sort((a, b) => rank[a.severity] - rank[b.severity]);
  // Keep everything that matters; cap minor items so they don't bury it.
  const major = disruptions.filter((d) => d.severity !== 'info');
  const minor = disruptions.filter((d) => d.severity === 'info');
  return { disruptions: [...major, ...minor.slice(0, MAX_INFO)], notes };
}
