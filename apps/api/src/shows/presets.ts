import type { PresetShow } from '@housefull/shared';

/**
 * Draft demo presets. Final artist picks come after the Qloo probe; venue
 * coordinates are approximate and get checked when venues are imported.
 */
export const PRESETS: PresetShow[] = [
  {
    id: 'nyc-brooklyn-steel',
    label: 'Indie show in East Williamsburg',
    blurb: 'Main demo: mid-size room, audience spread across Brooklyn and Queens.',
    show: {
      artist: 'Men I Trust',
      venue: { name: 'Brooklyn Steel', lat: 40.7193, lng: -73.9389, capacity: 1800 },
      city: 'nyc',
      date: '2026-11-20',
      soldPct: 46,
      budgetUsd: 3000,
    },
  },
  {
    id: 'nola-tipitinas',
    label: 'Soul night Uptown',
    blurb: 'Visitor-heavy city: shows source cities to target before travel.',
    show: {
      artist: 'Hiatus Kaiyote',
      venue: { name: "Tipitina's", lat: 29.9177, lng: -90.1046, capacity: 1000 },
      city: 'nola',
      date: '2026-11-21',
      soldPct: 38,
      budgetUsd: 2000,
    },
  },
  {
    id: 'la-lodge-room',
    label: 'Desert blues in Highland Park',
    blurb: 'Spread-out city: access is drive time, not transit.',
    show: {
      artist: 'Mdou Moctar',
      venue: { name: 'Lodge Room', lat: 34.1113, lng: -118.1918, capacity: 500 },
      city: 'la',
      date: '2026-11-22',
      soldPct: 52,
      budgetUsd: 1500,
    },
  },
];
