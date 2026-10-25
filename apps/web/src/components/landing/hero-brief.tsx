import { CITY_META } from '@housefull/shared';
import { ArrowRightIcon } from 'lucide-react';
import Link from 'next/link';
import { heroGlass } from '@/components/page-hero';
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
    <figure className={`${heroGlass} p-5 text-white`}>
      <figcaption className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium tracking-wide text-white/60 uppercase">
          From a live demo brief
        </span>
        {run.version > 1 && (
          <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium">
            v{run.version}: re-planned
          </span>
        )}
      </figcaption>
      <p className="mt-3 text-lg font-semibold">
        {show.artist}
        <span className="font-normal text-white/60"> at {show.venue.name}</span>
      </p>
      <p className="text-sm text-white/60">
        {CITY_META[show.city].name} · {dayFmt.format(new Date(`${show.date}T00:00:00Z`))}
      </p>
      {show.soldPct !== undefined && (
        <div className="mt-3 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/15" aria-hidden>
            <div className="h-full rounded-full bg-primary" style={{ width: `${show.soldPct}%` }} />
          </div>
          <span className="text-xs tabular-nums text-white/60">{show.soldPct}% sold</span>
        </div>
      )}
      <p className="mt-4 text-sm font-medium">New audiences beyond the core fans</p>
      <ol className="mt-2 grid grid-cols-1 gap-2">
        {run.segments.slice(0, 3).map((s, i) => (
          <li key={s.id} className="flex gap-3 rounded-xl bg-white/[0.04] p-3 ring-1 ring-white/10">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {i + 1}
            </span>
            <div className="min-w-0 text-sm">
              <p className="font-medium">{s.name}</p>
              {s.fansOf.length > 0 && (
                <p className="truncate text-white/60">Fans of {s.fansOf.join(', ')}</p>
              )}
              <p className="truncate text-white/60">
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
        className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-white underline-offset-4 hover:underline"
      >
        Open the full brief
        <ArrowRightIcon className="size-3.5" />
      </Link>
    </figure>
  );
}

export function HeroBriefPlaceholder() {
  return (
    <div className={`${heroGlass} p-5 text-white`}>
      <p className="text-xs font-medium tracking-wide text-white/60 uppercase">
        What a brief starts with
      </p>
      <ol className="mt-3 grid gap-2 text-sm">
        {[
          'Who else would buy, beyond the fans you already reach',
          'Where they live, and how long the trip to your door takes',
          'What to say to each group, and where they’ll see it',
        ].map((t, i) => (
          <li key={t} className="flex gap-3 rounded-xl bg-white/[0.04] p-3 ring-1 ring-white/10">
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
