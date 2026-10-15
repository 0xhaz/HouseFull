import { CITY_META, type WorkspaceOverview } from '@housefull/shared';
import { attention, daysUntil, tally } from '@/lib/workspace-stats';
import { EmptyRuns, PlanShowButton, Section, ShowList, Stat, StatGrid, Tally } from './parts';

/** Every show on sale, what's at risk, and where the new buyers are across the roster. */
export function PromoterDashboard({ data }: { data: WorkspaceOverview }) {
  const { workspace: ws, runs } = data;
  const upcoming = runs.filter((r) => daysUntil(r.show.date) >= 0);
  const flagged = upcoming.filter((r) => attention(r, daysUntil(r.show.date)));
  const next = upcoming[0];
  const cities = [...new Set(runs.map((r) => r.show.city))];

  if (!runs.length)
    return (
      <EmptyRuns slug={ws.slug} city={ws.profile.cities?.[0]}>
        No shows yet. Plan the first one and its brief lands here, with the countdown and results
        for each show you add.
      </EmptyRuns>
    );

  return (
    <div className="grid gap-6">
      <StatGrid>
        <Stat label="Shows on sale" value={upcoming.length} hint={`${cities.length} cities`} />
        <Stat
          label="Need attention"
          value={flagged.length}
          hint={flagged.length ? 'Short of target or not measured' : 'All on track'}
        />
        <Stat
          label="Next show"
          value={next ? `${daysUntil(next.show.date)} days` : '—'}
          hint={next ? next.show.artist : undefined}
        />
        <Stat
          label="Re-planned from results"
          value={runs.filter((r) => r.version > 1).length}
          hint="Briefs rewritten from check-ins"
        />
      </StatGrid>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Section
          title="Your shows"
          description="Soonest first. “Now” is the brief’s step for today."
          action={<PlanShowButton slug={ws.slug} />}
        >
          <ShowList runs={runs} />
        </Section>
        <div className="grid content-start gap-6">
          {flagged.length > 0 && (
            <Section title="Needs attention" description="Close to the show and short of full.">
              <ShowList runs={flagged} />
            </Section>
          )}
          {cities.map((c) => (
            <Section
              key={c}
              title={`New buyers in ${CITY_META[c].name}`}
              description="Neighborhoods the briefs target, across your shows here."
            >
              <Tally
                items={tally(
                  runs
                    .filter((r) => r.show.city === c)
                    .flatMap((r) => r.segments.flatMap((s) => s.neighborhoods)),
                ).slice(0, 10)}
                empty="Travel-led city: see each brief for source cities."
              />
            </Section>
          ))}
        </div>
      </div>
    </div>
  );
}
