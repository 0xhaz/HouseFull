import { resetMtaCache } from '@housefull/disruptions';
import { Ticketmaster } from '@housefull/events';
import { MemoryBudget, QlooClient } from '@housefull/qloo-client';
import { DisruptionSchema, type ShowInput } from '@housefull/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import type { AgentDeps, CityEvent, GeoStore } from '../deps.js';
import { runAgent } from '../run.js';
import { fakeFetch, geo } from '../testkit.js';
import { showNightDisruptions } from './disruptions.js';

const show: ShowInput = {
  artist: 'Synthetic Headliner',
  venue: { name: 'Test Hall', lat: 40.72, lng: -73.94 },
  city: 'nyc',
  date: '2026-11-20',
};
const at = (iso: string) => Date.parse(iso) / 1000;
const mta = {
  entity: [
    {
      id: 'L-work',
      alert: {
        active_period: [{ start: at('2026-11-20T20:00:00Z'), end: at('2026-11-21T10:00:00Z') }],
        informed_entity: [{ route_id: 'L' }],
        header_text: {
          translation: [
            { text: 'No [L] trains between Bedford Av and Myrtle-Wyckoff', language: 'en' },
          ],
        },
        'transit_realtime.mercury_alert': { alert_type: 'Planned - Part Suspended' },
      },
    },
    {
      id: 'G-delay',
      alert: {
        active_period: [{ start: at('2026-11-20T22:00:00Z'), end: at('2026-11-21T02:00:00Z') }],
        informed_entity: [{ route_id: 'G' }],
        header_text: { translation: [{ text: '[G] delays' }] },
        'transit_realtime.mercury_alert': { alert_type: 'Delays' },
      },
    },
  ],
};

const ev = (
  id: string,
  location: string,
  lng: number | null = null,
  lat: number | null = null,
): CityEvent => ({
  id,
  sourceId: `${id}:src`,
  title: id,
  type: 'Street Festival',
  startsAt: new Date('2026-11-20T21:00:00Z'),
  endsAt: new Date('2026-11-21T02:00:00Z'),
  location,
  borough: 'Brooklyn',
  lng,
  lat,
});

describe('showNightDisruptions', () => {
  beforeEach(() => resetMtaCache());

  it('finds venue and segment transit issues and nearby events, with sources', async () => {
    const saved: string[] = [];
    const nycGeo: GeoStore = {
      ...geo,
      routesNear: async () => [{ name: 'Montrose Av', routes: ['L'], meters: 300 }],
      neighborhoodRoutes: async (_c, names) =>
        new Map(names.map((n, i) => [n, i === 0 ? ['G'] : ['J']])),
      cityEvents: async () => [
        ev('near', '100 Test Street'),
        ev('far', 'Far Away Park: Lawn', -73.8, 40.6),
        ev('segment', 'BEDFORD AVE between N 7 ST and N 8 ST'),
      ],
      setEventPoint: async (id) => void saved.push(id),
    };
    const fetchImpl = (async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('mta.info')) return new Response(JSON.stringify(mta));
      if (url.includes('geosearch'))
        return new Response(
          JSON.stringify({
            features: [
              {
                properties: { label: '100 TEST ST' },
                geometry: { coordinates: [-73.943, 40.721] },
              },
            ],
          }),
        );
      throw new Error(`unexpected ${url}`);
    }) as typeof fetch;
    const deps: AgentDeps = {
      runId: 'r',
      qloo: new QlooClient({
        apiKey: 't',
        fetch: fakeFetch([]),
        budget: new MemoryBudget(500, 500),
      }),
      geo: nycGeo,
      ticketmaster: new Ticketmaster(),
      emit: () => {},
    };
    const result = await runAgent(show, deps);
    const { disruptions, notes } = await showNightDisruptions(result, deps, fetchImpl);

    for (const d of disruptions) expect(DisruptionSchema.safeParse(d).success).toBe(true);
    const l = disruptions.find((d) => d.affects.routes?.includes('L'));
    expect(l).toMatchObject({ kind: 'transit_planned', severity: 'high' });
    expect(l?.effect).toContain('serves the venue');
    const g = disruptions.find((d) => d.affects.routes?.includes('G'));
    expect(g).toMatchObject({ kind: 'transit_alert', severity: 'info' });
    expect(g?.affects.segmentIds.length).toBeGreaterThan(0);
    const near = disruptions.find((d) => d.kind === 'city_event');
    expect(near?.title).toContain('near');
    expect(near?.source.recordId).toBe('near:src');
    expect(disruptions.some((d) => d.title.startsWith('far'))).toBe(false);
    expect(saved).toEqual(['near']);
    expect(notes[0]).toContain("1 permitted event that night couldn't be placed");
    // Only the neighborhood the G actually serves is named (the fake gives the G to one area).
    expect(g?.affects.neighborhoods).toHaveLength(1);
    expect(disruptions[0]?.severity).toBe('high');
  });

  it('is NYC-only', async () => {
    const deps = { geo } as unknown as AgentDeps;
    const r = await showNightDisruptions({ show: { ...show, city: 'la' } } as never, deps);
    expect(r).toEqual({ disruptions: [], notes: ['Disruption check is NYC-only for now'] });
  });
});
