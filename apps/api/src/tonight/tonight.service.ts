import { type Db, runs } from '@housefull/db';
import { alertsFor, isSuspension, subwayAlerts } from '@housefull/disruptions';
import { Ticketmaster, type TmEvent } from '@housefull/events';
import type { CallContext, QlooClient } from '@housefull/qloo-client';
import {
  type CampaignBrief,
  CITY_META,
  type City,
  type LikedArtist,
  type TonightEvent,
  type TonightResult,
  type TonightWhen,
  tonightWindow,
} from '@housefull/shared';
import { Injectable, Logger } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { InjectDb } from '../db/db.module.js';
import { InjectQloo } from '../qloo/qloo.module.js';
import { DbGeoStore } from '../runs/geo-store.js';

/** Search radius around the city center: LA is spread out, the others are compact. */
const RADIUS_KM: Record<City, number> = { nyc: 20, nola: 15, la: 40 };
/** Taste scoring resolves at most this many acts on Qloo (search results are cached). */
const MAX_TASTE = 40;
const MAX_TRANSIT = 25;
const SHOW_HOURS = 4;
const DROP = new Set(['cancelled', 'postponed', 'offsale']);
const LIVE_LINE_ALERTS = /^(delays|expect delays|reduced service)$/i;

export const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]/g, '');

@Injectable()
export class TonightService {
  private readonly logger = new Logger(TonightService.name);
  private readonly ticketmaster = new Ticketmaster({
    apiKey: process.env.TICKETMASTER_API_KEY || undefined,
  });

  constructor(
    @InjectDb() private readonly db: Db,
    @InjectQloo() private readonly qloo: QlooClient,
    private readonly geo: DbGeoStore,
  ) {}

  async artists(q: string, ctx: CallContext): Promise<LikedArtist[]> {
    const r = await this.qloo.search({ query: q, types: ['urn:entity:artist'], take: 6 }, ctx);
    return r.data.results.map((e) => ({ id: e.entity_id, name: e.name }));
  }

  async tonight(
    city: City,
    when: TonightWhen,
    likes: LikedArtist[],
    ctx: CallContext,
    now = new Date(),
  ): Promise<TonightResult> {
    const window = tonightWindow(city, when, now);
    const [lng, lat] = CITY_META[city].center;
    const r = await this.ticketmaster.upcoming({ lat, lng, ...window, radiusKm: RADIUS_KM[city] });
    if (!r.available)
      return { city, window, available: false, reason: r.reason, tasteUsed: false, events: [] };

    let events = dedupe(r.events)
      .filter((e) => !DROP.has(e.status ?? ''))
      // Over: started more than a show's length ago.
      .filter((e) => !e.startsAt || Date.parse(e.startsAt) + SHOW_HOURS * 3_600_000 > now.getTime())
      .map(toTonight);

    const [taste, campaigns, transit] = await Promise.all([
      likes.length ? this.taste(events, likes, ctx) : undefined,
      this.campaigns(city, window, events, likes),
      city === 'nyc' ? this.transit(events) : undefined,
    ]);
    events = events.map((e) => ({
      ...e,
      ...(taste?.has(e.id) ? { taste: taste.get(e.id) } : {}),
      ...(campaigns.has(e.id) ? { campaign: campaigns.get(e.id) } : {}),
      ...(transit?.has(e.id) ? { transit: transit.get(e.id) } : {}),
    }));
    return { city, window, available: true, tasteUsed: Boolean(taste?.size), events };
  }

  /**
   * Qloo affinity of each act to the visitor's liked artists: resolve the acts (exact name
   * matches only), then one insights call restricted to those acts.
   */
  private async taste(events: TonightEvent[], likes: LikedArtist[], ctx: CallContext) {
    const out = new Map<string, number>();
    try {
      const acts = [...new Set(events.map((e) => e.artist))].slice(0, MAX_TASTE);
      const resolved = new Map<string, string>(); // norm(name) → entity id
      for (let i = 0; i < acts.length; i += 8)
        await Promise.all(
          acts.slice(i, i + 8).map(async (name) => {
            const r = await this.qloo
              .search({ query: name, types: ['urn:entity:artist'], take: 3 }, ctx)
              .catch(() => undefined);
            const hit = r?.data.results.find((x) => norm(x.name) === norm(name));
            if (hit) resolved.set(norm(name), hit.entity_id);
          }),
        );
      const likedIds = new Set(likes.map((l) => l.id));
      const ids = [...new Set(resolved.values())].filter((id) => !likedIds.has(id));
      if (!ids.length) return out;
      const r = await this.qloo.insights(
        {
          filterType: 'urn:entity:artist',
          signal: { entities: likes.map((l) => l.id) },
          filter: { resultsEntities: ids },
          take: 50,
        },
        ctx,
      );
      const scores = tasteScores(
        (r.data.results.entities ?? []).map((e) => ({
          id: e.entity_id,
          affinity: e.query?.affinity ?? 0,
          popularity: e.popularity ?? e.query?.popularity ?? 0,
        })),
      );
      for (const e of events) {
        const id = resolved.get(norm(e.artist));
        if (!id) continue;
        // Liked acts playing tonight are a perfect match.
        if (likedIds.has(id)) out.set(e.id, 100);
        else if (scores.has(id)) out.set(e.id, scores.get(id) as number);
      }
    } catch (e) {
      this.logger.warn(`taste scoring skipped: ${(e as Error).message}`);
    }
    return out;
  }

