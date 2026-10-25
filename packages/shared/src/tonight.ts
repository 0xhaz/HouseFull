import { z } from 'zod';
import type { City } from './show.js';

/** "What's on" for people in the city: shows soon, ranked by taste, time and distance. */
export const TonightWhenSchema = z.enum(['tonight', 'tomorrow', 'weekend', 'week']);
export type TonightWhen = z.infer<typeof TonightWhenSchema>;

export const CITY_TZ: Record<City, string> = {
  nyc: 'America/New_York',
  nola: 'America/Chicago',
  la: 'America/Los_Angeles',
};

const DAY = 86_400_000;

/** Local calendar date (YYYY-MM-DD) in a time zone. */
export function localDate(tz: string, at: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(at);
}

/**
 * Local date range for a "when" choice. Tonight includes the small hours of the night
 * before (a 1 am set is still tonight), so before 5 am "tonight" means the previous date too.
 */
export function tonightWindow(city: City, when: TonightWhen, now = new Date()) {
  const tz = CITY_TZ[city];
  const today = localDate(tz, now);
  const plus = (n: number) => localDate(tz, new Date(now.getTime() + n * DAY));
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay(); // 0 = Sunday
  switch (when) {
    case 'tonight': {
      const hour = Number(
        new Intl.DateTimeFormat('en-US', {
          timeZone: tz,
          hour: 'numeric',
          hourCycle: 'h23',
        }).format(now),
      );
      return { from: hour < 5 ? plus(-1) : today, to: today };
    }
    case 'tomorrow':
      return { from: plus(1), to: plus(1) };
    case 'weekend': {
      // Friday to Sunday; from Friday on, the current weekend.
      const toFri = weekday === 0 ? -2 : weekday === 6 ? -1 : 5 - weekday;
      const from = toFri < 0 ? today : plus(toFri);
      const toSun = weekday === 0 ? 0 : 7 - weekday;
      return { from, to: plus(toSun) };
    }
    case 'week':
      return { from: today, to: plus(6) };
  }
}

/** Music scenes for browsing; mapped from Ticketmaster genres. */
export const SceneSchema = z.enum([
  'jazz',
  'indie',
  'electronic',
  'hiphop',
  'folk',
  'pop',
  'latin',
  'other',
]);
export type Scene = z.infer<typeof SceneSchema>;
export const SCENE_LABEL: Record<Scene, string> = {
  jazz: 'Jazz, soul & blues',
  indie: 'Indie & rock',
  electronic: 'Electronic & DJs',
  hiphop: 'Hip-hop & R&B',
  folk: 'Folk & country',
  pop: 'Pop',
  latin: 'Latin & world',
  other: 'More live music',
};

const SCENE_GENRES: Array<[Scene, RegExp]> = [
  ['jazz', /jazz|blues|soul|funk|swing|gospel/i],
  ['hiphop', /hip-?hop|rap|r&b|rnb/i],
  ['electronic', /electro(?!.*pop)|dance|house|techno|edm|dj|drum|trance/i],
  ['folk', /folk|country|americana|bluegrass|singer-?songwriter/i],
  ['latin', /latin|reggae|world|afro|salsa|cumbia|bossa/i],
  ['indie', /rock|indie|alternative|punk|metal|emo|grunge|shoegaze/i],
  ['pop', /pop/i],
];

/** First scene whose genres match, in the order above (jazz before pop, etc.). */
export function sceneOf(genres: string[]): Scene {
  const text = genres.join(' ');
  return SCENE_GENRES.find(([, re]) => re.test(text))?.[0] ?? 'other';
}

/** Room size and feel, from the venue name: badges and the "intimate rooms" filter. */
export const VenueTypeSchema = z.enum(['jazz', 'bar', 'club', 'hall', 'arena', 'venue']);
export type VenueType = z.infer<typeof VenueTypeSchema>;
export const VENUE_TYPE_LABEL: Record<VenueType, string> = {
  jazz: 'Jazz club',
  bar: 'Bar & pub',
  club: 'Club',
  hall: 'Concert hall',
  arena: 'Arena',
  venue: 'Music venue',
};

