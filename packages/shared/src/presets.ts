import { z } from 'zod';
import { ShowInputSchema } from './show.js';

export const PresetShowSchema = z.object({
  id: z.string(),
  label: z.string(),
  /** One line on why this show is a good demo. */
  blurb: z.string(),
  show: ShowInputSchema,
});
export type PresetShow = z.infer<typeof PresetShowSchema>;

export const CITY_META = {
  nyc: { name: 'New York', center: [-73.95, 40.72] as [number, number], zoom: 11 },
  nola: { name: 'New Orleans', center: [-90.07, 29.95] as [number, number], zoom: 12 },
  la: { name: 'Los Angeles', center: [-118.3, 34.06] as [number, number], zoom: 10 },
} as const;
