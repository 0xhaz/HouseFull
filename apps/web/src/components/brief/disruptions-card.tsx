import type { CampaignBrief } from '@housefull/shared';
import { AlertTriangleIcon, ConstructionIcon, InfoIcon, TrainFrontIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const ICON = {
  transit_planned: ConstructionIcon,
  transit_alert: TrainFrontIcon,
  city_event: AlertTriangleIcon,
  weather: InfoIcon,
} as const;

/** F7: what's happening on show night that could keep fans away, with what to do about it. */
export function DisruptionsCard({ brief }: { brief: CampaignBrief }) {
  if (brief.show.city !== 'nyc') return null;
  const list = brief.disruptions ?? [];
  const segName = (id: string) => brief.segments.find((s) => s.id === id)?.name ?? id;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Show-night disruptions</CardTitle>
        <CardDescription>
          Subway alerts on the lines your audiences ride, and permitted street events near the
          venue, from doors to 1am
        </CardDescription>
      </CardHeader>
      <CardContent>
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing found for show night. Planned work is usually posted about a week ahead, so
            check again closer to the date.
          </p>
        ) : (
          <ul className="flex flex-col gap-4 text-sm">
            {list.map((d) => {
              const Icon = ICON[d.kind];
              return (
                <li key={`${d.kind}-${d.source.recordId}-${d.title}`} className="flex gap-3">
                  <Icon
                    className={cn(
                      'mt-0.5 size-4 shrink-0',
                      d.severity === 'high'
                        ? 'text-destructive'
                        : d.severity === 'warn'
                          ? 'text-primary'
                          : 'text-muted-foreground',
                    )}
                    aria-label={d.severity}
                  />
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="font-medium">{d.title}</span>
                    <span className="text-muted-foreground">{d.effect}</span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {d.affects.segmentIds.map((id) => (
                        <Badge key={id} variant="outline">
                          {segName(id)}
                        </Badge>
                      ))}
                      <a
                        href={d.source.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-muted-foreground underline underline-offset-2"
                      >
                        {d.source.dataset}
                      </a>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
