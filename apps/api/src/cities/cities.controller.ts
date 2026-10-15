import type { Db } from '@housefull/db';
import { CitySchema } from '@housefull/shared';
import { Controller, Get, Header, NotFoundException, Param } from '@nestjs/common';
import { InjectDb } from '../db/db.module.js';

@Controller('cities')
export class CitiesController {
  constructor(@InjectDb() private readonly db: Db) {}

  /**
   * Residential neighborhood outlines for the lift map, simplified to keep the
   * payload small (~0.0003° ≈ 30 m). Boundaries change rarely: cache for a day.
   */
  @Get(':city/neighborhoods')
  @Header('Cache-Control', 'public, max-age=86400')
  async neighborhoods(@Param('city') city: string) {
    if (!CitySchema.safeParse(city).success) throw new NotFoundException(`Unknown city ${city}`);
    const [row] = await this.db.$client<{ fc: unknown }[]>`
      SELECT json_build_object(
        'type', 'FeatureCollection',
        'features', coalesce(json_agg(json_build_object(
          'type', 'Feature',
          'id', n.id,
          'properties', json_build_object('id', n.id, 'name', n.name),
          'geometry', ST_AsGeoJSON(ST_SimplifyPreserveTopology(n.geom, 0.0003), 5)::json
        )), '[]'::json)
      ) AS fc
      FROM neighborhoods n WHERE n.city_id = ${city} AND n.residential`;
    return row?.fc;
  }
}
