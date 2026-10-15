// Synthetic Qloo-shaped data for tests (invented entities; never real responses).
import type { QlooEntity } from '@housefull/qloo-client';
import type { GeoStore } from './deps.js';

const tag = (type: string, name: string) => ({
  id: `urn:tag:${name.toLowerCase().replaceAll(' ', '_')}`,
  name,
  type,
});
const G = 'urn:tag:genre:music';
const S = 'urn:tag:style:qloo';
const M = 'urn:tag:music:qloo';

const JAZZ = [
  tag(G, 'Jazz'),
  tag(G, 'Soul'),
  tag(S, 'Smooth'),
  tag(M, 'Groovy'),
  tag(S, 'Late Night'),
  tag(G, 'Funk'),
];
const PSYCH = [
  tag(G, 'Psychedelic Rock'),
  tag(G, 'Garage'),
  tag(S, 'Fuzzy'),
  tag(M, 'Loud'),
  tag(S, 'Sweaty'),
  tag(G, 'Surf'),
];
const SHARED = [tag(M, 'Instrumental'), tag(S, 'Vinyl')];

export function syntheticRing(): QlooEntity[] {
  const make = (prefix: string, tags: typeof JAZZ, i: number, affinity: number): QlooEntity => ({
    entity_id: `SYN-${prefix}-${i}`,
    name: `${prefix} Act ${i}`,
    type: 'urn:entity',
    subtype: 'urn:entity:artist',
    popularity: 0.5,
    tags: [...tags.slice(0, 4 + (i % 3)), ...SHARED],
    query: { affinity },
  });
  return [
    ...Array.from({ length: 6 }, (_, i) => make('Jazz', JAZZ, i, 0.95 - i * 0.01)),
    ...Array.from({ length: 6 }, (_, i) => make('Psych', PSYCH, i, 0.9 - i * 0.01)),
    {
      entity_id: 'SYN-THIN',
      name: 'Thin Act',
      subtype: 'urn:entity:artist',
      tags: [JAZZ[0] as (typeof JAZZ)[number]],
      query: { affinity: 0.5 },
    },
  ];
}

const HOODS = ['Alpha', 'Bravo', 'Charlie', 'Delta'];
const cells = (bias: number) =>
  Array.from({ length: 16 }, (_, i) => ({
    location: { latitude: 40.7 + i * 0.01, longitude: -73.9, geohash: `dr5r${i.toString(16)}0` },
    query: { affinity: i < 4 ? bias : 0.5 - i * 0.01, popularity: 0.6 },
  }));

/** Fake Qloo host: answers by endpoint + filter.type with synthetic shapes. */
export function fakeFetch(calls: string[]): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = new URL(String(input));
    const type = url.searchParams.get('filter.type') ?? '';
    calls.push(`${url.pathname} ${type}`);
    const json = (b: unknown) => new Response(JSON.stringify(b));
    if (url.pathname === '/search')
      return json({
        results: [
          { entity_id: 'SYN-HEAD', name: 'Synthetic Headliner', types: ['urn:entity:artist'] },
        ],
      });
    if (type === 'urn:tag' && url.searchParams.has('signal.location'))
      return json({
        results: { tags: [{ tag_id: 'urn:tag:ambience:qloo:intimate', name: 'Intimate' }] },
      });
    if (type === 'urn:tag')
      return json({
        results: {
          tags: [
            { tag_id: 'urn:tag:genre:music:jazz', name: 'Jazz', query: { affinity: 0.9 } },
            { tag_id: 'urn:tag:style:qloo:intimate', name: 'Intimate', query: { affinity: 0.8 } },
          ],
        },
      });
    if (type === 'urn:demographics')
      return json({
        results: {
          demographics: [
            { entity_id: 'SYN-HEAD', query: { age: { '35_to_44': 0.3 }, gender: { male: 0.02 } } },
          ],
        },
      });
    if (type === 'urn:entity:artist') {
      // The core-affinity call (filter.results.entities) scores candidates lower than the ring call.
      const core = url.searchParams.has('filter.results.entities');
      return json({
        results: {
          entities: syntheticRing().map((e) => ({
            ...e,
            query: {
              affinity: (e.query?.affinity ?? 0.5) * (core ? 0.5 : 1),
              explainability: {
                'signal.interests.entities': [{ entity_id: 'SYN-Jazz-0', score: 0.8 }],
              },
            },
          })),
        },
      });
    }
    if (type === 'urn:heatmap') return json({ results: { heatmap: cells(0.99) } });
    if (type === 'urn:entity:place')
      return json({
        results: {
          entities: [
            {
              entity_id: 'SYN-BAR',
              name: 'Synthetic Bar',
              subtype: 'urn:entity:place',
              tags: [{ id: 'urn:tag:genre:place:restaurant:bar', name: 'Bar' }],
              properties: { hours: { friday: [{ opens: 'T17:00:00', closes: 'T02:00:00' }] } },
              query: { distance: 420.4 },
            },
            {
              entity_id: 'SYN-CAFE',
              name: 'Morning Cafe',
              subtype: 'urn:entity:place',
              tags: [{ id: 'urn:tag:genre:place:cafe', name: 'Cafe' }],
              properties: { hours: { friday: [{ opens: 'T07:00:00', closes: 'T15:00:00' }] } },
              query: { distance: 300 },
            },
            {
              entity_id: 'SYN-INK',
              name: 'Ink Shop',
              subtype: 'urn:entity:place',
              tags: [{ id: 'urn:tag:genre:place:tattoo', name: 'Tattoo' }],
              query: { distance: 200 },
            },
          ],
        },
      });
    return json({
      results: {
        entities: [{ entity_id: `SYN-${type}`, name: `Synthetic ${type}`, subtype: type }],
      },
    });
  }) as typeof fetch;
}

export const geo: GeoStore = {
  cityBbox: async () => 'POLYGON((-74 40.6,-73.8 40.6,-73.8 40.9,-74 40.9,-74 40.6))',
  baseline: async () =>
    cells(0.5).map((c) => ({
      geohash: c.location.geohash,
      affinity: 0.5 + (Number.parseInt(c.location.geohash[4] ?? '0', 16) % 4) * 0.01,
    })),
  snap: async (_city, geohashes) =>
    geohashes.map((g, i) => ({
      geohash: g,
      neighborhoodId: `nyc:${i % 4}`,
      name: HOODS[i % 4] as string,
      share: 1,
    })),
  access: async () => ({
    mode: 'transit',
    method: 'gtfs',
    minutes: new Map(HOODS.map((_, i) => [`nyc:${i}`, 10 + i * 10])),
  }),
};
