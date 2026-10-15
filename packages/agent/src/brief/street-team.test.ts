import { describe, expect, it } from 'vitest';
import { googleMapsLink, streetTeamGpx, streetTeamRoutes } from './street-team.js';

const place = (id: string, kind: string, lat: number, lng: number) => ({
  entityId: id,
  name: `${id} & Co`,
  type: 'urn:entity:place',
  sourceRef: 'q1',
  distanceM: 100,
  kind,
  lat,
  lng,
});

const result = {
  show: { venue: { name: 'Hall', lat: 40.7, lng: -73.9 }, city: 'nyc', date: '2026-11-20' },
  segments: [
    {
      id: 's1',
      channels: {
        partnerPlaces: [
          place('far', 'bar', 40.71, -73.9),
          place('near', 'cafe', 40.701, -73.9),
          place('vinyl', 'record store', 40.705, -73.9),
          place('rival', 'venue', 40.7005, -73.9),
          place('nocoords', 'bar', Number.NaN, Number.NaN),
        ],
      },
    },
  ],
} as never;

describe('street team', () => {
  it('orders stops nearest-first from the venue and skips other venues', () => {
    const [r] = streetTeamRoutes(result);
    expect(r?.stops.map((s) => s.entityId)).toEqual(['near', 'vinyl', 'far']);
    expect(r?.walkMinutes).toBeGreaterThan(15);
    expect(r?.walkMinutes).toBeLessThan(25);
  });

  it('exports a walking link and escaped GPX', () => {
    const [r] = streetTeamRoutes(result);
    if (!r) throw new Error('no route');
    const link = googleMapsLink({ lat: 40.7, lng: -73.9 }, r);
    expect(link).toContain('travelmode=walking');
    expect(decodeURIComponent(link)).toContain('waypoints=40.701,-73.9|40.705,-73.9');
    const gpx = streetTeamGpx({ name: 'Hall', lat: 40.7, lng: -73.9 }, r, 'Route');
    expect(gpx).toContain('<rtept lat="40.71" lon="-73.9"><name>far &amp; Co</name></rtept>');
  });
});
