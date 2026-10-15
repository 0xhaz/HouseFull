'use client';

import type { GeoJSONSource, MapLayerMouseEvent, Map as MapLibreMap, Popup } from 'maplibre-gl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { API_BASE } from '@/lib/api';
import { BaseMap, type MapPin } from './base-map';

type FC = {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    id: string;
    properties: { id: string; name: string };
    geometry: unknown;
  }>;
};

/** Sequential ramp for lift ≥ 1 (warm, matches the brand); lift < 1 stays unfilled. */
const RAMP = {
  light: ['#fde7d4', '#f9b98a', '#f08a4b', '#d9592b', '#a83a1c'],
  dark: ['#4a2a1c', '#7a3d22', '#b5552a', '#e07a3c', '#f6b27a'],
} as const;
const STOPS = [1, 1.15, 1.35, 1.6, 2];

export type LiftArea = { name: string; lift: number; accessMin: number };

type Props = {
  city: string;
  center: [number, number];
  zoom: number;
  areas: LiftArea[];
  pins?: MapPin[];
  className?: string;
};

/** Neighborhoods shaded by a segment's lift; hover for name, lift and travel time. */
export function LiftMap({ city, center, zoom, areas, pins, className }: Props) {
  const [fc, setFc] = useState<FC | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const popupRef = useRef<Popup | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(new URL(`/cities/${city}/neighborhoods`, API_BASE))
      .then((r) => r.json())
      .then((d: FC) => !cancelled && setFc(d))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [city]);

  const data = useMemo(() => {
    if (!fc) return null;
    const byName = new Map(areas.map((a, rank) => [a.name, { ...a, rank: rank + 1 }]));
    return {
      ...fc,
      features: fc.features.map((f) => {
        const a = byName.get(f.properties.name);
        return {
          ...f,
          properties: {
            ...f.properties,
            lift: a?.lift ?? 0,
            accessMin: a?.accessMin ?? null,
            rank: a?.rank ?? null,
          },
        };
      }),
    };
  }, [fc, areas]);
  const dataRef = useRef(data);
  dataRef.current = data;

  const addLayers = useCallback((map: MapLibreMap, theme: 'light' | 'dark') => {
    mapRef.current = map;
    const current = dataRef.current;
    if (!current || map.getSource('hoods')) return;
    const ramp = RAMP[theme];
    map.addSource('hoods', { type: 'geojson', data: current as never });
    map.addLayer({
      id: 'hoods-fill',
      type: 'fill',
      source: 'hoods',
      paint: {
        'fill-color': [
          'step',
          ['get', 'lift'],
          'rgba(0,0,0,0)',
          ...STOPS.flatMap((s, i) => [s, ramp[i] as string]),
        ] as never,
        'fill-opacity': ['case', ['>=', ['get', 'lift'], 1], 0.7, 0] as never,
      },
    });
    map.addLayer({
      id: 'hoods-line',
      type: 'line',
      source: 'hoods',
      paint: {
        'line-color': theme === 'dark' ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)',
        'line-width': ['case', ['!=', ['get', 'rank'], null], 1.5, 0.3] as never,
      },
    });
    const onMove = (e: MapLayerMouseEvent) => {
      const f = e.features?.[0];
      if (!f) return;
      const p = f.properties as { name: string; lift: number; accessMin: number | null };
      map.getCanvas().style.cursor = 'pointer';
      void import('maplibre-gl').then(({ Popup }) => {
        popupRef.current ??= new Popup({
          closeButton: false,
          closeOnClick: false,
          className: 'hf-popup',
        });
        popupRef.current
          .setLngLat(e.lngLat)
          .setHTML(
            `<strong>${p.name}</strong><br/>${p.lift >= 1 ? `${Number(p.lift).toFixed(2)}× typical nightlife` : 'not a top area for this segment'}${p.accessMin ? ` · ${p.accessMin} min` : ''}`,
          )
          .addTo(map);
      });
    };
    map.on('mousemove', 'hoods-fill', onMove);
    map.on('mouseleave', 'hoods-fill', () => {
      map.getCanvas().style.cursor = '';
      popupRef.current?.remove();
    });
  }, []);

  // New segment or data: update the source in place, then frame the top areas and the venue.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !data) return;
    const src = map.getSource('hoods') as GeoJSONSource | undefined;
    if (src) src.setData(data as never);
    else if (map.isStyleLoaded())
      addLayers(map, document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    const box = bboxOf(
      data.features.filter((f) => f.properties.rank !== null).map((f) => f.geometry),
      center,
    );
    if (box) map.fitBounds(box, { padding: 40, maxZoom: 13, duration: 600 });
  }, [data, addLayers, center]);

  return (
    <BaseMap
      center={center}
      zoom={zoom}
      pins={pins}
      onStyleReady={addLayers}
      className={className}
      ariaLabel="Map of neighborhoods shaded by audience lift"
    />
  );
}

/** Bounding box of GeoJSON geometries plus one extra point, as [[west, south], [east, north]]. */
function bboxOf(
  geometries: unknown[],
  extra: [number, number],
): [[number, number], [number, number]] | null {
  let w = extra[0];
  let e = extra[0];
  let s = extra[1];
  let n = extra[1];
  let any = false;
  const walk = (c: unknown) => {
    if (!Array.isArray(c)) return;
    if (typeof c[0] === 'number' && typeof c[1] === 'number') {
      any = true;
      w = Math.min(w, c[0]);
      e = Math.max(e, c[0]);
      s = Math.min(s, c[1]);
      n = Math.max(n, c[1]);
      return;
    }
    for (const x of c) walk(x);
  };
  for (const g of geometries) walk((g as { coordinates?: unknown }).coordinates);
  return any
    ? [
        [w, s],
        [e, n],
      ]
    : null;
}

export function LiftLegend() {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span>Lift vs typical nightlife</span>
      <div className="flex overflow-hidden rounded">
        {RAMP.light.map((c, i) => (
          <span
            key={c}
            className="flex h-3 w-8 items-center justify-center text-[9px] text-black/70"
            style={{ background: c }}
          >
            {STOPS[i]}×
          </span>
        ))}
      </div>
    </div>
  );
}
