import type { CampaignBrief } from '@housefull/shared';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function ScheduleList({ brief }: { brief: CampaignBrief }) {
  const segName = (id: string) =>
    id === 'all' ? 'All segments' : (brief.segments.find((s) => s.id === id)?.name ?? id);
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <CardTitle>Countdown</CardTitle>
          <CardDescription>Days before the show on {brief.show.date}</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="relative flex flex-col gap-4 border-l pl-6">
            {brief.schedule.map((s) => (
              <li key={`${s.daysOut}-${s.action}`} className="relative text-sm">
                <span className="absolute top-0 -left-[34px] grid size-5 place-items-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground tabular-nums">
                  {s.daysOut}
                </span>
                <p className="font-medium">
                  {s.daysOut === 0
                    ? 'Show day'
                    : `${s.daysOut} day${s.daysOut === 1 ? '' : 's'} out`}
                </p>
                <p className="text-muted-foreground">{s.action}</p>
                <p className="text-xs text-muted-foreground">{segName(s.segmentId)}</p>
              </li>
            ))}
          </ol>
          {brief.conflicts.length > 0 && (
            <div className="mt-6 rounded-md border border-dashed p-3 text-sm">
              <p className="font-medium">Same-night conflicts</p>
              <ul className="text-muted-foreground">
                {brief.conflicts.map((c) => (
                  <li key={`${c.name}-${c.venue}`}>
                    {c.name} at {c.venue} {c.time && `(${c.time})`}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
