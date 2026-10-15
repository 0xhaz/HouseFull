import { CITY_META, type WorkspaceOverview } from '@housefull/shared';
import { daysUntil, tally } from '@/lib/workspace-stats';
import { EmptyRuns, PlanShowButton, Section, ShowList, Stat, StatGrid, Tally } from './parts';
import { VenueCalendar } from './venue-calendar';

const PARTNER_KINDS = new Set(['bar', 'cafe', 'record store', 'restaurant']);

/** The room's calendar, the audience it draws, and the local places its shows share. */
export function VenueDashboard({ data }: { data: WorkspaceOverview }) {
  const { workspace: ws, runs } = data;
  const venue = ws.profile.venue;
  const fits = runs.flatMap((r) => (r.venueFit === null ? [] : [r.venueFit]));
  const avgFit = fits.length ? Math.round(fits.reduce((a, b) => a + b, 0) / fits.length) : null;
  const upcoming = runs.filter((r) => daysUntil(r.show.date) >= 0);

  return (
    <div className="grid gap-6">
      <StatGrid>
        <Stat label="Planned shows" value={runs.length} hint={`${upcoming.length} upcoming`} />
        <Stat
          label="Average venue fit"
          value={avgFit === null ? '—' : `${avgFit}/100`}
          hint="How well each act’s fans match the room"
        />
        <Stat
          label="Capacity"
          value={venue?.capacity?.toLocaleString('en-US') ?? '—'}
          hint={venue ? CITY_META[venue.city].name : undefined}
        />
        <Stat
          label="Local partners"
          value={new Set(runs.flatMap((r) => r.partners.map((p) => p.name))).size}
          hint="Places the briefs suggest teaming up with"
        />
      </StatGrid>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-6">
          <Section
            title="Planned shows"
            description={`Campaign briefs for shows at ${venue?.name ?? 'your venue'}.`}
            action={<PlanShowButton slug={ws.slug} city={venue?.city} />}
          >
            {runs.length ? (
              <ShowList runs={runs} />
            ) : (
              <EmptyRuns slug={ws.slug} city={venue?.city}>
                No shows planned yet. Pick one from your calendar below.
              </EmptyRuns>
            )}
          </Section>
          {venue && (
            <Section
              title="On sale at your venue"
              description="From Ticketmaster. Plan any date to get its campaign brief."
            >
              <VenueCalendar
                venue={venue}
                planned={runs.map((r) => ({
                  id: r.id,
                  artist: r.show.artist,
                  date: r.show.date,
                }))}
              />
            </Section>
          )}
        </div>
        <div className="grid content-start gap-6">
          <Section
            title="Who your room draws"
            description="Artists the new audiences also love, across your shows."
          >
            <Tally
              items={tally(runs.flatMap((r) => r.segments.flatMap((s) => s.fansOf))).slice(0, 14)}
              empty="Plan a show to see the taste profile of your room."
            />
          </Section>
          <Section title="Where they live" description="Neighborhoods your briefs target.">
            <Tally
              items={tally(runs.flatMap((r) => r.segments.flatMap((s) => s.neighborhoods))).slice(
                0,
                12,
              )}
              empty="No neighborhoods yet."
            />
          </Section>
          <Section
            title="Partners near you"
            description="Bars, record stores and cafés that share your audience."
          >
            <Tally
              items={tally(
                runs.flatMap((r) =>
                  r.partners.filter((p) => PARTNER_KINDS.has(p.kind ?? '')).map((p) => p.name),
                ),
              ).slice(0, 12)}
              empty="No partners yet."
            />
          </Section>
        </div>
      </div>
    </div>
  );
}
