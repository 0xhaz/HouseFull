import { type City, CitySchema } from '@housefull/shared';

export const DEFAULT_CITY: City = 'nyc';

export function parseCity(value: string | null | undefined): City {
  const parsed = CitySchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_CITY;
}
