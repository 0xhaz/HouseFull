import { describe, expect, it } from 'vitest';
import { hoursOn, openAt, placeKind } from './places.js';

const place = (tags: string[], hours?: Record<string, unknown>) => ({
  entity_id: 'P',
  name: 'P',
  tags: tags.map((id) => ({ id, name: id.split(':').pop() })),
  properties: hours ? { hours } : {},
});

describe('placeKind', () => {
  it('classifies from Qloo place tags, bars before restaurants', () => {
    expect(placeKind(place(['urn:tag:genre:place:restaurant:bar']))).toBe('bar');
    expect(placeKind(place(['urn:tag:genre:place:restaurant:ramen']))).toBe('restaurant');
    expect(placeKind(place(['urn:tag:genre:place:record_store']))).toBe('record store');
    expect(
      placeKind(place(['urn:tag:genre:place:concert_hall', 'urn:tag:genre:place:restaurant:bar'])),
    ).toBe('venue');
    expect(
      placeKind({ ...place(['urn:tag:genre:place:restaurant:bar']), name: 'Warsaw Concerts' }),
    ).toBe('venue');
    // A bar that also hosts live music is still a bar.
    expect(
      placeKind(
        place(['urn:tag:genre:place:restaurant:bar', 'urn:tag:genre:place:live_music_venue']),
      ),
    ).toBe('bar');
    expect(placeKind(place(['urn:tag:genre:place:tattoo_shop']))).toBe('other');
  });
});

describe('hoursOn / openAt', () => {
  // 2026-11-20 is a Friday.
  const hours = {
    friday: [{ opens: 'T17:00:00', closes: 'T02:00:00', closed: false }],
    saturday: [{ closed: true }],
  };

  it('reads the show weekday and handles past-midnight closing', () => {
    expect(hoursOn(place([], hours), '2026-11-20')).toBe('17:00–02:00');
    expect(hoursOn(place([], hours), '2026-11-21')).toBe('closed');
    expect(hoursOn(place([], hours), '2026-11-22')).toBeUndefined();
    expect(openAt('17:00–02:00', '23:30')).toBe(true);
    expect(openAt('17:00–02:00', '01:00')).toBe(true);
    expect(openAt('08:00–14:00', '19:00')).toBe(false);
    expect(openAt(undefined, '19:00')).toBeUndefined();
  });
});
