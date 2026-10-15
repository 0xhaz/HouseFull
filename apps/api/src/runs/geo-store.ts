import type { GeoStore } from '@housefull/agent';
import {
  accessMinutes,
  baselineCells,
  cities,
  cityEventsInWindow,
  type Db,
  incidentsNear,
  lateNightWalk,
  lateStations,
  peerIncidentMedian,
  routesForNeighborhoods,
  routesNearPoint,
  setCityEventPoint,
  snapToNeighborhoods,
} from '@housefull/db';
import { Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { InjectDb } from '../db/db.module.js';

@Injectable()
export class DbGeoStore implements GeoStore {
  constructor(@InjectDb() private readonly db: Db) {}

  async cityBbox(city: string) {
    const [row] = await this.db
      .select({ bbox: sql<string>`ST_AsText(ST_Envelope(${cities.polygon}))` })
      .from(cities)
      .where(eq(cities.id, city));
    if (!row?.bbox) throw new Error(`No boundary for ${city}: run \`pnpm import:boundaries\``);
    return row.bbox;
  }

  baseline(city: string) {
    return this.db
      .select({ geohash: baselineCells.geohash, affinity: baselineCells.affinity })
      .from(baselineCells)
      .where(eq(baselineCells.cityId, city));
  }

  snap(city: string, geohashes: string[]) {
    return snapToNeighborhoods(this.db, city, geohashes);
  }

  access(city: string, lng: number, lat: number) {
    return accessMinutes(this.db, city, lng, lat);
  }

  cityEvents(city: string, start: Date, end: Date) {
    return cityEventsInWindow(this.db, city, start, end);
  }

  setEventPoint(id: string, lng: number, lat: number) {
    return setCityEventPoint(this.db, id, lng, lat);
  }

  routesNear(city: string, lng: number, lat: number) {
    return routesNearPoint(this.db, city, lng, lat);
  }

  neighborhoodRoutes(city: string, names: string[]) {
    return routesForNeighborhoods(this.db, city, names);
  }

  incidentsNear(city: string, lng: number, lat: number) {
    return incidentsNear(this.db, city, lng, lat);
  }

  peerIncidents(city: string, lng: number, lat: number) {
    return peerIncidentMedian(this.db, city, lng, lat);
  }

  lateStations(city: string, lng: number, lat: number, dayType: string) {
    return lateStations(this.db, city, lng, lat, dayType);
  }

  walkRoute(city: string, from: { lng: number; lat: number }, to: { lng: number; lat: number }) {
    return lateNightWalk(this.db, city, from, to);
  }
}
