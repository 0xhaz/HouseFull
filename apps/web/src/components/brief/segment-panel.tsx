'use client';

import { type CampaignBrief, CITY_META, type Segment } from '@housefull/shared';
import { MapPinIcon, MegaphoneIcon, MicIcon, TvIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { MapPin } from '@/components/map/base-map';
import { LiftLegend, LiftMap } from '@/components/map/lift-map';
import { VisitorMap } from '@/components/map/visitor-map';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

function Sourced({ count }: { count: number }) {
  return (
    <span
      className="text-xs text-muted-foreground"
      title="Each claim links to the Qloo call it came from"
    >
      {count} sourced claim{count === 1 ? '' : 's'}
    </span>
  );
}

export function SegmentPanel({ brief }: { brief: CampaignBrief }) {
  const [active, setActive] = useState(brief.segments[0]?.id);
  const seg = brief.segments.find((s) => s.id === active) ?? brief.segments[0];
  const meta = CITY_META[brief.show.city];
  const pins = useMemo<MapPin[]>(
    () => [
      {
        id: 'venue',
        lat: brief.show.venue.lat,
        lng: brief.show.venue.lng,
        label: brief.show.venue.name,
      },
    ],
    [brief.show.venue],
  );
  const center = useMemo<[number, number]>(
    () => [brief.show.venue.lng, brief.show.venue.lat],
    [brief.show.venue],
  );
  if (!seg) return <p className="text-sm text-muted-foreground">No segments in this brief.</p>;

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Audience segments" className="flex flex-wrap gap-2">
        {brief.segments.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={s.id === seg.id}
            onClick={() => setActive(s.id)}
            className={cn(
              'rounded-full border px-3 py-1 text-sm transition-colors',
              s.id === seg.id
                ? 'border-primary bg-primary text-primary-foreground'
                : 'hover:bg-accent',
            )}
          >
            {s.name}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-2">
          <div className="h-[380px] lg:h-[460px]">
            <LiftMap
              city={brief.show.city}
              center={center}
              zoom={meta.zoom}
              areas={seg.neighborhoods}
              pins={pins}
            />
          </div>
          <LiftLegend />
        </div>
        <SegmentDetail segment={seg} access={brief.access} />
      </div>

      {seg.sourceCities && seg.sourceCities.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Where visitors come from</CardTitle>
            <CardDescription>
              Large US metros where this segment over-indexes: target them before travel season
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[320px]">
              <VisitorMap cities={seg.sourceCities} />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {seg.copy.map((c, i) => (
          <Card key={`${seg.id}-${c.headline}`}>
            <CardHeader>
              <CardDescription>Ad variant {String.fromCharCode(65 + i)}</CardDescription>
              <CardTitle className="text-base">{c.headline}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <p className="text-muted-foreground">{c.body}</p>
              <Badge variant="secondary" className="self-start">
                {c.cta}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function SegmentDetail({
  segment: s,
  access,
}: {
  segment: Segment;
  access: CampaignBrief['access'];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{s.name}</CardTitle>
        <CardDescription>Fans of {s.seeds.map((x) => x.name).join(', ')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <ul className="flex flex-col gap-1.5">
          {s.why.map((c) => (
            <li key={c.text} className="flex gap-2">
              <span aria-hidden className="text-primary">
                ·
              </span>
              <span>{c.text}</span>
            </li>
          ))}
        </ul>
        <Sourced count={s.why.length} />

        <div>
          <h4 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Top neighborhoods
          </h4>
          <table className="w-full text-sm">
            <thead className="sr-only">
              <tr>
                <th>Neighborhood</th>
                <th>Lift</th>
                <th>Travel</th>
              </tr>
            </thead>
            <tbody>
              {s.neighborhoods.map((n) => (
                <tr key={n.name} className="border-b last:border-0">
                  <td className="py-1.5">
                    <span className="inline-flex items-center gap-1.5">
                      <MapPinIcon className="size-3.5 text-muted-foreground" />
                      {n.name}
                    </span>
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{n.lift.toFixed(2)}×</td>
                  <td className="py-1.5 pl-3 text-right tabular-nums text-muted-foreground">
                    {n.accessMin} min
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-xs text-muted-foreground">
            Travel {access.mode === 'drive' ? 'by car' : 'by transit'},{' '}
            {access.method === 'gtfs' ? 'from the subway timetable' : 'estimated from distance'}.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Reach them through
          </h4>
          <Channel icon={MicIcon} label="Podcasts" items={s.channels.podcasts.map((p) => p.name)} />
          <Channel icon={TvIcon} label="TV" items={s.channels.tvShows.map((p) => p.name)} />
          <Channel
            icon={MegaphoneIcon}
            label="Brand partners"
            items={s.channels.brands.map((p) => p.name)}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {s.channels.adTargeting.interests.map((i) => (
            <Badge key={i} variant="outline">
              {i}
            </Badge>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Suggested ad interests, from Qloo taste tags
        </p>
      </CardContent>
    </Card>
  );
}

function Channel({
  icon: Icon,
  label,
  items,
}: {
  icon: typeof MicIcon;
  label: string;
  items: string[];
}) {
  if (!items.length) return null;
  return (
    <p className="flex items-start gap-2">
      <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-label={label} />
      <span>{items.slice(0, 5).join(', ')}</span>
    </p>
  );
}
