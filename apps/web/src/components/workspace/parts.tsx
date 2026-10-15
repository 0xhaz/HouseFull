import { CITY_META, type RunSummary } from '@housefull/shared';
import { AlertTriangleIcon, ArrowRightIcon, PlusIcon } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { attention, daysUntil, dueNow } from '@/lib/workspace-stats';

export const dayFmt = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});
const weekdayFmt = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' });

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>;
}

export function Section({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="min-w-0">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function PlanShowButton({ slug, city }: { slug: string; city?: string }) {
  return (
    <Button asChild size="sm">
      <Link href={`/w/${slug}/new${city ? `?city=${city}` : ''}`}>
        <PlusIcon />
        Plan a show
      </Link>
    </Button>
  );
}

export function EmptyRuns({
  slug,
  city,
  children,
}: {
  slug: string;
  city?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed p-6">
      <p className="text-sm text-muted-foreground">{children}</p>
      <PlanShowButton slug={slug} city={city} />
    </div>
  );
}

/** One show: when, where, how it's selling, what to do now, and the way into its brief. */
export function ShowRow({ run, showArtist = true }: { run: RunSummary; showArtist?: boolean }) {
  const { show } = run;
  const days = daysUntil(show.date);
  const due = run.status === 'done' ? dueNow(run, days) : undefined;
  const flag = attention(run, days);
  const href = run.status === 'done' ? `/runs/${run.id}/brief` : `/runs/${run.id}`;
  const date = new Date(`${show.date}T00:00:00Z`);
  return (
    <li className="grid grid-cols-[3.25rem_minmax(0,1fr)] gap-3 py-4 first:pt-0 last:pb-0 sm:grid-cols-[3.25rem_minmax(0,1fr)_auto]">
      <div className="flex flex-col items-center justify-center self-start rounded-lg border py-1.5 text-center">
        <span className="text-[0.65rem] uppercase text-muted-foreground">
          {weekdayFmt.format(date)}
        </span>
        <span className="text-sm font-semibold leading-tight">{dayFmt.format(date)}</span>
      </div>
      <div className="min-w-0">
        <p className="font-medium">
          {showArtist ? show.artist : show.venue.name}
          <span className="font-normal text-muted-foreground">
            {' '}
            · {showArtist ? `${show.venue.name}, ` : ''}
            {CITY_META[show.city].name}
          </span>
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Badge variant="outline">
            {days < 0 ? 'Played' : days === 0 ? 'Tonight' : `${days} days out`}
          </Badge>
          {run.status !== 'done' && <Badge variant="secondary">{run.status}</Badge>}
          {run.version > 1 && (
            <Badge variant="secondary">v{run.version}: re-planned from results</Badge>
          )}
          {run.checkins > 0 && (
            <Badge variant="secondary">
              {run.checkins} check-in{run.checkins === 1 ? '' : 's'}
            </Badge>
          )}
          {run.segments.length > 0 && (
            <Badge variant="secondary">{run.segments.length} new audiences</Badge>
          )}
          {run.role === 'shared' && <Badge variant="outline">Shared with you</Badge>}
        </div>
        {show.soldPct !== undefined && (
          <div className="mt-2 flex max-w-xs items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${show.soldPct}%` }}
              />
            </div>
            <span className="text-xs tabular-nums text-muted-foreground">{show.soldPct}% sold</span>
          </div>
        )}
        {flag && (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-amber-700 dark:text-amber-400">
            <AlertTriangleIcon className="size-3.5 shrink-0" aria-hidden />
            {flag}
          </p>
        )}
        {due && (
          <p className="mt-1.5 text-sm text-pretty">
            <span className="text-muted-foreground">Now: </span>
            {due.action}
          </p>
        )}
      </div>
      <div className="col-start-2 sm:col-start-3 sm:self-center">
        <Button asChild variant="outline" size="sm">
          <Link href={href}>
            {run.status === 'done' ? 'Open brief' : 'Follow the run'}
            <ArrowRightIcon />
          </Link>
        </Button>
      </div>
    </li>
  );
}

export function ShowList({ runs, showArtist }: { runs: RunSummary[]; showArtist?: boolean }) {
  return (
    <ul className="divide-y">
      {runs.map((r) => (
        <ShowRow key={r.id} run={r} showArtist={showArtist} />
      ))}
    </ul>
  );
}

/** Ranked chips: "value ×count". */
export function Tally({
  items,
  empty,
}: {
  items: Array<{ value: string; count: number }>;
  empty: string;
}) {
  if (!items.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((i) => (
        <li key={i.value}>
          <Badge variant="secondary" className="h-auto whitespace-normal">
            {i.value}
            {i.count > 1 && <span className="text-muted-foreground"> ×{i.count}</span>}
          </Badge>
        </li>
      ))}
    </ul>
  );
}
