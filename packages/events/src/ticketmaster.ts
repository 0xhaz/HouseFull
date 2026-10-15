import { z } from 'zod';

const VenueSchema = z.looseObject({
  name: z.string(),
  location: z.looseObject({ latitude: z.string(), longitude: z.string() }).optional(),
  city: z.looseObject({ name: z.string() }).optional(),
});

const EventSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  url: z.string().optional(),
  dates: z.looseObject({
    start: z.looseObject({
      localDate: z.string().optional(),
      localTime: z.string().optional(),
      dateTime: z.string().optional(),
    }),
    status: z.looseObject({ code: z.string().optional() }).optional(),
  }),
  classifications: z
    .array(
      z.looseObject({
        genre: z.looseObject({ name: z.string() }).optional(),
        subGenre: z.looseObject({ name: z.string() }).optional(),
      }),
    )
    .optional(),
  images: z
    .array(
      z.looseObject({
        url: z.string(),
        width: z.number().optional(),
        ratio: z.string().optional(),
      }),
    )
    .optional(),
  priceRanges: z
    .array(z.looseObject({ min: z.number().optional(), currency: z.string().optional() }))
    .optional(),
  _embedded: z
    .looseObject({
      venues: z.array(VenueSchema).optional(),
      attractions: z.array(z.looseObject({ name: z.string() })).optional(),
    })
    .optional(),
});

const SearchSchema = z.looseObject({
  _embedded: z.looseObject({ events: z.array(EventSchema) }).optional(),
});

export type TmEvent = {
  id: string;
  name: string;
  /** Headline attraction (usually the artist), when Ticketmaster lists one. */
  artist?: string;
  venue: string;
  date: string;
  time?: string;
  url?: string;
  lat?: number;
  lng?: number;
  /** UTC start, when Ticketmaster has one. */
  startsAt?: string;
  /** Ticketmaster genre and sub-genre, e.g. ["Rock", "Indie Rock"]; "Undefined" is dropped. */
  genres?: string[];
  image?: string;
  priceFrom?: { amount: number; currency: string };
  /** onsale, offsale, cancelled, postponed, rescheduled */
  status?: string;
};

export type EventsResult =
  | { available: true; events: TmEvent[]; source: { dataset: string; url: string } }
  | { available: false; reason: string };

const SOURCE = { dataset: 'Ticketmaster Discovery API', url: 'https://developer.ticketmaster.com' };
const SIX_HOURS = 6 * 60 * 60 * 1000;
/** Same-night competition: music events within 5 km starting 17:00 or later, closest 8. */
export const CONFLICT_RADIUS_KM = 5;
const EVENING_FROM = '17:00:00';
const MAX_CONFLICTS = 8;

export type TicketmasterOptions = {
  apiKey?: string;
  fetch?: typeof fetch;
  now?: () => number;
};

/** Ticketmaster Discovery: same-night conflicts and the show picker. Results cached 6h in memory. */
export class Ticketmaster {
  private readonly cache = new Map<string, { at: number; value: TmEvent[] }>();
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;

  constructor(private readonly opts: TicketmasterOptions = {}) {
    this.fetchImpl = opts.fetch ?? fetch;
    this.now = opts.now ?? Date.now;
  }

  get configured() {
    return Boolean(this.opts.apiKey);
  }

  /** Evening music events near a point on one local date, nearest first. */
  async conflicts(p: {
    lat: number;
    lng: number;
    date: string;
    radiusKm?: number;
  }): Promise<EventsResult> {
    const r = await this.search({
      latlong: `${p.lat},${p.lng}`,
      radius: String(p.radiusKm ?? CONFLICT_RADIUS_KM),
      unit: 'km',
      classificationName: 'music',
      localStartDateTime: `${p.date}T00:00:00,${p.date}T23:59:59`,
      sort: 'date,asc',
      size: '100',
    });
    if (!r.available) return r;
    // Only evening shows compete for the same night out (an 11:00 matinee doesn't).
    const dist = (e: TmEvent) =>
      e.lat === undefined || e.lng === undefined
        ? Number.POSITIVE_INFINITY
        : Math.hypot(e.lat - p.lat, (e.lng - p.lng) * Math.cos((p.lat * Math.PI) / 180));
    const events = r.events
      .filter((e) => !e.time || e.time >= EVENING_FROM)
      .sort((a, b) => dist(a) - dist(b))
      .slice(0, MAX_CONFLICTS);
    return { ...r, events };
  }

