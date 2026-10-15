import { describe, expect, it } from 'vitest';
import { candidates } from './geocode.js';
import { alertsFor, isSuspension, parseAlerts } from './mta.js';
import { showWindow, utcOffset } from './window.js';

describe('showWindow', () => {
  it('is DST-aware for New York', () => {
    expect(utcOffset('America/New_York', '2026-11-20')).toBe('-05:00');
    expect(utcOffset('America/New_York', '2026-07-04')).toBe('-04:00');
    const w = showWindow('2026-11-20');
    expect(w.start.toISOString()).toBe('2026-11-20T23:00:00.000Z');
    expect(w.end.toISOString()).toBe('2026-11-21T06:00:00.000Z');
  });
});

describe('candidates', () => {
  it('keeps addresses and named places, skips street segments', () => {
    expect(
      candidates(
        'Big Bush Playground: Picnic Area , LAUREL HILL BLVD.  61ST ST between 61ST STREET and QUEENS BLVD, 5511 QUEENS BOULEVARD',
        'Queens',
      ),
    ).toEqual(['Big Bush Playground, Queens', '5511 QUEENS BOULEVARD, Queens']);
    expect(candidates('WEST 24 STREET between 7 AVENUE and 6 AVENUE', 'Manhattan')).toEqual([]);
  });
});

describe('MTA alerts', () => {
  const raw = {
    entity: [
      {
        id: 'a1',
        alert: {
          active_period: [
            {
              start: Date.parse('2026-11-20T22:00:00Z') / 1000,
              end: Date.parse('2026-11-21T09:00:00Z') / 1000,
            },
          ],
          informed_entity: [{ route_id: 'L' }, { route_id: 'L' }],
          header_text: {
            translation: [{ text: 'No [L] between Bedford Av and 8 Av', language: 'en' }],
          },
          'transit_realtime.mercury_alert': { alert_type: 'Planned - Part Suspended' },
        },
      },
      {
        id: 'a2',
        alert: {
          active_period: [
            {
              start: Date.parse('2026-11-19T10:00:00Z') / 1000,
              end: Date.parse('2026-11-19T12:00:00Z') / 1000,
            },
          ],
          informed_entity: [{ route_id: 'G' }],
          header_text: { translation: [{ text: 'G delays' }] },
        },
      },
    ],
  };

  it('parses, dedupes routes and filters by route and show window', () => {
    const alerts = parseAlerts(raw);
    expect(alerts[0]).toMatchObject({ routes: ['L'], type: 'Planned - Part Suspended' });
    const hits = alertsFor(alerts, new Set(['L', 'G']), showWindow('2026-11-20'));
    expect(hits.map((a) => a.id)).toEqual(['a1']);
    expect(isSuspension(hits[0]?.type ?? '')).toBe(true);
  });
});
