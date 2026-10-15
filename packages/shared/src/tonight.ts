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