export function venueTypeOf(name: string): VenueType {
  if (
    /jazz|birdland|blue note|smalls|vanguard|dizzy|mezzrow|iridium|minton|snug harbor|preservation hall|spotted cat|catalina/i.test(
      name,
    )
  )
    return 'jazz';
  if (
    /\b(pub|tavern|saloon|bar|lounge|ale house|taproom|tap room|inn|brewery|cafe|café|grill|cantina)\b/i.test(
      name,
    )
  )
    return 'bar';
  if (/\barena\b|stadium|square garden|barclays|amphitheat|pavilion|ballpark/i.test(name))
    return 'arena';
  if (/\b(club|basement|elsewhere|nightclub|disco|bowl)\b/i.test(name)) return 'club';
  if (
    /theat(er|re)|hall|ballroom|auditorium|opera|paramount|palladium|performing arts|\bcent(er|re)\b/i.test(
      name,
    )
  )
    return 'hall';
  return 'venue';
}

/** Theatre, musicals and classical are out of scope for now: live music in bars, clubs and venues. */
export function isTheatre(e: { name: string; genres: string[] }): boolean {
  return (
    /\b(the )?musical\b|broadway|opera\b|ballet|symphony|philharmonic|orchestra|nutcracker|cirque|mamma mia|bottomless brunch|comedy|stand-?up|drag (show|brunch)|magic show/i.test(
      e.name,
    ) || e.genres.some((g) => /theat(er|re)|classical|opera|musical|broadway/i.test(g))
  );
}

export const TonightEventSchema = z.object({
  id: z.string(),
  name: z.string(),
  artist: z.string(),
  venue: z.string(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  date: z.string(),
  time: z.string().optional(),
  startsAt: z.string().optional(),
  url: z.string().optional(),
  genres: z.array(z.string()),
  scene: SceneSchema,
  venueType: VenueTypeSchema,
  image: z.string().optional(),
  priceFrom: z.object({ amount: z.number(), currency: z.string() }).optional(),
  status: z.string().optional(),
  /** 0–100, only when the visitor gave artists they like and Qloo knows this act. */
  taste: z.number().optional(),
  /**
   * A HouseFull campaign is running for this show and one of its audiences matches what the
   * visitor likes. Labelled as promoted wherever it's shown.
   */
  campaign: z
    .object({ runId: z.string(), audience: z.string(), becauseYouLike: z.array(z.string()) })
    .optional(),
  /** NYC: subway alerts on lines near the venue around show time. */
  transit: z
    .array(z.object({ header: z.string(), routes: z.array(z.string()), suspension: z.boolean() }))
    .optional(),
});
export type TonightEvent = z.infer<typeof TonightEventSchema>;

export const TonightResultSchema = z.object({
  city: z.string(),
  window: z.object({ from: z.string(), to: z.string() }),
  available: z.boolean(),
  reason: z.string().optional(),
  /** Whether taste scores were computed (the visitor gave likes and Qloo answered). */
  tasteUsed: z.boolean(),
  events: z.array(TonightEventSchema),
});
export type TonightResult = z.infer<typeof TonightResultSchema>;

export const LikedArtistSchema = z.object({ id: z.string(), name: z.string() });
export type LikedArtist = z.infer<typeof LikedArtistSchema>;

/** A place with live music worth walking into tonight (no ticket): jazz clubs, pubs, bars. */
export const SpotKindSchema = z.enum(['jazz', 'pub', 'bar']);
export type SpotKind = z.infer<typeof SpotKindSchema>;
export const SPOT_KIND_LABEL: Record<SpotKind, string> = {
  jazz: 'Jazz & blues club',
  pub: 'Pub with live music',
  bar: 'Bar with live music',
};

export const TonightSpotSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: SpotKindSchema,
  address: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  image: z.string().optional(),
  rating: z.number().optional(),
  /** 1–4 */
  priceLevel: z.number().optional(),
  /** Hours on the local date, e.g. "17:00–02:00", or "closed"; from the listing. */
  hours: z.string().optional(),
  website: z.string().optional(),
  phone: z.string().optional(),
  mapsUrl: z.string().optional(),
  /** 0–99 when the visitor gave likes. */
  taste: z.number().optional(),
});
export type TonightSpot = z.infer<typeof TonightSpotSchema>;

export const TonightSpotsSchema = z.object({
  city: z.string(),
  date: z.string(),
  available: z.boolean(),
  spots: z.array(TonightSpotSchema),
});
export type TonightSpots = z.infer<typeof TonightSpotsSchema>;
