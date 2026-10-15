import { GettingHomeSchema } from '@housefull/shared';
import { describe, expect, it } from 'vitest';
import type { AgentDeps, GeoStore } from '../deps.js';
import { geo } from '../testkit.js';
import { dayTypeOf, GETTING_HOME_DISCLAIMER, gettingHome } from './getting-home.js';

const result = {
  show: {
    artist: 'A',
    venue: { name: 'Hall', lat: 40.72, lng: -73.94 },
    city: 'nyc',
    date: '2026-11-20',
  },
  segments: [{ id: 's1', neighborhoods: [{ name: 'Alpha', lift: 1.2, accessMin: 20 }] }],
} as never;

const stations = [
  {
    name: 'Close Av',
    gtfsStopId: 'C1',
    meters: 300,
    lng: -73.941,
    lat: 40.721,
    routes: [{ route: 'G', headwayMin: 20 }],
  },
  {
    name: 'Audience St',
    gtfsStopId: 'A1',
    meters: 600,
    lng: -73.945,
    lat: 40.718,
    routes: [{ route: 'L', headwayMin: 10 }],
  },
];

function deps(over: Partial<GeoStore> = {}): AgentDeps {
  return {
    geo: {
      ...geo,
      lateStations: async () => stations,
      incidentsNear: async () => ({ person: 12, property: 40 }),
      peerIncidents: async () => ({ person: 10, property: 20, peers: 25 }),
      neighborhoodRoutes: async () => new Map([['Alpha', ['L']]]),
      walkRoute: async () => ({
        geometry: {
          type: 'LineString',
          coordinates: [
            [-73.94, 40.72],
            [-73.945, 40.718],
          ],
        },
        meters: 700,
        shortestMeters: 620,
        fellBackToShortest: false,
        litPct: 64,
        mainStreetPct: 70,
        incidentsPerKm: 3,
      }),
      ...over,
    },
  } as unknown as AgentDeps;
}

describe('gettingHome', () => {
  it('picks the station that serves the audience with frequent late trains and suggests a route', async () => {
    const h = await gettingHome(result, deps());
    expect(GettingHomeSchema.safeParse(h).success).toBe(true);
    expect(h?.stations[0]?.name).toBe('Audience St');
    expect(h?.suggestedRoute?.extraVsShortestPct).toBe(13);
    expect(h?.suggestedRoute?.why[0]).toContain('main streets');
    expect(h?.suggestedRoute?.why).toContain(
      'takes a 13% longer walk along busier streets than the shortest path',
    );
    expect(h?.attendeeCopy.at(-1)).toBe(
      'Heading to Audience St? Our suggested route stays on main streets for 70% of the walk.',
    );
    // The chosen station uses the routed walk time (700 m ≈ 9 min), not the straight-line estimate.
    expect(h?.stations[0]?.walkMinutes).toBe(h?.suggestedRoute?.walkMinutes);
    expect(h?.attendeeCopy[0]).toContain(`(${h?.suggestedRoute?.walkMinutes} min walk)`);
    expect(h?.venueContext.note).toContain('in line with similar nightlife areas');
    expect(h?.venueContext.note).toContain('property reports are above');
    expect(h?.disclaimer).toBe(GETTING_HOME_DISCLAIMER);
    const all = JSON.stringify(h).toLowerCase();
    expect(all).not.toMatch(/\bsafe route\b|\bunsafe\b|\bdangerous\b/);
  });

  it('avoids a line with show-night disruptions', async () => {
    const lWork = {
      kind: 'transit_planned' as const,
      title: 'Planned - Suspended: L',
      window: { start: '2026-11-20T23:00:00Z', end: '2026-11-21T06:00:00Z' },
      severity: 'high' as const,
      affects: { segmentIds: [], neighborhoods: [], routes: ['L'] },
      effect: 'x',
      source: { dataset: 'MTA', recordId: '1', url: 'https://new.mta.info/alerts' },
    };
    const h = await gettingHome(result, deps(), [lWork]);
    expect(h?.stations[0]?.name).toBe('Close Av');
    expect(h?.stations.find((s) => s.name === 'Audience St')?.disruptions).toEqual([
      'Planned - Suspended: L',
    ]);
  });

  it('is NYC-only and maps show days to GTFS service days', async () => {
    expect(
      await gettingHome(
        {
          ...(result as object),
          show: { ...(result as { show: object }).show, city: 'la' },
        } as never,
        deps(),
      ),
    ).toBeUndefined();
    expect(dayTypeOf('2026-11-20')).toBe('weekday');
    expect(dayTypeOf('2026-11-21')).toBe('saturday');
    expect(dayTypeOf('2026-11-22')).toBe('sunday');
  });
});
