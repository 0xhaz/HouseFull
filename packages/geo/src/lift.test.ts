import { describe, expect, it } from 'vitest';
import { centroid, coarsen, encode } from './geohash.js';
import {
  access,
  cellLift,
  LIFT_EPSILON,
  liftCells,
  neighborhoodLift,
  percentileRanks,
  rankNeighborhoods,
} from './lift.js';

describe('percentileRanks', () => {
  it('ranks into (0, 1] and gives ties the same rank', () => {
    expect(percentileRanks([0.1, 0.5, 0.5, 0.9])).toEqual([0.25, 0.75, 0.75, 1]);
    expect(percentileRanks([])).toEqual([]);
  });
});

describe('cellLift', () => {
  it('is 1 when target and baseline match (busy areas cancel out)', () => {
    expect(cellLift(0.95, 0.95)).toBeCloseTo(1);
    expect(cellLift(0.2, 0.2)).toBeCloseTo(1);
  });

  it('is above 1 where the segment over-indexes', () => {
    expect(cellLift(0.9, 0.3)).toBeGreaterThan(2);
  });

  it('stays finite when the baseline is zero', () => {
    expect(cellLift(1, 0)).toBeCloseTo((1 + LIFT_EPSILON) / LIFT_EPSILON);
  });
});

describe('liftCells', () => {
  it('drops cells with no baseline and compares on percentile scale', () => {
    const target = [
      { geohash: 'a', affinity: 0.2 },
      { geohash: 'b', affinity: 0.8 },
      { geohash: 'z', affinity: 0.9 },
    ];
    // Baseline on a different raw scale: only rank order matters.
    const baseline = [
      { geohash: 'a', affinity: 50 },
      { geohash: 'b', affinity: 10 },
    ];
    const cells = liftCells(target, baseline);
    expect(cells.map((c) => c.geohash)).toEqual(['a', 'b']);
    const b = cells.find((c) => c.geohash === 'b');
    const a = cells.find((c) => c.geohash === 'a');
    expect(b?.lift).toBeGreaterThan(1);
    expect(a?.lift).toBeLessThan(1);
  });

  it('ranks both sides over the joined cells only', () => {
    // A sparse segment heatmap covering only the busiest baseline cells, in the same order,
    // must come out ≈1, not < 1 because the baseline also has many quiet cells.
    const baseline = Array.from({ length: 100 }, (_, i) => ({
      geohash: `g${i}`,
      affinity: i / 100,
    }));
    const target = baseline.slice(80).map((c) => ({ ...c }));
    for (const c of liftCells(target, baseline)) expect(c.lift).toBeCloseTo(1);
  });

  it('a popularity-shaped segment has lift ≈ 1 everywhere', () => {
    const shared = Array.from({ length: 20 }, (_, i) => ({ geohash: `g${i}`, affinity: i / 20 }));
    for (const c of liftCells(shared, shared)) expect(c.lift).toBeCloseTo(1);
  });
});

describe('neighborhoodLift', () => {
  it('weights cells by baseline so empty cells barely count', () => {
    const n = neighborhoodLift('bk:1', [
      { geohash: 'x', target: 0.9, baseline: 0.9, lift: 1 },
      { geohash: 'y', target: 0.5, baseline: 0.01, lift: 9 },
      { geohash: 'w', target: 0.6, baseline: 0.6, lift: 1 },
    ]);
    expect(n?.lift).toBeLessThan(1.1);
    expect(n?.lowConfidence).toBe(false);
  });

  it('weights partial cells by their share of the area', () => {
    const n = neighborhoodLift('n', [
      { geohash: 'x', target: 0.9, baseline: 0.5, lift: 3, share: 0.1 },
      { geohash: 'y', target: 0.5, baseline: 0.5, lift: 1, share: 1 },
    ]);
    expect(n?.lift).toBeCloseTo((3 * 0.05 + 1 * 0.5) / 0.55);
    expect(n?.cells).toBeCloseTo(1.1);
    expect(n?.lowConfidence).toBe(true);
  });

  it('flags thin data and returns null with no weight', () => {
    expect(
      neighborhoodLift('n', [{ geohash: 'x', target: 1, baseline: 0.5, lift: 2 }])?.lowConfidence,
    ).toBe(true);
    expect(neighborhoodLift('n', [])).toBeNull();
  });
});

describe('rankNeighborhoods', () => {
  it('orders by lift × reach × access and skips areas with no travel time', () => {
    const lifts = [
      { neighborhoodId: 'near-ok', lift: 1.5, mass: 10, cells: 5, lowConfidence: false },
      { neighborhoodId: 'far-hot', lift: 2.5, mass: 10, cells: 5, lowConfidence: false },
      { neighborhoodId: 'tiny-hot', lift: 3, mass: 1, cells: 5, lowConfidence: false },
      { neighborhoodId: 'unreachable', lift: 5, mass: 10, cells: 5, lowConfidence: false },
    ];
    const minutes = new Map([
      ['near-ok', 10],
      ['far-hot', 75],
      ['tiny-hot', 10],
    ]);
    const ranked = rankNeighborhoods(lifts, minutes, 'transit');
    expect(ranked.map((r) => r.neighborhoodId)).toEqual(['near-ok', 'tiny-hot', 'far-hot']);
    expect(ranked[0]?.reach).toBe(1);
  });

  it('access decays with minutes and differs by mode', () => {
    expect(access(0, 'transit')).toBe(1);
    expect(access(30, 'transit')).toBeCloseTo(Math.exp(-1));
    expect(access(30, 'drive')).toBeLessThan(access(30, 'transit'));
    expect(access(-5, 'drive')).toBe(1);
  });
});

describe('geohash', () => {
  it('round-trips a venue to a city heatmap cell', () => {
    const gh = encode(40.7193, -73.9389);
    expect(gh).toHaveLength(6);
    const [lng, lat] = centroid(gh);
    expect(Math.abs(lng + 73.9389)).toBeLessThan(0.01);
    expect(Math.abs(lat - 40.7193)).toBeLessThan(0.01);
  });

  it('coarsens by averaging children', () => {
    expect(
      coarsen(
        [
          { geohash: 'dr5rtwc', affinity: 0.2 },
          { geohash: 'dr5rtwd', affinity: 0.6 },
        ],
        6,
      ),
    ).toEqual([{ geohash: 'dr5rtw', affinity: 0.4 }]);
  });
});
