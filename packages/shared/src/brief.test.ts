import { describe, expect, it } from 'vitest';
import { CampaignBriefSchema } from './brief.js';
import { GettingHomeSchema } from './getting-home.js';

const ref = { entityId: 'E1', name: 'Some Artist', type: 'urn:entity:artist', sourceRef: 'qc_1' };

const minimalBrief = {
  show: {
    artist: 'Some Artist',
    artistEntityId: 'E1',
    venue: { name: 'Brooklyn Steel', lat: 40.7193, lng: -73.9389 },
    city: 'nyc',
    date: '2026-11-14',
  },
  segments: [
    {
      id: 's1',
      name: 'Neo-soul & late-night radio',
      why: [{ text: 'Fans over-index on neo-soul', sourceRef: 'qc_2' }],
      seeds: [ref],
      neighborhoods: [{ name: 'Bushwick', lift: 1.8, accessMin: 22 }],
      channels: {
        podcasts: [],
        tvShows: [],
        brands: [],
        partnerPlaces: [{ ...ref, distanceM: 350 }],
        adTargeting: { interests: [], geos: [] },
      },
      copy: [],
    },
  ],
  conflicts: [],
  schedule: [],
  venueFit: { score: 64, reasons: [] },
  openers: [],
  partnerDeals: [],
  artist: ref,
  summary: 'Audience peaks in Bushwick, 20 min from the venue.',
  core: { tags: [] },
  access: { mode: 'transit', method: 'gtfs' },
  critic: { passed: true, rounds: 1, droppedClaims: 0, notes: [], reviewer: 'deterministic' },
  warnings: [],
  writer: 'template',
};

describe('CampaignBriefSchema', () => {
  it('accepts a minimal brief', () => {
    expect(CampaignBriefSchema.safeParse(minimalBrief).success).toBe(true);
  });

  it('rejects a claim without a sourceRef', () => {
    const bad = {
      ...minimalBrief,
      segments: [
        { ...minimalBrief.segments[0], why: [{ text: 'Unsourced claim', sourceRef: '' }] },
      ],
    };
    expect(CampaignBriefSchema.safeParse(bad).success).toBe(false);
  });
});

describe('GettingHomeSchema', () => {
  it('caps the suggested route detour at 25%', () => {
    const base = {
      venueContext: {
        window: { start: '22:00', end: '00:30' },
        incidentsNearVenue: [],
        peerMedian: [],
        note: 'in line with similar nightlife areas',
        source: { dataset: 'NYPD 5uac-w243', url: 'https://data.cityofnewyork.us/d/5uac-w243' },
      },
      stations: [],
      attendeeCopy: [],
      disclaimer: 'Suggested route only; based on public data, not a safety guarantee.',
      suggestedRoute: {
        toStationId: 'L12',
        geometry: {
          type: 'LineString',
          coordinates: [
            [-73.94, 40.72],
            [-73.95, 40.71],
          ],
        },
        walkMinutes: 8,
        extraVsShortestPct: 30,
        why: [],
      },
    };
    expect(GettingHomeSchema.safeParse(base).success).toBe(false);
  });
});
