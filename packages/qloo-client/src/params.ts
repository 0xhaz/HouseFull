export type EntityType =
  | 'urn:entity:artist'
  | 'urn:entity:book'
  | 'urn:entity:brand'
  | 'urn:entity:destination'
  | 'urn:entity:movie'
  | 'urn:entity:person'
  | 'urn:entity:place'
  | 'urn:entity:podcast'
  | 'urn:entity:tv_show'
  | 'urn:entity:video_game';

export type FilterType =
  | EntityType
  | 'urn:heatmap'
  | 'urn:tag'
  | 'urn:demographics'
  | 'urn:audience';

export type AgeBucket =
  | '24_and_younger'
  | '25_to_29'
  | '30_to_34'
  | '35_to_44'
  | '45_to_54'
  | '55_and_older';

export type QueryValue = string | number | boolean;
export type Query = Record<string, string>;

/** Typed view of GET /v2/insights. WKT is longitude first: `POINT(-73.94 40.72)`. */
export type InsightsParams = {
  filterType: FilterType;
  signal?: {
    entities?: string[];
    tags?: string[];
    tagsOperator?: 'union' | 'intersection';
    /** WKT POINT/POLYGON or a locality entity id. */
    location?: string;
    locationQuery?: string;
    locationRadius?: number;
    audiences?: string[];
    age?: AgeBucket[];
    gender?: 'male' | 'female';
  };
  filter?: {
    /** WKT POINT/POLYGON/MULTIPOLYGON or a locality entity id. */
    location?: string;
    locationQuery?: string;
    /** Meters. 0 = strictly inside the boundary. */
    locationRadius?: number;
    geohash?: string;
    excludeEntities?: string[];
    resultsEntities?: string[];
    tags?: string[];
    /** Percentile 0–1. */
    popularityMin?: number;
    popularityMax?: number;
  };
  /** Only geohash works on the hackathon host; `urn:entity:locality` returns 500 (probe, Oct 13). */
  heatmapBoundary?: 'urn:geohash' | 'urn:entity:locality';
  explainability?: boolean;
  /** Default 20, max 50. */
  take?: number;
  page?: number;
  /** Escape hatch for parameters the probe confirms before they get a typed field. */
  extra?: Record<string, QueryValue>;
};

const list = (v?: string[]) => (v && v.length > 0 ? v.join(',') : undefined);

export function insightsQuery(p: InsightsParams): Query {
  const s = p.signal ?? {};
  const f = p.filter ?? {};
  const raw: Record<string, QueryValue | undefined> = {
    'filter.type': p.filterType,
    'signal.interests.entities': list(s.entities),
    'signal.interests.tags': list(s.tags),
    'operator.signal.interests.tags': s.tagsOperator,
    'signal.location': s.location,
    'signal.location.query': s.locationQuery,
    'signal.location.radius': s.locationRadius,
    'signal.demographics.audiences': list(s.audiences),
    'signal.demographics.age': list(s.age),
    'signal.demographics.gender': s.gender,
    'filter.location': f.location,
    'filter.location.query': f.locationQuery,
    'filter.location.radius': f.locationRadius,
    'filter.location.geohash': f.geohash,
    'filter.exclude.entities': list(f.excludeEntities),
    'filter.results.entities': list(f.resultsEntities),
    'filter.tags': list(f.tags),
    'filter.popularity.min': f.popularityMin,
    'filter.popularity.max': f.popularityMax,
    'output.heatmap.boundary': p.heatmapBoundary,
    'feature.explainability': p.explainability,
    take: p.take,
    page: p.page,
    ...p.extra,
  };
  return compact(raw);
}

export function compact(raw: Record<string, QueryValue | undefined>): Query {
  const out: Query = {};
  for (const [k, v] of Object.entries(raw)) if (v !== undefined) out[k] = String(v);
  return out;
}
