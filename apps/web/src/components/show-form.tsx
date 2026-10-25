'use client';

import { CITY_META, type ShowInput, ShowInputSchema } from '@housefull/shared';
import { LoaderIcon, MapPinIcon, TicketIcon } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { type FormEvent, useEffect, useId, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { parseCity } from '@/lib/city';
import { searchShows, searchVenues, startShowRun, type TmShow, type Venue } from '@/lib/client-api';
import { useRunContext, useWorkspace } from '@/lib/workspace-context';

/** Plan a show that isn't a preset: venue search runs on Qloo places in the selected city. */
export function ShowForm() {
  const router = useRouter();
  const city = parseCity(useSearchParams().get('city'));
  const ids = {
    artist: useId(),
    venue: useId(),
    date: useId(),
    sold: useId(),
    budget: useId(),
    list: useId(),
    tm: useId(),
  };
  // Inside a venue or artist workspace, the room or the act is already known.
  const profile = useWorkspace()?.profile;
  const homeVenue: Venue | null =
    profile?.venue && profile.venue.city === city
      ? { entityId: 'workspace', ...profile.venue }
      : null;
  const runContext = useRunContext();
  const [artist, setArtist] = useState(profile?.artist ?? '');
  const [query, setQuery] = useState(homeVenue?.name ?? '');
  const [venue, setVenue] = useState<Venue | null>(homeVenue);
  const [results, setResults] = useState<Venue[]>([]);
  const [searching, setSearching] = useState(false);
  const [date, setDate] = useState('');
  const [soldPct, setSoldPct] = useState('');
  const [budget, setBudget] = useState('');
  const [busy, setBusy] = useState(false);
  const [tmQuery, setTmQuery] = useState('');
  const [tmResults, setTmResults] = useState<TmShow[]>([]);
  const [tmNote, setTmNote] = useState<string | null>(null);

  // Ticketmaster picker: fills artist, venue and date in one go.
  useEffect(() => {
    if (tmQuery.trim().length < 2) {
      setTmResults([]);
      setTmNote(null);
      return;
    }
    const t = setTimeout(() => {
      searchShows(tmQuery, city).then(
        (r) => {
          setTmResults(r.events);
          setTmNote(
            r.available
              ? r.events.length
                ? null
                : 'No upcoming shows found nearby'
              : (r.reason ?? null),
          );
        },
        () => setTmResults([]),
      );
    }, 350);
    return () => clearTimeout(t);
  }, [tmQuery, city]);

  const pickShow = (e: TmShow) => {
    setArtist(e.artist);
    setVenue({ entityId: e.id, name: e.venue, lat: e.lat, lng: e.lng });
    setDate(e.date);
    setTmQuery('');
    setTmResults([]);
  };

  // Changing city invalidates the chosen venue.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs only when the city changes
  useEffect(() => {
    setVenue(homeVenue);
    setQuery(homeVenue?.name ?? '');
    setResults([]);
  }, [city]);

  useEffect(() => {
    if (venue || query.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      setSearching(true);
      searchVenues(query, city)
        .then(setResults, () => setResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [query, city, venue]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!venue) return toast.error('Pick a venue from the list');
    const show: ShowInput = {
      artist: artist.trim(),
      venue: {
        name: venue.name,
        lat: venue.lat,
        lng: venue.lng,
        ...(profile?.venue?.capacity && venue.name === homeVenue?.name
          ? { capacity: profile.venue.capacity }
          : {}),
      },
      city,
      date,
      ...(soldPct ? { soldPct: Number(soldPct) } : {}),
      ...(budget ? { budgetUsd: Number(budget) } : {}),
    };
    const parsed = ShowInputSchema.safeParse(show);
    if (!parsed.success) return toast.error('Check the artist, venue and date');
    setBusy(true);
    try {
      const { runId } = await startShowRun(parsed.data, await runContext());
      router.push(`/runs/${runId}`);
    } catch (err) {
      toast.error((err as Error).message);
      setBusy(false);
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-bold tracking-tight">Plan your own show</CardTitle>
        <CardDescription>
          Any artist Qloo knows, any venue in {CITY_META[city].name}. A fresh plan takes about 40
          seconds.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.8fr)] lg:items-start">
        <div className="relative flex flex-col gap-1.5 lg:border-r lg:pr-6">
          <Label htmlFor={ids.tm}>Find it on Ticketmaster</Label>
          <Input
            id={ids.tm}
            autoComplete="off"
            value={tmQuery}
            onChange={(e) => setTmQuery(e.target.value)}
            placeholder="Artist or show name"
          />
          {tmNote && <p className="text-xs text-muted-foreground">{tmNote}</p>}
          {tmResults.length > 0 && (
            <ul
              aria-label="Matching shows"
              className="absolute top-full z-30 mt-1 w-full overflow-hidden rounded-md border bg-popover shadow-md"
            >
              {tmResults.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => pickShow(e)}
                    className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                  >
                    <TicketIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                    <span>
                      {e.name}
                      <span className="block text-xs text-muted-foreground">
                        {e.venue} · {e.date}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">
            Fills in the artist, venue and date for you.
            <span className="lg:hidden"> Or fill in the details below.</span>
            <span className="hidden lg:inline"> Or fill in the details yourself.</span>
          </p>
        </div>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={ids.artist}>Artist</Label>
            <Input
              id={ids.artist}
              required
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              placeholder="e.g. Khruangbin"
            />
          </div>
          <div className="relative flex flex-col gap-1.5">
            <Label htmlFor={ids.venue}>Venue</Label>
            <Input
              id={ids.venue}
              required
              aria-describedby={results.length ? ids.list : undefined}
              autoComplete="off"
              value={venue ? venue.name : query}
              onChange={(e) => {
                setVenue(null);
                setQuery(e.target.value);
              }}
              placeholder="Search venues"
            />
            {searching && (
              <LoaderIcon className="absolute top-8 right-2.5 size-4 animate-spin text-muted-foreground" />
            )}
            {results.length > 0 && (
              <ul
                id={ids.list}
                aria-label="Matching venues"
                className="absolute top-full z-20 mt-1 w-full overflow-hidden rounded-md border bg-popover shadow-md"
              >
                {results.map((v) => (
                  <li key={v.entityId}>
                    <button
                      type="button"
                      className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                      onClick={() => {
                        setVenue(v);
                        setResults([]);
                      }}
                    >
                      <MapPinIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                      <span>
                        {v.name}
                        {v.address && (
                          <span className="block text-xs text-muted-foreground">{v.address}</span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={ids.date}>Show date</Label>
            <Input
              id={ids.date}
              type="date"
              required
              min={today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={ids.sold}>% sold</Label>
              <Input
                id={ids.sold}
                type="number"
                min={0}
                max={100}
                inputMode="numeric"
                value={soldPct}
                onChange={(e) => setSoldPct(e.target.value)}
                placeholder="optional"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={ids.budget}>Budget $</Label>
              <Input
                id={ids.budget}
                type="number"
                min={0}
                inputMode="numeric"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="optional"
              />
            </div>
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={busy}>
              {busy && <LoaderIcon className="size-3.5 animate-spin" />}
              Plan this show
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
