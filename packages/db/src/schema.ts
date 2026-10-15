import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  bigserial,
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * PostGIS geometry in WGS84. The driver returns WKB hex; read shapes with
 * ST_AsGeoJSON in SQL (see ./geo.ts) rather than decoding in JS.
 */
type GeomKind = 'Point' | 'MultiPolygon' | 'LineString' | 'Geometry';
const geometry = (name: string, kind: GeomKind) =>
  customType<{ data: string; driverData: string }>({
    dataType: () => `geometry(${kind}, 4326)`,
  })(name);

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const id = () => uuid('id').primaryKey().default(sql`gen_random_uuid()`);

// ─── Geography ────────────────────────────────────────────────────────────────

/** 'nyc' | 'nola' | 'la' */
export const cities = pgTable('cities', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  polygon: geometry('polygon', 'MultiPolygon'),
  baselineBuiltAt: timestamp('baseline_built_at', { withTimezone: true }),
});

export const neighborhoods = pgTable(
  'neighborhoods',
  {
    id: text('id').primaryKey(), // `${city}:${sourceId}`
    cityId: text('city_id')
      .notNull()
      .references(() => cities.id),
    /** Id in the source dataset (NTA code, NC_ID, neigh_id). */
    sourceId: text('source_id').notNull(),
    name: text('name').notNull(),
    /** False for parks, airports, cemeteries: never ranked as audiences. */
    residential: boolean('residential').notNull().default(true),
    geom: geometry('geom', 'MultiPolygon').notNull(),
    population: integer('population'),
  },
  (t) => [
    index('neighborhoods_geom_idx').using('gist', t.geom),
    index('neighborhoods_city_idx').on(t.cityId),
  ],
);

export const baselineCells = pgTable(
  'baseline_cells',
  {
    cityId: text('city_id')
      .notNull()
      .references(() => cities.id),
    geohash: text('geohash').notNull(),
    affinity: real('affinity').notNull(),
    /** Qloo's per-cell popularity: the zero-cost fallback baseline. */
    popularity: real('popularity'),
    builtAt: timestamp('built_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.cityId, t.geohash] })],
);

export const venues = pgTable(
  'venues',
  {
    id: id(),
    cityId: text('city_id')
      .notNull()
      .references(() => cities.id),
    name: text('name').notNull(),
    geom: geometry('geom', 'Point').notNull(),
    capacity: integer('capacity'),
    ticketmasterId: text('ticketmaster_id').unique(),
  },
  (t) => [index('venues_geom_idx').using('gist', t.geom)],
);

// ─── Runs + Qloo trace ────────────────────────────────────────────────────────

export const runs = pgTable('runs', {
  id: id(),
  input: jsonb('input').notNull(),
  status: text('status').notNull().default('queued'),
  brief: jsonb('brief'),
  /** Salted daily hash; never the raw IP. */
  ipHash: text('ip_hash'),
  /** The workspace that planned it (null for anonymous runs); its runs go when it does. */
  workspaceId: uuid('workspace_id').references((): AnyPgColumn => workspaces.id, {
    onDelete: 'cascade',
  }),
  createdAt: createdAt(),
});

/**
 * A team's space: a Clerk organization, or a public demo workspace (no Clerk org).
 * `persona` picks the dashboard; `profile` holds the persona's details (venue, artist, home cities).
 */
export const workspaces = pgTable('workspaces', {
  id: id(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  persona: text('persona').notNull(),
  clerkOrgId: text('clerk_org_id').unique(),
  isDemo: boolean('is_demo').notNull().default(false),
  profile: jsonb('profile').notNull().default({}),
  createdAt: createdAt(),
});

/** Runs a workspace can see: the ones it created (`owner`) and ones shared with it (`shared`). */
export const workspaceRuns = pgTable(
  'workspace_runs',
  {
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    runId: uuid('run_id')
      .notNull()
      .references(() => runs.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('owner'),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.runId] }), index().on(t.runId)],
);

/** Outreach status per workspace and contact (Qloo entity): a small CRM over the briefs. */
export const outreach = pgTable(
  'outreach',
  {
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    entityId: text('entity_id').notNull(),
    status: text('status').notNull(),
    note: text('note'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.entityId] })],
);

/** Ordered event log per run: lets any instance replay or resume a run's SSE stream. */
export const runEvents = pgTable(
  'run_events',
  {
    runId: uuid('run_id')
      .notNull()
      .references(() => runs.id, { onDelete: 'cascade' }),
    seq: integer('seq').notNull(),
    event: jsonb('event').notNull(),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.runId, t.seq] })],
);