  /** Music events within a radius between two local dates (inclusive), soonest first. */
  upcoming(p: {
    lat: number;
    lng: number;
    from: string;
    to: string;
    radiusKm?: number;
  }): Promise<EventsResult> {
    return this.search({
      latlong: `${p.lat},${p.lng}`,
      radius: String(p.radiusKm ?? 25),
      unit: 'km',
      classificationName: 'music',
      localStartDateTime: `${p.from}T00:00:00,${p.to}T23:59:59`,
      sort: 'date,asc',
      size: '100',
    });
  }

  /** Free-text show picker, optionally near a city center. */
  find(p: { keyword: string; lat?: number; lng?: number }): Promise<EventsResult> {
    return this.search({
      keyword: p.keyword,
      classificationName: 'music',
      ...(p.lat !== undefined && p.lng !== undefined
        ? { latlong: `${p.lat},${p.lng}`, radius: '50', unit: 'km' }
        : {}),
      sort: 'date,asc',
      size: '20',
    });
  }

  private async search(params: Record<string, string>): Promise<EventsResult> {
    if (!this.opts.apiKey)
      return { available: false, reason: 'Ticketmaster API key not configured' };
    const key = JSON.stringify(Object.entries(params).sort());
    const hit = this.cache.get(key);
    if (hit && this.now() - hit.at < SIX_HOURS)
      return { available: true, events: hit.value, source: SOURCE };

    const url = new URL('https://app.ticketmaster.com/discovery/v2/events.json');
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    url.searchParams.set('apikey', this.opts.apiKey);
    const res = await this.fetchImpl(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return { available: false, reason: `Ticketmaster returned ${res.status}` };
    const body = SearchSchema.parse(await res.json());
    const events = (body._embedded?.events ?? []).map((e): TmEvent => {
      const v = e._embedded?.venues?.[0];
      return {
        id: e.id,
        name: e.name.trim().replace(/\s+/g, ' '),
        artist: e._embedded?.attractions?.[0]?.name.trim(),
        venue: v?.name ?? 'Unknown venue',
        date: e.dates.start.localDate ?? '',
        time: e.dates.start.localTime,
        url: e.url,
        lat: v?.location ? Number(v.location.latitude) : undefined,
        lng: v?.location ? Number(v.location.longitude) : undefined,
        startsAt: e.dates.start.dateTime,
        genres: [
          ...new Set(
            [e.classifications?.[0]?.genre?.name, e.classifications?.[0]?.subGenre?.name].filter(
              (g): g is string => Boolean(g) && g !== 'Undefined' && g !== 'Other',
            ),
          ),
        ],
        // A wide 16:9 image reads best on a card.
        image: [...(e.images ?? [])]
          .filter((i) => i.ratio === '16_9')
          .sort((a, b) => Math.abs((a.width ?? 0) - 640) - Math.abs((b.width ?? 0) - 640))[0]?.url,
        priceFrom:
          // A 0 minimum is Ticketmaster's "unknown", not free.
          e.priceRanges?.[0]?.min
            ? { amount: e.priceRanges[0].min, currency: e.priceRanges[0].currency ?? 'USD' }
            : undefined,
        status: e.dates.status?.code,
      };
    });
    this.cache.set(key, { at: this.now(), value: events });
    return { available: true, events, source: SOURCE };
  }
}