  /**
   * Shows with a running HouseFull campaign whose audience is fans of an artist the visitor
   * likes. That's the promoter's targeting meeting the fan's own choice: shown as promoted.
   */
  private async campaigns(
    city: City,
    window: { from: string; to: string },
    events: TonightEvent[],
    likes: LikedArtist[],
  ) {
    const out = new Map<string, NonNullable<TonightEvent['campaign']>>();
    if (!likes.length) return out;
    const liked = new Map(likes.map((l) => [norm(l.name), l.name]));
    const rows = await this.db
      .select({ id: runs.id, input: runs.input, brief: runs.brief })
      .from(runs)
      .where(
        and(
          eq(runs.status, 'done'),
          sql`${runs.input}->>'city' = ${city}`,
          sql`${runs.input}->>'date' between ${window.from} and ${window.to}`,
        ),
      );
    for (const row of rows) {
      const input = row.input as { artist: string; venue: { name: string }; date: string };
      const brief = row.brief as CampaignBrief | null;
      const ev = events.find(
        (e) =>
          e.date === input.date &&
          norm(e.artist) === norm(input.artist) &&
          (norm(e.venue).includes(norm(input.venue.name)) ||
            norm(input.venue.name).includes(norm(e.venue))),
      );
      if (!ev || !brief) continue;
      for (const s of brief.segments) {
        const because = s.seeds.flatMap((x) => liked.get(norm(x.name)) ?? []);
        if (because.length) {
          out.set(ev.id, { runId: row.id, audience: s.name, becauseYouLike: because });
          break;
        }
      }
    }
    return out;
  }

  /** NYC: subway alerts on lines within walking distance of each venue, around show time. */
  private async transit(events: TonightEvent[]) {
    const out = new Map<string, NonNullable<TonightEvent['transit']>>();
    try {
      const alerts = await subwayAlerts();
      await Promise.all(
        events.slice(0, MAX_TRANSIT).map(async (e) => {
          if (e.lat === undefined || e.lng === undefined || !e.startsAt) return;
          const stations = await this.geo.routesNear('nyc', e.lng, e.lat);
          const routes = new Set(stations.filter((s) => s.meters <= 800).flatMap((s) => s.routes));
          const start = new Date(e.startsAt);
          const hits = alertsFor(alerts, routes, {
            start: new Date(start.getTime() - 3_600_000),
            end: new Date(start.getTime() + SHOW_HOURS * 3_600_000),
          })
            // Alerts name lines, not stops: planned work and suspensions are usually on another
            // stretch of the line. Keep live, line-wide trouble only.
            .filter((a) => LIVE_LINE_ALERTS.test(a.type))
            .map((a) => ({
              header: a.header,
              routes: a.routes.filter((r) => routes.has(r)),
              suspension: isSuspension(a.type),
            }))
            .slice(0, 3);
          if (hits.length) out.set(e.id, hits);
        }),
      );
    } catch (e) {
      this.logger.warn(`transit alerts skipped: ${(e as Error).message}`);
    }
    return out;
  }
}

/**
 * Raw affinity tracks popularity (arena acts top every list), the same bias the heatmap probe
 * found. Both bunch together, so each is rescaled across tonight's acts: affinity minus half the
 * popularity, rescaled to 0–99. A smaller act close to your taste beats a famous
 * one that's merely compatible.
 */
export function tasteScores(
  rows: Array<{ id: string; affinity: number; popularity: number }>,
): Map<string, number> {
  const scale = (vals: number[]) => {
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    return (v: number) => (hi > lo ? (v - lo) / (hi - lo) : 1);
  };
  const aff = scale(rows.map((r) => r.affinity));
  const pop = scale(rows.map((r) => r.popularity));
  const raw = rows.map((r) => ({ id: r.id, s: aff(r.affinity) - 0.5 * pop(r.popularity) }));
  const out = scale(raw.map((r) => r.s));
  return new Map(raw.map((r) => [r.id, Math.round(out(r.s) * 99)]));
}

/** Ticketmaster lists VIP packages and parking as separate events: one per act, venue and day. */
function dedupe(events: TmEvent[]): TmEvent[] {
  const seen = new Map<string, TmEvent>();
  for (const e of events) {
    if (/parking|vip|package|upgrade/i.test(e.name) && e.artist === undefined) continue;
    const key = `${norm(e.artist ?? e.name)}|${norm(e.venue)}|${e.date}`;
    const prev = seen.get(key);
    if (!prev || (/vip|package|upgrade/i.test(prev.name) && !/vip|package|upgrade/i.test(e.name)))
      seen.set(key, e);
  }
  return [...seen.values()];
}

function toTonight(e: TmEvent): TonightEvent {
  return {
    id: e.id,
    name: e.name,
    artist: e.artist ?? e.name,
    venue: e.venue,
    lat: e.lat,
    lng: e.lng,
    date: e.date,
    time: e.time,
    startsAt: e.startsAt,
    url: e.url,
    genres: e.genres ?? [],
    image: e.image,
    priceFrom: e.priceFrom,
    status: e.status,
  };
}