/** Qloo response cache when Upstash isn't configured (private server-side caching is allowed). */
export const qlooCache = pgTable(
  'qloo_cache',
  {
    key: text('key').primaryKey(),
    value: jsonb('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => [index('qloo_cache_expires_idx').on(t.expiresAt)],
);

/** Every Qloo call; `id` is the `sourceRef` that brief claims cite. */
export const qlooCalls = pgTable(
  'qloo_calls',
  {
    id: uuid('id').primaryKey(),
    runId: uuid('run_id').references(() => runs.id, { onDelete: 'cascade' }),
    endpoint: text('endpoint').notNull(),
    params: jsonb('params').notNull(),
    status: integer('status').notNull(),
    ms: integer('ms').notNull(),
    source: text('source').notNull(), // live | cache | fixture
    cached: boolean('cached').notNull(),
    responseDigest: jsonb('response_digest'),
    createdAt: createdAt(),
  },
  (t) => [index('qloo_calls_run_idx').on(t.runId)],
);

/** Recorded Qloo responses for presets / demo mode. Private DB only, never the repo. */
export const fixtures = pgTable('fixtures', {
  key: text('key').primaryKey(),
  response: jsonb('response').notNull(),
  createdAt: createdAt(),
});

export const briefVersions = pgTable(
  'brief_versions',
  {
    runId: uuid('run_id')
      .notNull()
      .references(() => runs.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    brief: jsonb('brief').notNull(),
    changeNote: jsonb('change_note'),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.runId, t.version] })],
);

/** F6: Qloo tag → ad-platform interest. */
export const interestMap = pgTable(
  'interest_map',
  {
    qlooTagId: text('qloo_tag_id').notNull(),
    platform: text('platform').notNull(), // meta | tiktok
    interestName: text('interest_name').notNull(),
  },
  (t) => [primaryKey({ columns: [t.qlooTagId, t.platform] })],
);

/** F2 (stretch). */
export const seasonRuns = pgTable('season_runs', {
  id: id(),
  venueId: uuid('venue_id')
    .notNull()
    .references(() => venues.id),
  showRunIds: uuid('show_run_ids').array().notNull(),
  result: jsonb('result'),
  createdAt: createdAt(),
});

// ─── F7 disruptions / F8 getting home ─────────────────────────────────────────

/** NYC permitted events. The source has no coordinates, so geom is filled by geocoding (nullable). */
export const cityEvents = pgTable(
  'city_events',
  {
    id: id(),
    cityId: text('city_id')
      .notNull()
      .references(() => cities.id),
    source: text('source').notNull(), // dataset id, e.g. tvpp-9vvx
    sourceId: text('source_id').notNull(),
    title: text('title').notNull(),
    type: text('type').notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    location: text('location'),
    borough: text('borough'),
    communityBoard: text('community_board'),
    geom: geometry('geom', 'Geometry'),
    raw: jsonb('raw'),
  },
  (t) => [
    index('city_events_time_idx').on(t.cityId, t.startsAt),
    index('city_events_geom_idx').using('gist', t.geom),
    uniqueIndex('city_events_source_uq').on(t.source, t.sourceId),
  ],
);

export const transitStations = pgTable(
  'transit_stations',
  {
    id: id(),
    cityId: text('city_id')
      .notNull()
      .references(() => cities.id),
    gtfsStopId: text('gtfs_stop_id').notNull(),
    /** Integer vertex id for pgRouting (unique per city). */
    nodeId: integer('node_id').notNull(),
    name: text('name').notNull(),
    routes: text('routes').array().notNull(),
    geom: geometry('geom', 'Point').notNull(),
  },
  (t) => [
    index('transit_stations_geom_idx').using('gist', t.geom),
    uniqueIndex('transit_stations_node_uq').on(t.cityId, t.nodeId),
  ],
);

/** F8: after-show service per station × route × day type (GTFS departures 22:30–01:30). */
export const stationService = pgTable(
  'station_service',
  {
    cityId: text('city_id')
      .notNull()
      .references(() => cities.id),
    gtfsStopId: text('gtfs_stop_id').notNull(),
    route: text('route').notNull(),
    dayType: text('day_type').notNull(), // weekday | saturday | sunday
    /** Departures per direction in the 3-hour window. */
    trips: integer('trips').notNull(),
    /** Average wait between trains in one direction, minutes. */
    headwayMin: real('headway_min').notNull(),
    /** Last departure inside the window (GTFS time, may exceed 24:00). */
    lastDeparture: text('last_departure').notNull(),
  },
  (t) => [primaryKey({ columns: [t.cityId, t.gtfsStopId, t.route, t.dayType] })],
);

