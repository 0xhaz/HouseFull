import { CitySchema, LikedArtistSchema, TonightWhenSchema } from '@housefull/shared';
import { Controller, Get, Ip, Query, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { z } from 'zod';
import { dailyIpHash } from '../common/ip.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { TonightService } from './tonight.service.js';

/** `likes` is a JSON array of {id, name} picked from /tonight/artists (max 5). */
const TonightQuery = z.object({
  city: CitySchema,
  when: TonightWhenSchema.default('tonight'),
  likes: z
    .string()
    .optional()
    .transform((s, ctx) => {
      if (!s) return [];
      try {
        return z.array(LikedArtistSchema).max(5).parse(JSON.parse(s));
      } catch {
        ctx.addIssue({ code: 'custom', message: 'likes must be a JSON array of {id, name}' });
        return z.NEVER;
      }
    }),
});
const ArtistQuery = z.object({ q: z.string().trim().min(2).max(80) });

@Controller('tonight')
@UseGuards(ThrottlerGuard)
export class TonightController {
  constructor(private readonly tonight: TonightService) {}

  /** What's on in the city: soonest first, with taste scores when `likes` are given. */
  @Get()
  @Throttle({ default: { limit: 120, ttl: 60 * 60 * 1000 } })
  list(@Query(new ZodPipe(TonightQuery)) q: z.infer<typeof TonightQuery>, @Ip() ip: string) {
    return this.tonight.tonight(q.city, q.when, q.likes, { ipHash: dailyIpHash(ip) });
  }

  /** Jazz clubs, pubs and bars with live music, ranked by taste when `likes` are given. */
  @Get('spots')
  @Throttle({ default: { limit: 120, ttl: 60 * 60 * 1000 } })
  spots(@Query(new ZodPipe(TonightQuery)) q: z.infer<typeof TonightQuery>, @Ip() ip: string) {
    return this.tonight.spots(q.city, q.likes, { ipHash: dailyIpHash(ip) });
  }

  /** Artist picker for "artists you like" (Qloo search). */
  @Get('artists')
  @Throttle({ default: { limit: 120, ttl: 60 * 60 * 1000 } })
  artists(@Query(new ZodPipe(ArtistQuery)) q: z.infer<typeof ArtistQuery>, @Ip() ip: string) {
    return this.tonight.artists(q.q, { ipHash: dailyIpHash(ip) });
  }
}
