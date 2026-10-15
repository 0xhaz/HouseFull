'use client';

import { US_METROS } from '@housefull/geo';
import { useMemo } from 'react';
import { BaseMap, type MapPin } from './base-map';

/** Visitor source cities (NOLA): which large US metros over-index for a segment. */
export function VisitorMap({
  cities,
  className,
}: {
  cities: Array<{ metro: string; score: number }>;
  className?: string;
}) {
  const pins = useMemo<MapPin[]>(
    () =>
      cities.flatMap((c, i) => {
        const m = US_METROS.find((x) => x.name === c.metro);
        return m
          ? [
              {
                id: c.metro,
                lat: m.lat,
                lng: m.lng,
                label: `${i + 1}. ${c.metro} · ${c.score.toFixed(2)}`,
                tone: i === 0 ? 'primary' : 'muted',
              },
            ]
          : [];
      }),
    [cities],
  );
  return (
    <BaseMap
      center={[-96, 38.5]}
      zoom={2.6}
      pins={pins}
      className={className}
      ariaLabel="US map of visitor source cities"
    />
  );
}
