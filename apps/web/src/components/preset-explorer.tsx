'use client';

import { CITY_META, type PresetShow } from '@housefull/shared';
import { CalendarIcon, MapPinIcon, TicketIcon } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { BaseMap, type MapPin } from '@/components/map/base-map';
import { PlanButton } from '@/components/plan-button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { parseCity } from '@/lib/city';

const dateFmt = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

export function PresetExplorer({ presets }: { presets: PresetShow[] }) {
  const city = parseCity(useSearchParams().get('city'));
  const meta = CITY_META[city];
  const inCity = useMemo(() => presets.filter((p) => p.show.city === city), [presets, city]);
  const pins = useMemo<MapPin[]>(
    () =>
      inCity.map((p) => ({
        id: p.id,
        lng: p.show.venue.lng,
        lat: p.show.venue.lat,
        label: p.show.venue.name,
      })),
    [inCity],
  );
  // Center on the city's venues (their midpoint), falling back to the city center.
  const center = useMemo<[number, number]>(() => {
    if (pins.length === 0) return meta.center;
    const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
    return [avg(pins.map((p) => p.lng)), avg(pins.map((p) => p.lat))];
  }, [pins, meta.center]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div className="flex flex-col gap-4">
        <h2 className="text-sm font-medium text-muted-foreground">Demo shows in {meta.name}</h2>
        {inCity.length === 0 && (
          <p className="text-sm text-muted-foreground">No preset shows for this city yet.</p>
        )}
        {inCity.map((p) => (
          <Card key={p.id}>
            <CardHeader>
              <CardTitle>{p.show.artist}</CardTitle>
              <CardDescription>{p.label}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <p className="text-muted-foreground">{p.blurb}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <span className="inline-flex items-center gap-1.5">
                  <MapPinIcon className="size-3.5 text-muted-foreground" />
                  {p.show.venue.name}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CalendarIcon className="size-3.5 text-muted-foreground" />
                  {dateFmt.format(new Date(p.show.date))}
                </span>
                {p.show.soldPct !== undefined && (
                  <span className="inline-flex items-center gap-1.5">
                    <TicketIcon className="size-3.5 text-muted-foreground" />
                    {p.show.soldPct}% sold
                  </span>
                )}
              </div>
            </CardContent>
            <CardFooter className="justify-between">
              <Badge variant="secondary">Demo data</Badge>
              <PlanButton presetId={p.id} />
            </CardFooter>
          </Card>
        ))}
      </div>
      <div className="h-[360px] lg:h-auto lg:min-h-[340px]">
        <BaseMap center={center} zoom={meta.zoom} pins={pins} />
      </div>
    </div>
  );
}
