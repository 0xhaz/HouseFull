import { describe, expect, it } from 'vitest';
import { ShowInputSchema } from './show.js';

describe('ShowInputSchema', () => {
  const valid = {
    artist: 'Khruangbin',
    venue: { name: 'Brooklyn Steel', lat: 40.7193, lng: -73.9389, capacity: 1800 },
    city: 'nyc',
    date: '2026-11-14',
    soldPct: 42,
  };

  it('accepts a valid show', () => {
    expect(ShowInputSchema.parse(valid)).toEqual(valid);
  });

  it('rejects an unknown city and out-of-range soldPct', () => {
    expect(ShowInputSchema.safeParse({ ...valid, city: 'sf' }).success).toBe(false);
    expect(ShowInputSchema.safeParse({ ...valid, soldPct: 140 }).success).toBe(false);
  });
});
