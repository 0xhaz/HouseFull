'use client';

import type { Map as MapLibreMap, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useTheme } from 'next-themes';
import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

/** OpenFreeMap: free vector tiles, no key, no quota to burn during judging. */
const STYLES = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
} as const;

export type MapPin = {
  id: string;
  lng: number;
  lat: number;
  label: string;
  tone?: 'primary' | 'muted';
  /** `dot` for dense maps: a small marker with the label as a tooltip. */
  shape?: 'label' | 'dot';
};

type Props = {
  center: [number, number];
  zoom: number;
  pins?: MapPin[];
  className?: string;
  /** Called after every style load (first load and each theme switch, which wipes custom layers). */
  onStyleReady?: (map: MapLibreMap, theme: 'light' | 'dark') => void;
  ariaLabel?: string;
};

export function BaseMap({ center, zoom, pins = [], className, onStyleReady, ariaLabel }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const { resolvedTheme } = useTheme();
  const theme: 'light' | 'dark' = resolvedTheme === 'dark' ? 'dark' : 'light';
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const readyRef = useRef(onStyleReady);
  readyRef.current = onStyleReady;
  const initial = useRef({ center, zoom, theme });

  // Create once; maplibre-gl is browser-only, so load it here rather than at module scope.
  useEffect(() => {
    let cancelled = false;
    void import('maplibre-gl').then(
      ({ Map: MapLibre, NavigationControl, getVersion, setWorkerUrl }) => {
        if (cancelled || !containerRef.current) return;
        // Copied into public/vendor by scripts/copy-maplibre-worker.mjs.
        setWorkerUrl(`/vendor/maplibre-gl-worker-${getVersion()}.mjs`);
        const map = new MapLibre({
          container: containerRef.current,
          style: STYLES[initial.current.theme],
          center: initial.current.center,
          zoom: initial.current.zoom,
          attributionControl: { compact: true },
        });
        map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
        map.on('style.load', () => readyRef.current?.(map, themeRef.current));
        mapRef.current = map;
      },
    );
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    mapRef.current?.setStyle(STYLES[theme]);
  }, [theme]);

  useEffect(() => {
    mapRef.current?.flyTo({ center, zoom, essential: true });
  }, [center, zoom]);

  useEffect(() => {
    let cancelled = false;
    void import('maplibre-gl').then(({ Marker }) => {
      const map = mapRef.current;
      if (cancelled || !map) return;
      for (const m of markersRef.current) m.remove();
      markersRef.current = pins.map((pin) => {
        const el = document.createElement('div');
        el.className = cn(
          'rounded-full border-2 border-background shadow',
          pin.shape === 'dot' ? 'size-3.5' : 'px-2 py-0.5 text-[11px] font-medium',
          pin.tone === 'muted' ? 'bg-card text-foreground' : 'bg-primary text-primary-foreground',
          pin.shape === 'dot' && pin.tone === 'muted' && 'bg-foreground/60',
        );
        if (pin.shape === 'dot') el.title = pin.label;
        else el.textContent = pin.label;
        return new Marker({ element: el }).setLngLat([pin.lng, pin.lat]).addTo(map);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [pins]);

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={ariaLabel ?? 'Map'}
      className={cn('h-full w-full overflow-hidden rounded-xl border', className)}
    />
  );
}
