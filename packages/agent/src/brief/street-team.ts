import { haversineKm } from '@housefull/geo';
import type { RunResult, StreetTeamRoute } from '@housefull/shared';

/** Places worth a poster: not the venue's competitors. */
const STOP_KINDS = new Set(['record store', 'cafe', 'bar', 'restaurant', 'other']);
const MAX_STOPS = 8;
const MIN_STOPS = 3;
const SEGMENTS = 2;
const WALK_M_PER_MIN = 80;
const DETOUR = 1.3;

/**
 * F5: an ordered walking loop from the venue through each top segment's
 * taste-matched places (record stores first). Nearest-neighbour ordering is
 * fine for 3–8 stops; the Google Maps link draws the real walking route.
 */
export function streetTeamRoutes(result: RunResult): StreetTeamRoute[] {
  const venue = { lat: result.show.venue.lat, lng: result.show.venue.lng };
  const used = new Set<string>();
  return result.segments.slice(0, SEGMENTS).flatMap((s) => {
    const pool = s.channels.partnerPlaces
      .filter(
        (p) =>
          Number.isFinite(p.lat) &&
          Number.isFinite(p.lng) &&
          STOP_KINDS.has(p.kind ?? 'other') &&
          !used.has(p.entityId),
      )
      .sort((a, b) => Number(b.kind === 'record store') - Number(a.kind === 'record store'))
      .slice(0, MAX_STOPS);
    if (pool.length < MIN_STOPS) return [];
    const order: typeof pool = [];
    let here = venue;
    const left = [...pool];
    let km = 0;
    while (left.length) {
      let best = 0;
      let bestD = Number.POSITIVE_INFINITY;
      left.forEach((p, i) => {
        const d = haversineKm(here, { lat: p.lat as number, lng: p.lng as number });
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      const [next] = left.splice(best, 1);
      if (!next) break;
      km += bestD;
      order.push(next);
      here = { lat: next.lat as number, lng: next.lng as number };
    }
    for (const p of order) used.add(p.entityId);
    return [
      {
        segmentId: s.id,
        stops: order.map((p, i) => ({
          entityId: p.entityId,
          name: p.name,
          type: p.kind ?? p.type,
          sourceRef: p.sourceRef,
          order: i + 1,
          // ~10 cm precision; drops float noise from Qloo coordinates.
          lat: Math.round((p.lat as number) * 1e6) / 1e6,
          lng: Math.round((p.lng as number) * 1e6) / 1e6,
        })),
        walkMinutes: Math.round((km * 1000 * DETOUR) / WALK_M_PER_MIN),
      },
    ];
  });
}

/** Google Maps walking directions from the venue through the stops (max 9 waypoints). */
export function googleMapsLink(
  venue: { lat: number; lng: number },
  route: StreetTeamRoute,
): string {
  const pts = route.stops.slice(0, 10);
  const last = pts[pts.length - 1];
  const params = new URLSearchParams({
    api: '1',
    origin: `${venue.lat},${venue.lng}`,
    destination: last ? `${last.lat},${last.lng}` : `${venue.lat},${venue.lng}`,
    travelmode: 'walking',
  });
  const way = pts.slice(0, -1).map((p) => `${p.lat},${p.lng}`);
  if (way.length) params.set('waypoints', way.join('|'));
  return `https://www.google.com/maps/dir/?${params}`;
}

const esc = (s: string) =>
  s.replace(
    /[<>&'"]/g,
    (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c] as string,
  );

/** GPX 1.1 with a waypoint per stop and the ordered route. */
export function streetTeamGpx(
  venue: { name: string; lat: number; lng: number },
  route: StreetTeamRoute,
  title: string,
): string {
  const pt = (tag: string, lat: number, lng: number, name: string) =>
    `<${tag} lat="${lat}" lon="${lng}"><name>${esc(name)}</name></${tag}>`;
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="HouseFull" xmlns="http://www.topografix.com/GPX/1/1">',
    `<metadata><name>${esc(title)}</name></metadata>`,
    pt('wpt', venue.lat, venue.lng, `Start: ${venue.name}`),
    ...route.stops.map((s) => pt('wpt', s.lat, s.lng, `${s.order}. ${s.name}`)),
    `<rte><name>${esc(title)}</name>`,
    pt('rtept', venue.lat, venue.lng, venue.name),
    ...route.stops.map((s) => pt('rtept', s.lat, s.lng, s.name)),
    '</rte>',
    '</gpx>',
  ].join('\n');
}
