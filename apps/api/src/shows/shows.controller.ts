import { Ticketmaster } from '@housefull/events';
import { haversineKm } from '@housefull/geo';
import type { QlooClient } from '@housefull/qloo-client';
import { CITY_META, CitySchema, type PresetShow } from '@housefull/shared';
import { BadRequestException, Controller, Get, Ip, Query, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { dailyIpHash } from '../common/ip.js';
import { InjectQloo } from '../qloo/qloo.module.js';
import { PRESETS } from './presets.js';

/** Venues further than this from the city center are another city's. */
const CITY_RADIUS_KM = 60;

@Controller('shows')
export class ShowsController {
  constructor(@InjectQloo() private readonly qloo: QlooClient) {}

  private readonly ticketmaster = new Ticketmaster({
    apiKey: process.env.TICKETMASTER_API_KEY || undefined,
  });

  /** Ticketmaster-backed show picker: upcoming music events matching q near the city. */
  @Get('search')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async search(@Query('q') q: string | undefined, @Query('city') city: string | undefined) {
    const parsed = CitySchema.safeParse(city);
    if (!q || q.trim().length < 2 || !parsed.success)
      throw new BadRequestException('Pass q (2+ characters) and city');
    const [lng, lat] = CITY_META[parsed.data].center;
    const r = await this.ticketmaster.find({ keyword: q.trim(), lat, lng });
    if (!r.available) return { available: false, reason: r.reason, events: [] };
    return {
      available: true,
      events: r.events
        // Upcoming only: Ticketmaster also returns events that started earlier today or are ongoing.
        .filter(
          (e) =>
            e.lat !== undefined &&
            e.lng !== undefined &&
            e.date >= new Date().toISOString().slice(0, 10),
        )
        .slice(0, 10)
        .map((e) => ({
          id: e.id,
          name: e.name,
          artist: e.artist ?? e.name,
          venue: e.venue,
          date: e.date,
          lat: e.lat,
          lng: e.lng,
        })),
    };
  }

  @Get('presets')
  presets(): PresetShow[] {
    return PRESETS;
  }

  /** Venue picker for hand-entered shows: Qloo place search, kept to the chosen city. */
  @Get('venues')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async venues(
    @Query('q') q: string | undefined,
    @Query('city') city: string | undefined,
    @Ip() ip: string,
  ) {
    const parsed = CitySchema.safeParse(city);
    if (!q || q.trim().length < 2 || !parsed.success)
      throw new BadRequestException('Pass q (2+ characters) and city');
    const center = CITY_META[parsed.data].center;
    const res = await this.qloo.search(
      { query: q.trim(), types: ['urn:entity:place'], take: 15 },
      { ipHash: dailyIpHash(ip) },
    );
    return res.data.results
      .flatMap((e) => {
        const lat = e.location?.lat;
        const lng = e.location?.lon;
        if (lat === undefined || lng === undefined) return [];
        if (haversineKm({ lat, lng }, { lat: center[1], lng: center[0] }) > CITY_RADIUS_KM)
          return [];
        const address = (e.properties as Record<string, unknown> | undefined)?.address;
        return [
          {
            entityId: e.entity_id,
            name: e.name,
            address: typeof address === 'string' ? address : undefined,
            lat,
            lng,
          },
        ];
      })
      .slice(0, 8);
  }
}
