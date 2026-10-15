'use client';

import type { WorkspaceProfile } from '@housefull/shared';
import { LoaderIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { searchShows, startShowRun, type TmShow } from '@/lib/client-api';
import { useRunContext } from '@/lib/workspace-context';
import { dayFmt } from './parts';

type Venue = NonNullable<WorkspaceProfile['venue']>;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Upcoming Ticketmaster dates at the venue; each can be planned in one click. */
export function VenueCalendar({
  venue,
  planned,
}: {
  venue: Venue;
  planned: Array<{ id: string; artist: string; date: string }>;
}) {
  const router = useRouter();
  const runContext = useRunContext();
  const [events, setEvents] = useState<TmShow[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    searchShows(venue.name, venue.city).then(
      (r) => {
        if (!r.available) setNote(r.reason ?? 'Ticketmaster isn’t available right now.');
        setEvents(r.events.filter((e) => norm(e.venue).includes(norm(venue.name))).slice(0, 12));
      },
      () => {
        setNote('Couldn’t reach Ticketmaster.');
        setEvents([]);
      },
    );
  }, [venue.name, venue.city]);

  async function plan(e: TmShow) {
    setBusy(e.id);
    try {
      const { runId } = await startShowRun(
        {
          artist: e.artist,
          venue: { name: venue.name, lat: venue.lat, lng: venue.lng, capacity: venue.capacity },
          city: venue.city,
          date: e.date,
        },
        await runContext(),
      );
      router.push(`/runs/${runId}`);
    } catch (err) {
      toast.error((err as Error).message);
      setBusy(null);
    }
  }

  if (!events) return <Skeleton className="h-40" />;
  if (!events.length)
    return (
      <p className="text-sm text-muted-foreground">
        {note ?? 'No upcoming dates found on Ticketmaster for this venue.'}
      </p>
    );
  return (
    <ul className="divide-y">
      {events.map((e) => {
        const done = planned.find((p) => p.date === e.date && norm(p.artist) === norm(e.artist));
        return (
          <li key={e.id} className="flex flex-wrap items-center gap-3 py-2.5">
            <span className="w-14 shrink-0 text-sm font-medium tabular-nums">
              {dayFmt.format(new Date(`${e.date}T00:00:00Z`))}
            </span>
            <span className="min-w-0 flex-1 text-sm">
              {e.artist}
              {e.name !== e.artist && (
                <span className="block truncate text-xs text-muted-foreground">{e.name}</span>
              )}
            </span>
            {done ? (
              <Button asChild size="sm" variant="ghost">
                <Link href={`/runs/${done.id}/brief`}>Brief</Link>
              </Button>
            ) : (
              <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => plan(e)}>
                {busy === e.id && <LoaderIcon className="size-3.5 animate-spin" />}
                Plan
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
