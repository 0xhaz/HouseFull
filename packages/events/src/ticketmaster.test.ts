import { describe, expect, it, vi } from 'vitest';
import { Ticketmaster } from './ticketmaster.js';

const body = {
  _embedded: {
    events: [
      {
        id: 'E1',
        name: 'Synthetic Night',
        url: 'https://example.com/e1',
        dates: { start: { localDate: '2026-11-20', localTime: '20:00:00' } },
        _embedded: {
          venues: [{ name: 'Example Hall', location: { latitude: '40.72', longitude: '-73.95' } }],
          attractions: [{ name: 'Synthetic Band' }],
        },
      },
    ],
  },
};

describe('Ticketmaster', () => {
  it('reports unavailable without a key and never fetches', async () => {
    const fetchMock = vi.fn();
    const tm = new Ticketmaster({ fetch: fetchMock as unknown as typeof fetch });
    expect(await tm.conflicts({ lat: 1, lng: 2, date: '2026-11-20' })).toEqual({
      available: false,
      reason: 'Ticketmaster API key not configured',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps events, keeps the key out of results, and caches for 6h', async () => {
    let t = 0;
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(body)));
    const tm = new Ticketmaster({
      apiKey: 'k-not-real',
      fetch: fetchMock as unknown as typeof fetch,
      now: () => t,
    });
    const r = await tm.conflicts({ lat: 40.7, lng: -73.9, date: '2026-11-20' });
    expect(r).toMatchObject({
      available: true,
      events: [{ id: 'E1', venue: 'Example Hall', lat: 40.72, time: '20:00:00' }],
    });
    expect(JSON.stringify(r)).not.toContain('k-not-real');
    const url = String((fetchMock.mock.calls[0] as unknown as [URL])[0]);
    expect(url).toContain('classificationName=music');
    expect(url).toContain('localStartDateTime=2026-11-20T00%3A00%3A00%2C2026-11-20T23%3A59%3A59');

    await tm.conflicts({ lat: 40.7, lng: -73.9, date: '2026-11-20' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    t = 7 * 60 * 60 * 1000;
    await tm.conflicts({ lat: 40.7, lng: -73.9, date: '2026-11-20' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('Ticketmaster.conflicts', () => {
  it('keeps evening shows only, nearest first', async () => {
    const ev = (id: string, time: string, lat: number) => ({
      id,
      name: id,
      dates: { start: { localDate: '2026-11-20', localTime: time } },
      _embedded: {
        venues: [{ name: `${id} Hall`, location: { latitude: String(lat), longitude: '-73.95' } }],
      },
    });
    const body = {
      _embedded: {
        events: [
          ev('matinee', '11:00:00', 40.72),
          ev('far', '20:00:00', 40.75),
          ev('near', '19:30:00', 40.721),
        ],
      },
    };
    const tm = new Ticketmaster({
      apiKey: 'k',
      fetch: (async () => new Response(JSON.stringify(body))) as unknown as typeof fetch,
    });
    const r = await tm.conflicts({ lat: 40.72, lng: -73.95, date: '2026-11-20' });
    expect(r.available && r.events.map((e) => e.id)).toEqual(['near', 'far']);
  });
});
