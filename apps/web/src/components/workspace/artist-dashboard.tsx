import { CITY_META, type WorkspaceOverview } from '@housefull/shared';
import Link from 'next/link';
import { daysUntil } from '@/lib/workspace-stats';
import {
  dayFmt,
  EmptyRuns,
  PlanShowButton,
  Section,
  ShowList,
  Stat,
  StatGrid,
  Tally,
} from './parts';

/** One act across a run of cities: who the new fans are in each, side by side. */
export function ArtistDashboard({ data }: { data: WorkspaceOverview }) {
  const { workspace: ws, runs } = data;
  const artist = ws.profile.artist ?? 'your artist';
  const done = runs.filter((r) => r.status === 'done');
  const cities = new Set(runs.map((r) => r.show.city));

  // Taste threads: artists the new audiences love in more than one city.
  const byCity = new Map<string, Set<string>>();
  for (const r of done)
    for (const s of r.segments)
      for (const f of s.fansOf) {
        const set = byCity.get(f) ?? new Set();
        set.add(r.show.city);
        byCity.set(f, set);
      }
  const threads = [...byCity]
    .map(([value, set]) => ({ value, count: set.size }))
    .filter((t) => t.count > 1)
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));

  if (!runs.length)
    return (
      <EmptyRuns slug={ws.slug}>
        No dates yet. Plan {artist}&apos;s first show and each city&apos;s new audiences show up
        here side by side.
      </EmptyRuns>
    );

  return (
    <div className="grid gap-6">
      <StatGrid>
        <Stat label="Cities" value={cities.size} />
        <Stat
          label="Shows"
          value={runs.length}
          hint={`${runs.filter((r) => daysUntil(r.show.date) >= 0).length} upcoming`}
        />
        <Stat
          label="New audiences found"
          value={done.reduce((n, r) => n + r.segments.length, 0)}
          hint="Beyond the core fan base"
        />
        <Stat label="Shared taste threads" value={threads.length} hint="Loved in 2+ cities" />
      </StatGrid>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Section
          title={`${artist} on tour`}
          description="Every date, with the brief’s step for today."
          action={<PlanShowButton slug={ws.slug} />}
        >
          <ShowList runs={runs} showArtist={false} />
        </Section>
        <Section
          title="Taste threads"
          description="Artists the new audiences love in more than one city, so one ad can work in several markets."
        >
          <Tally
            items={threads.slice(0, 14)}
            empty="Plan a second city to see what carries over."
          />
        </Section>
      </div>

      <section aria-labelledby="by-city" className="grid gap-3">
        <h2 id="by-city" className="text-lg font-semibold tracking-tight">
          New fans, city by city
        </h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {done.map((r) => (
            <Section
              key={r.id}
              title={CITY_META[r.show.city].name}
              description={`${r.show.venue.name} · ${dayFmt.format(new Date(`${r.show.date}T00:00:00Z`))}`}
              action={
                <Link
                  href={`/runs/${r.id}/brief`}
                  className="text-sm text-primary underline-offset-4 hover:underline"
                >
                  Brief
                </Link>
              }
            >
              <ol className="grid gap-3">
                {r.segments.map((s) => (
                  <li key={s.id} className="text-sm">
                    <p className="font-medium">{s.name}</p>
                    {s.fansOf.length > 0 && (
                      <p className="text-muted-foreground">Fans of {s.fansOf.join(', ')}</p>
                    )}
                    <p className="text-muted-foreground">
                      {s.sourceCities.length
                        ? `Travelling from ${s.sourceCities.join(', ')}`
                        : s.neighborhoods.join(', ')}
                    </p>
                  </li>
                ))}
              </ol>
            </Section>
          ))}
        </div>
      </section>
    </div>
  );
}
