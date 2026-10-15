import type { Ticketmaster } from '@housefull/events';
import type { QlooClient } from '@housefull/qloo-client';
import type { City, RunEvent } from '@housefull/shared';
import type { LlmAdapter } from './llm.js';

/** Database-backed geography, behind an interface so the pipeline can be tested without Postgres. */
export interface GeoStore {
  /** WKT POLYGON of the city's bounding box (short enough for a GET URL). */
  cityBbox(city: City): Promise<string>;
  baseline(city: City): Promise<Array<{ geohash: string; affinity: number }>>;
  /** Area-weighted: each cell split across the residential neighborhoods it overlaps. */
  snap(
    city: City,
    geohashes: string[],
  ): Promise<Array<{ geohash: string; neighborhoodId: string; name: string; share: number }>>;
  access(
    city: City,
    lng: number,
    lat: number,
  ): Promise<{
    mode: 'transit' | 'drive';
    method: 'gtfs' | 'distance';
    minutes: Map<string, number>;
  }>;

  // F7 (NYC): optional so stores without transit or permit data still work.
  cityEvents?(city: City, start: Date, end: Date): Promise<CityEvent[]>;
  setEventPoint?(id: string, lng: number, lat: number): Promise<void>;
  routesNear?(
    city: City,
    lng: number,
    lat: number,
  ): Promise<Array<{ name: string; routes: string[]; meters: number }>>;
  neighborhoodRoutes?(city: City, names: string[]): Promise<Map<string, string[]>>;

  // F8 (NYC): incidents near a point in show hours, peer median, late service, walking route.
  incidentsNear?(
    city: City,
    lng: number,
    lat: number,
  ): Promise<{ person: number; property: number }>;
  peerIncidents?(
    city: City,
    lng: number,
    lat: number,
  ): Promise<{ person: number; property: number; peers: number } | undefined>;
  lateStations?(city: City, lng: number, lat: number, dayType: string): Promise<LateStationInfo[]>;
  walkRoute?(
    city: City,
    from: { lng: number; lat: number },
    to: { lng: number; lat: number },
  ): Promise<WalkRouteInfo | undefined>;
}

export type CityEvent = {
  id: string;
  sourceId: string;
  title: string;
  type: string;
  startsAt: Date;
  endsAt: Date;
  location: string | null;
  borough: string | null;
  lng: number | null;
  lat: number | null;
};

export type AgentDeps = {
  runId: string;
  qloo: QlooClient;
  geo: GeoStore;
  ticketmaster: Ticketmaster;
  llm?: LlmAdapter;
  /** IDs of the Qloo calls recorded for this run; the critic drops claims citing anything else. */
  knownCallIds?: () => Promise<Set<string>>;
  /** Salted daily IP hash, for the per-IP Qloo budget. */
  ipHash?: string;
  emit(event: RunEvent): void;
};

export type LateStationInfo = {
  name: string;
  gtfsStopId: string;
  meters: number;
  lng: number;
  lat: number;
  routes: Array<{ route: string; headwayMin: number }>;
};

export type WalkRouteInfo = {
  geometry: { type: 'LineString'; coordinates: Array<[number, number]> };
  meters: number;
  shortestMeters: number;
  fellBackToShortest: boolean;
  litPct: number | null;
  mainStreetPct: number;
  incidentsPerKm: number;
};
