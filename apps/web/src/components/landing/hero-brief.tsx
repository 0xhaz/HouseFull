import { CITY_META } from '@housefull/shared';
import { ArrowRightIcon } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { ApiError, getWorkspace } from '@/lib/api';

const dayFmt = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

/**
 * A live slice of the demo promoter's first brief. Loaded from the API rather than written
 * into the page: Qloo-derived names never live in the repo.
 */
export async function HeroBrief() {
  let run: Awaited<ReturnType<typeof getWorkspace>>['runs'][number] | undefined;
  try {
    run = (await getWorkspace('demo-promoter')).runs.find(
      (r) => r.status === 'done' && r.segments.length > 0,
    );
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
  }
  if (!run) return <HeroBriefPlaceholder />;
  const { show } = run;
  return (
    <figure className="rounded-2xl border bg-card p-5 shadow-sm">
      <figcaption className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          From a live demo brief
        </span>
        {run.version > 1 && <Badge variant="secondary">v{run.version}: re-planned</Badge>}
      </figcaption>
      <p className="mt-3 text-lg font-semibold">
        {show.artist}
        <span className="font-normal text-muted-foreground"> at {show.venue.name}</span>
      </p>
      <p className="text-sm text-muted-foreground">
        {CITY_META[show.city].name} · {dayFmt.format(new Date(`${show.date}T00:00:00Z`))}
      </p>
      {show.soldPct !== undefined && (
        <div className="mt-3 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div className="h-full rounded-full bg-primary" style={{ width: `${show.soldPct}%` }} />
          </div>
          <span className="text-xs tabular-nums text-muted-foreground">{show.soldPct}% sold</span>
        </div>
      )}
      <p className="mt-4 text-sm font-medium">New audiences beyond the core fans</p>
      <ol className="mt-2 grid grid-cols-1 gap-2">
        {run.segments.slice(0, 3).map((s, i) => (
          <li key={s.id} className="flex gap-3 rounded-lg border p-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {i + 1}
            </span>
            <div className="min-w-0 text-sm">
              <p className="font-medium">{s.name}</p>
              {s.fansOf.length > 0 && (
                <p className="truncate text-muted-foreground">Fans of {s.fansOf.join(', ')}</p>
              )}
              <p className="truncate text-muted-foreground">
                {s.sourceCities.length
                  ? `Travelling from ${s.sourceCities.join(', ')}`
                  : s.neighborhoods.join(' · ')}
              </p>
            </div>
          </li>
        ))}
      </ol>
      <Link
        href={`/runs/${run.id}/brief`}
        className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        Open the full brief
        <ArrowRightIcon className="size-3.5" />
      </Link>
    </figure>
  );
}

export function HeroBriefPlaceholder() {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        What a brief starts with
      </p>
      <ol className="mt-3 grid gap-2 text-sm">
        {[
          'Who else would buy, beyond the fans you already reach',
          'Where they live, and how long the trip to your door takes',
          'What to say to each group, and where they’ll see it',
        ].map((t, i) => (
          <li key={t} className="flex gap-3 rounded-lg border p-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {i + 1}
            </span>
            {t}
          </li>
        ))}
      </ol>
    </div>
  );
}