/** Station-to-station graph from static GTFS: median ride minutes + walking transfers. */
export const transitEdges = pgTable(
  'transit_edges',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    cityId: text('city_id')
      .notNull()
      .references(() => cities.id),
    source: integer('source').notNull(),
    target: integer('target').notNull(),
    minutes: real('minutes').notNull(),
    kind: text('kind').notNull(), // ride | transfer
  },
  (t) => [index('transit_edges_city_idx').on(t.cityId)],
);

/** F8: aggregate-only use; no victim/suspect fields are imported. */
export const incidents = pgTable(
  'incidents',
  {
    id: id(),
    cityId: text('city_id')
      .notNull()
      .references(() => cities.id),
    sourceId: text('source_id').notNull(),
    /** 'person' | 'property' | 'other' (decision #17). */
    bucket: text('bucket').notNull(),
    category: text('category').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    geom: geometry('geom', 'Point').notNull(),
  },
  (t) => [
    index('incidents_geom_idx').using('gist', t.geom),
    index('incidents_time_idx').on(t.occurredAt),
  ],
);

/** F8 routing graph derived from osm2pgrouting's `ways` (ODbL: never published as a dump). */
export const footEdges = pgTable(
  'foot_edges',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    cityId: text('city_id')
      .notNull()
      .references(() => cities.id),
    source: integer('source').notNull(),
    target: integer('target').notNull(),
    lengthM: real('length_m').notNull(),
    lit: boolean('lit'),
    highway: text('highway'),
    lateOpenCount: integer('late_open_count').notNull().default(0),
    geom: geometry('geom', 'LineString').notNull(),
  },
  (t) => [index('foot_edges_geom_idx').using('gist', t.geom)],
);

// ─── F9 feedback ──────────────────────────────────────────────────────────────

export const trackingLinks = pgTable('tracking_links', {
  code: text('code').primaryKey(),
  runId: uuid('run_id')
    .notNull()
    .references(() => runs.id, { onDelete: 'cascade' }),
  segmentId: text('segment_id').notNull(),
  channel: text('channel').notNull(),
  destination: text('destination').notNull(), // tickets | signup
  targetUrl: text('target_url').notNull(),
  promoCode: text('promo_code'),
  createdAt: createdAt(),
});

/** No IP or user agent: only a salted per-day hash for dedupe. */
export const linkClicks = pgTable(
  'link_clicks',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    code: text('code')
      .notNull()
      .references(() => trackingLinks.code, { onDelete: 'cascade' }),
    day: date('day').notNull(),
    dedupeHash: text('dedupe_hash').notNull(),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('link_clicks_code_day_idx').on(t.code, t.day)],
);

export const checkins = pgTable('checkins', {
  id: id(),
  runId: uuid('run_id')
    .notNull()
    .references(() => runs.id, { onDelete: 'cascade' }),
  briefVersion: integer('brief_version').notNull(),
  bySegment: jsonb('by_segment').notNull(),
  source: text('source').notNull(),
  createdAt: createdAt(),
});

export const surveys = pgTable('surveys', {
  id: id(),
  runId: uuid('run_id').references(() => runs.id, { onDelete: 'set null' }),
  venueId: uuid('venue_id').references(() => venues.id),
  /** Qloo refs offered as "which of these do you also like?". */
  options: jsonb('options').notNull(),
  createdAt: createdAt(),
});

export const surveyResponses = pgTable(
  'survey_responses',
  {
    id: id(),
    surveyId: uuid('survey_id')
      .notNull()
      .references(() => surveys.id, { onDelete: 'cascade' }),
    rating: integer('rating').notNull(),
    heardVia: text('heard_via'),
    alsoLikes: text('also_likes').array().notNull().default(sql`'{}'::text[]`),
    wouldReturn: boolean('would_return'),
    comment: text('comment'),
    createdAt: createdAt(),
  },
  (t) => [index('survey_responses_survey_idx').on(t.surveyId)],
);

export const signupDestinations = pgTable('signup_destinations', {
  venueId: uuid('venue_id')
    .primaryKey()
    .references(() => venues.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(), // webhook | export
  webhookUrlEncrypted: text('webhook_url_encrypted'),
  label: text('label').notNull(),
});

/** Deliberately no response id: sign-ups can't be joined to survey answers. Purged after 7 days. */
export const signupQueue = pgTable(
  'signup_queue',
  {
    id: id(),
    surveyId: uuid('survey_id').notNull(),
    emailEncrypted: text('email_encrypted').notNull(),
    consentText: text('consent_text').notNull(),
    createdAt: createdAt(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => [index('signup_queue_expires_idx').on(t.expiresAt)],
);
