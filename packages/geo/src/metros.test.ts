import { describe, expect, it } from 'vitest';
import { haversineKm, metroLift } from './metros.js';

describe('metroLift', () => {
  const metros = [
    { name: 'Hot', lat: 10, lng: 10 },
    { name: 'Big', lat: 20, lng: 20 },
    { name: 'Empty', lat: 50, lng: 50 },
  ];
  const near = (lat: number, lng: number, affinity: number, popularity: number) =>
    Array.from({ length: 4 }, (_, i) => ({ lat: lat + i * 0.01, lng, affinity, popularity }));

  it('ranks over-indexing metros above merely popular ones and drops empty ones', () => {
    const cells = [...near(10, 10, 0.8, 0.5), ...near(20, 20, 0.95, 0.99)];
    const ranked = metroLift(cells, metros);
    expect(ranked.map((r) => r.metro)).toEqual(['Hot', 'Big']);
    expect(ranked[0]?.score).toBeGreaterThan(1.4);
    expect(ranked[1]?.score).toBeLessThan(1);
  });

  it('measures distance in km', () => {
    expect(haversineKm({ lat: 40.71, lng: -74.01 }, { lat: 34.05, lng: -118.24 })).toBeCloseTo(
      3936,
      -1,
    );
  });
});
