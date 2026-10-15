'use client';

import type { CampaignBrief } from '@housefull/shared';
import { FootprintsIcon, LockIcon, TrainFrontIcon } from 'lucide-react';
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import { useCallback, useMemo } from 'react';
import { BaseMap, type MapPin } from '@/components/map/base-map';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/** F8: suggested late-night route + late trains for attendees; venue context for the promoter only. */
export function GettingHomeCard({ brief }: { brief: CampaignBrief }) {
  const h = brief.gettingHome;
  const venue = brief.show.venue;
  const route = h?.suggestedRoute;
  const to = h?.stations.find((s) => s.gtfsStopId === route?.toStationId);
  const end = route?.geometry.coordinates.at(-1);

  const pins = useMemo<MapPin[]>(
    () => [
      { id: 'venue', lat: venue.lat, lng: venue.lng, label: venue.name },
      ...(to && end
        ? [{ id: 'station', lng: end[0], lat: end[1], label: to.name, tone: 'muted' as const }]
        : []),
    ],
    [venue, to, end],
  );
  const center = useMemo<[number, number]>(() => [venue.lng, venue.lat], [venue]);

  const draw = useCallback(
    (map: MapLibreMap, theme: 'light' | 'dark') => {
      if (!route) return;
      const data = { type: 'Feature', properties: {}, geometry: route.geometry };
      const src = map.getSource('route') as GeoJSONSource | undefined;
      if (src) src.setData(data as never);
      else {
        map.addSource('route', { type: 'geojson', data: data as never });
        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': theme === 'dark' ? '#f6b27a' : '#c2410c',
            'line-width': 4,
            'line-opacity': 0.9,
          },
        });
      }
      const xs = route.geometry.coordinates;
      const lngs = xs.map((c) => c[0]);
      const lats = xs.map((c) => c[1]);
      map.fitBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        { padding: 60, maxZoom: 16, duration: 0 },
      );
    },
    [route],
  );

  if (brief.show.city !== 'nyc') return null;
  if (!h)
    return (
      <Card>
        <CardHeader>
          <CardTitle>Getting home</CardTitle>
          <CardDescription>
            Late-night transit and walking routes aren&apos;t available for this show yet.
          </CardDescription>
        </CardHeader>
      </Card>
    );

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>Getting home</CardTitle>
        <CardDescription>
          Late trains near the venue and a suggested walk to the best station after the show
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-2">
          {route ? (
            <div className="h-[320px]">
              <BaseMap
                center={center}
                zoom={15}
                pins={pins}
                onStyleReady={draw}
                ariaLabel="Suggested late-night walking route"
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No walking route computed for this venue.
            </p>
          )}
          {route && to && (
            <p className="flex items-start gap-2 text-sm">
              <FootprintsIcon className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>
                Suggested late-night route to <strong>{to.name}</strong>, about {route.walkMinutes}{' '}
                min
                {route.extraVsShortestPct > 0 &&
                  ` (${route.extraVsShortestPct}% longer than the shortest walk)`}
                . It {route.why.join('; it ')}.
              </span>
            </p>
          )}
        </div>

        <div className="flex flex-col gap-4 text-sm">
          <ul className="flex flex-col gap-2">
            {h.stations.map((s) => (
              <li key={s.gtfsStopId} className="flex flex-col">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <TrainFrontIcon className="size-3.5 text-muted-foreground" />
                  {s.name}{' '}
                  <span className="font-normal text-muted-foreground">
                    · {s.walkMinutes} min walk
                  </span>
                </span>
                <span className="text-muted-foreground">
                  {s.lateRoutes
                    .map((r) => `${r.route} every ~${Math.round(r.headwayMinAfterShow)} min`)
                    .join(', ')}{' '}
                  after the show
                </span>
                {s.disruptions.length > 0 && (
                  <span className="text-xs text-destructive">
                    Show-night work: {s.disruptions.join('; ')}
                  </span>
                )}
              </li>
            ))}
          </ul>

          <div>
            <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              For attendees
            </h4>
            <ul className="flex flex-col gap-1">
              {h.attendeeCopy.map((c) => (
                <li key={c}>“{c}”</li>
              ))}
            </ul>
          </div>

          <div className="rounded-md border border-dashed p-3">
            <h4 className="mb-1 inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <LockIcon className="size-3" /> Promoter only: venue context
            </h4>
            <div className="mb-1 flex flex-wrap gap-1.5">
              {h.venueContext.incidentsNearVenue.map((c) => {
                const peer = h.venueContext.peerMedian.find((p) => p.category === c.category);
                return (
                  <Badge key={c.category} variant="outline">
                    {c.category}: {c.count}
                    {peer && ` (similar areas: ${peer.count})`}
                  </Badge>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">{h.venueContext.note}</p>
            <a
              href={h.venueContext.source.url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-muted-foreground underline underline-offset-2"
            >
              {h.venueContext.source.dataset}
            </a>
          </div>

          <p className="text-xs text-muted-foreground">{h.disclaimer}</p>
        </div>
      </CardContent>
    </Card>
  );
}
