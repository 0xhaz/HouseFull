import { z } from 'zod';

export const CitySchema = z.enum(['nyc', 'nola', 'la']);
export type City = z.infer<typeof CitySchema>;

export const ShowInputSchema = z.object({
  /** Free text, resolved via Qloo /search. */
  artist: z.string().min(1),
  venue: z.object({
    name: z.string().min(1),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    capacity: z.number().int().positive().optional(),
  }),
  city: CitySchema,
  /** ISO date. */
  date: z.iso.date(),
  /** Entered by the user; not publicly available. */
  soldPct: z.number().min(0).max(100).optional(),
  /** Optional, shapes channel mix. */
  budgetUsd: z.number().nonnegative().optional(),
});
export type ShowInput = z.infer<typeof ShowInputSchema>;
