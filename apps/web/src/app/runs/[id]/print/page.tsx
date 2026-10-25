import { CITY_META } from '@housefull/shared';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { PrintButton } from '@/components/print-button';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError, asReplan, getVersion, getVersions } from '@/lib/api';
import { keyed } from '@/lib/keys';

export const metadata: Metadata = { title: 'Campaign brief (print)' };

/** Print-ready brief: the browser's "Save as PDF" turns it into the exported PDF. */
async function Printable({ params, searchParams }: PageProps<'/runs/[id]/print'>) {
  const { id } = await params;
  const { v } = await searchParams;
  const versions = await getVersions(id).catch((e) => {
    if (e instanceof ApiError) notFound();
    throw e;
  });
  if (!versions.length) notFound();
  const latest = Math.max(...versions.map((x) => x.version));
  const wanted = Number(Array.isArray(v) ? v[0] : v);
  const version = versions.some((x) => x.version === wanted) ? wanted : latest;
  const { brief: b, changeNote } = await getVersion(id, version);
  const note = asReplan(changeNote);

  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-6 text-sm print:max-w-none print:text-[11pt]">
      <header className="flex items-start justify-between gap-4 border-b pb-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            HouseFull campaign brief · version {version}
          </p>
          <h1 className="text-2xl font-semibold">{b.artist.name}</h1>
          <p className="text-muted-foreground">
            {b.show.venue.name}, {CITY_META[b.show.city].name} · {b.show.date}
            {b.show.soldPct !== undefined && ` · ${b.show.soldPct}% sold`}
          </p>
        </div>
        <PrintButton />
      </header>

      {note && (
        <section className="break-inside-avoid">
          <h2 className="font-semibold">What changed in this version</h2>
          <p>{note.summary}</p>
        </section>
      )}

      <section className="break-inside-avoid">
        <h2 className="font-semibold">Diagnosis · venue fit {b.venueFit.score}/100</h2>
        <p>{b.summary}</p>
        <ul className="mt-1 list-disc pl-5 text-muted-foreground">
          {b.venueFit.reasons.map((r) => (
            <li key={r.text}>{r.text}</li>
          ))}
        </ul>
      </section>

      {b.segments.map((s) => (
        <section key={s.id} className="break-inside-avoid border-t pt-4">
          <h2 className="font-semibold">{s.name}</h2>
          <p className="text-muted-foreground">Fans of {s.seeds.map((x) => x.name).join(', ')}</p>
          <ul className="mt-1 list-disc pl-5">
            {s.why.map((c) => (
              <li key={c.text}>{c.text}</li>
            ))}
          </ul>
          <p className="mt-2">
            <strong>Where:</strong>{' '}
            {s.neighborhoods
              .map((n) => `${n.name} (${n.lift.toFixed(2)}×, ${n.accessMin} min)`)
              .join(' · ')}
          </p>
          {s.sourceCities?.length ? (
            <p>
              <strong>Visitors from:</strong> {s.sourceCities.map((c) => c.metro).join(', ')}
            </p>
          ) : null}
          <p>
            <strong>Reach:</strong>{' '}
            {[...s.channels.podcasts, ...s.channels.tvShows]
              .slice(0, 6)
              .map((x) => x.name)
              .join(', ')}
          </p>
          <p>
            <strong>Ad interests (suggested):</strong> {s.channels.adTargeting.interests.join(', ')}
          </p>
          <ol className="mt-2 flex flex-col gap-1 pl-5" style={{ listStyleType: 'upper-alpha' }}>
            {s.copy.map((c) => (
              <li key={c.headline}>
                <strong>{c.headline}</strong> {c.body} <em>[{c.cta}]</em>
              </li>
            ))}
          </ol>
        </section>
      ))}

      <section className="break-inside-avoid border-t pt-4">
        <h2 className="font-semibold">Opening acts that bring new fans</h2>
        <p>
          {b.openers.map((o) => o.artist.name).join(', ') || 'None found'} (availability not
          checked)
        </p>
        <h2 className="mt-3 font-semibold">Partner deals near the venue</h2>
        <ul className="list-disc pl-5">
          {b.partnerDeals.map((d) => (
            <li key={d.place.entityId}>
              {d.place.name} ({Math.round(d.place.distanceM)} m, {d.place.hours}): {d.offer}
            </li>
          ))}
        </ul>
      </section>

      <section className="break-inside-avoid border-t pt-4">
        <h2 className="font-semibold">Countdown</h2>
        <ul className="list-disc pl-5">
          {keyed(b.schedule, (s) => `${s.daysOut}-${s.action}`).map(([key, s]) => (
            <li key={key}>
              <strong>{s.daysOut} days out:</strong> {s.action}
            </li>
          ))}
        </ul>
        {(b.disruptions?.length || b.conflicts.length) > 0 && (
          <>
            <h2 className="mt-3 font-semibold">Show night</h2>
            <ul className="list-disc pl-5">
              {keyed(b.disruptions ?? [], (d) => `${d.source.recordId}-${d.title}`).map(
                ([key, d]) => (
                  <li key={key}>
                    {d.title}: {d.effect}
                  </li>
                ),
              )}
              {keyed(b.conflicts, (c) => `${c.name}-${c.venue}-${c.time}`).map(([key, c]) => (
                <li key={key}>
                  Competing show: {c.name} at {c.venue} {c.time}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <footer className="border-t pt-3 text-xs text-muted-foreground">
        Every audience claim links to the Qloo call it came from (see the online brief).
        Demographics are aggregate skews only. Estimates are directional; ticket sales are not
        predicted.
      </footer>
    </article>
  );
}

export default function Page(props: PageProps<'/runs/[id]/print'>) {
  return (
    <main className="flex-1 px-4 py-8 print:p-0">
      <Suspense fallback={<Skeleton className="mx-auto h-96 max-w-3xl" />}>
        <Printable {...props} />
      </Suspense>
    </main>
  );
}
