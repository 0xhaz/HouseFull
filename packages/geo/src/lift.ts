/**
 * Lift math (architecture §5.3).
 *
 * Raw Qloo heatmaps mostly show how busy an area is, so we never rank by raw
 * affinity. Instead each cell's segment affinity is divided by a generic
 * nightlife baseline for the same city, after converting both to percentile
 * ranks so the two heatmaps are on the same scale.
 */

export type Cell = { geohash: string; affinity: number };

export type LiftCell = {
  geohash: string;
  /** Percentile rank (0–1] of the segment's affinity in this city. */
  target: number;
  /** Percentile rank (0–1] of the nightlife baseline. */
  baseline: number;
  lift: number;
};

/** Smoothing so near-empty baseline cells can't explode the ratio. */
export const LIFT_EPSILON = 0.05;

/**
 * Percentile rank in (0, 1]: share of values ≤ this one. Ties share the
 * highest rank, so equal affinities always get equal percentiles.
 */
export function percentileRanks(values: number[]): number[] {
  const n = values.length;
  if (n === 0) return [];
  const sorted = [...values].sort((a, b) => a - b);
  const upper = (v: number) => {
    let lo = 0;
    let hi = n;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if ((sorted[mid] as number) <= v) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  return values.map((v) => upper(v) / n);
}

export function cellLift(target: number, baseline: number, eps = LIFT_EPSILON): number {
  return (target + eps) / (baseline + eps);
}

/**
 * Joins a segment heatmap with the city baseline on geohash, then ranks both
 * over the same joined cells. Ranking each over its own cell set biases lift:
 * a segment heatmap only has cells with some signal (mostly busy ones), so
 * those cells would rank low there but high against the full-city baseline.
 * Cells missing from either side are dropped: no baseline means no idea of normal activity.
 */
export function liftCells(target: Cell[], baseline: Cell[], eps = LIFT_EPSILON): LiftCell[] {
  const base = new Map(baseline.map((c) => [c.geohash, c.affinity]));
  const joined = target.flatMap((c) => {
    const b = base.get(c.geohash);
    return b === undefined ? [] : [{ geohash: c.geohash, t: c.affinity, b }];
  });
  const tPct = percentileRanks(joined.map((c) => c.t));
  const bPct = percentileRanks(joined.map((c) => c.b));
  return joined.map((c, i) => {
    const t = tPct[i] as number;
    const b = bPct[i] as number;
    return { geohash: c.geohash, target: t, baseline: b, lift: cellLift(t, b, eps) };
  });
}

export type NeighborhoodLift = {
  neighborhoodId: string;
  /** Weighted mean lift; weight = baseline × share of the cell inside the area. */
  lift: number;
  /** Sum of weights: a proxy for how much nightlife activity the area holds. */
  mass: number;
  /** Effective number of cells (Σ share). */
  cells: number;
  /** Less than `minCells` of effective coverage: the critic flags it as thin data. */
  lowConfidence: boolean;
};

/**
 * lift(n) = Σ lift(g)·w(g) / Σ w(g), with w(g) = baseline(g) · share(g, n).
 * `share` defaults to 1 (whole cell inside the neighborhood).
 */
export function neighborhoodLift(
  neighborhoodId: string,
  cells: Array<LiftCell & { share?: number }>,
  minCells = 1.5,
): NeighborhoodLift | null {
  let num = 0;
  let mass = 0;
  let effective = 0;
  for (const c of cells) {
    const share = c.share ?? 1;
    const w = c.baseline * share;
    num += c.lift * w;
    mass += w;
    effective += share;
  }
  if (mass === 0) return null;
  return {
    neighborhoodId,
    lift: num / mass,
    mass,
    cells: effective,
    lowConfidence: effective < minCells,
  };
}

/**
 * access(n, venue) in (0, 1]: exponential decay with travel minutes.
 * τ is the "half-interest" scale; starting values, tune after the demo shows are seeded.
 */
export const ACCESS_TAU_MIN = { transit: 30, drive: 25 } as const;

export function access(minutes: number, mode: keyof typeof ACCESS_TAU_MIN): number {
  return Math.exp(-Math.max(0, minutes) / ACCESS_TAU_MIN[mode]);
}

export type RankedNeighborhood = NeighborhoodLift & {
  /** Mass normalized to the city's busiest neighborhood, in (0, 1]. */
  reach: number;
  accessMin: number;
  access: number;
  /** score(n) = lift(n) · reach(n) · access(n, venue) */
  score: number;
};

export function rankNeighborhoods(
  lifts: NeighborhoodLift[],
  accessMinutes: Map<string, number>,
  mode: keyof typeof ACCESS_TAU_MIN,
): RankedNeighborhood[] {
  const maxMass = Math.max(0, ...lifts.map((l) => l.mass));
  if (maxMass === 0) return [];
  return lifts
    .flatMap((l) => {
      const minutes = accessMinutes.get(l.neighborhoodId);
      if (minutes === undefined) return [];
      const reach = l.mass / maxMass;
      const a = access(minutes, mode);
      return [{ ...l, reach, accessMin: minutes, access: a, score: l.lift * reach * a }];
    })
    .sort((x, y) => y.score - x.score);
}
