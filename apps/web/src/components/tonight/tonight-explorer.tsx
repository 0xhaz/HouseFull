'use client';

import {
  CITY_META,
  CITY_TZ,
  type LikedArtist,
  type TonightResult,
  type TonightWhen,
} from '@housefull/shared';
import { LoaderIcon, LocateFixedIcon } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { BaseMap, type MapPin } from '@/components/map/base-map';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { parseCity } from '@/lib/city';
import { getTonight } from '@/lib/client-api';
import { cn } from '@/lib/utils';
import { ArtistPicker } from './artist-picker';
import { distanceKm, EventCard, type Match } from './event-card';

const WHEN: Array<[TonightWhen, string]> = [
  ['tonight', 'Tonight'],
  ['tomorrow', 'Tomorrow'],
  ['weekend', 'This weekend'],
  ['week', 'Next 7 days'],
];
type Sort = 'match' | 'soon' | 'near';
const LIKES_KEY = 'housefull:likes';

/** Remembered on this device only. Storage can be unavailable (private mode): fine without it. */
function loadLikes(): LikedArtist[] {
  try {
    const v = JSON.parse(localStorage.getItem(LIKES_KEY) ?? '[]');
    return Array.isArray(v) ? v.slice(0, 5) : [];
  } catch {
    return [];
  }
}

/** What's on near you: shows soon, ranked by your taste (Qloo), time and distance. */
export function TonightExplorer() {
  const city = parseCity(useSearchParams().get('city'));
  const tz = CITY_TZ[city];
  const [when, setWhen] = useState<TonightWhen>('tonight');
  const [likes, setLikes] = useState<LikedArtist[]>([]);
  const [data, setData] = useState<TonightResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort | null>(null);
  const [genre, setGenre] = useState<string | null>(null);
  const [here, setHere] = useState<{ lat: number; lng: number } | undefined>();
  const [locating, setLocating] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => setLikes(loadLikes()), []);
  const changeLikes = (next: LikedArtist[]) => {
    setLikes(next);
    try {
      localStorage.setItem(LIKES_KEY, JSON.stringify(next));
    } catch {
      // storage unavailable: likes last for this visit only
    }
  };

  // Countdowns tick; the list itself refreshes every ten minutes.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const likesKey = likes.map((l) => l.id).join(',');
  // biome-ignore lint/correctness/useExhaustiveDependencies: likesKey stands in for likes
  useEffect(() => {
    let live = true;
    const load = () => {
      setLoading(true);
      setError(null);
      getTonight(city, when, likes)
        .then((r) => live && setData(r))
        .catch((e: Error) => live && setError(e.message))
        .finally(() => live && setLoading(false));
    };
    load();
    const t = setInterval(load, 10 * 60_000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [city, when, likesKey]);

  const matches = useMemo(() => {
    // Qloo affinities bunch together, so label by rank among tonight's scored shows.
    const out = new Map<string, Match>();
    const scored = (data?.events ?? [])
      .filter((e) => e.taste !== undefined)
      .sort((a, b) => (b.taste ?? 0) - (a.taste ?? 0));
    scored.forEach((e, i) => {
      const pct = i / scored.length;
      out.set(e.id, e.taste === 100 ? 'liked' : pct < 0.2 ? 'top' : pct < 0.5 ? 'good' : 'some');
    });
    return out;
  }, [data]);

  const genres = useMemo(() => {
    const count = new Map<string, number>();
    for (const e of data?.events ?? [])
      for (const g of e.genres) count.set(g, (count.get(g) ?? 0) + 1);
    return [...count]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([g]) => g);
  }, [data]);

  // A genre picked for another city or day doesn't filter the new list.
  const activeGenre = genre && genres.includes(genre) ? genre : null;
  const activeSort: Sort = sort ?? (data?.tasteUsed ? 'match' : here ? 'near' : 'soon');
  const events = useMemo(() => {
    const list = (data?.events ?? []).filter((e) => !activeGenre || e.genres.includes(activeGenre));
    const start = (e: (typeof list)[number]) =>
      e.startsAt ? Date.parse(e.startsAt) : Date.parse(`${e.date}T23:00:00Z`);
    const key = {
      match: (e: (typeof list)[number]) => -(e.campaign ? 101 : (e.taste ?? -1)),
      soon: start,
      near: (e: (typeof list)[number]) => distanceKm(e, here) ?? Number.POSITIVE_INFINITY,
    }[activeSort];
    return [...list].sort((a, b) => key(a) - key(b) || start(a) - start(b));
  }, [data, activeGenre, activeSort, here]);

  const pins = useMemo<MapPin[]>(() => {
    const byVenue = new Map<string, MapPin>();
    for (const e of events)
      if (e.lat !== undefined && e.lng !== undefined && !byVenue.has(e.venue))
        byVenue.set(e.venue, {
          id: e.id,
          lat: e.lat,
          lng: e.lng,
          label: `${e.artist} · ${e.venue}`,
          tone: matches.get(e.id) === 'top' || matches.get(e.id) === 'liked' ? 'primary' : 'muted',
          shape: 'dot',
        });
    return [...byVenue.values()].slice(0, 40);
  }, [events, matches]);

  function locate() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setHere({ lat: p.coords.latitude, lng: p.coords.longitude });
        setSort('near');
        setLocating(false);
      },
      () => setLocating(false),
      { maximumAge: 300_000, timeout: 10_000 },
    );
  }

  const meta = CITY_META[city];
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div className="grid content-start gap-5">
        <div className="grid gap-4 rounded-xl border bg-card p-4">
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="When">
            {WHEN.map(([w, label]) => (
              <Button
                key={w}
                type="button"
                role="tab"
                aria-selected={when === w}
                size="sm"
                variant={when === w ? 'default' : 'outline'}
                onClick={() => setWhen(w)}
              >
                {label}
              </Button>
            ))}
          </div>
          <ArtistPicker likes={likes} onChange={changeLikes} />
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Button type="button" size="sm" variant="outline" onClick={locate} disabled={locating}>
              {locating ? <LoaderIcon className="animate-spin" /> : <LocateFixedIcon />}
              {here ? 'Location on' : 'Use my location'}
            </Button>
            <span className="text-muted-foreground">Your location stays in your browser.</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {loading
              ? likes.length
                ? 'Matching shows to your taste…'
                : 'Finding shows…'
              : data?.available
                ? `${events.length} show${events.length === 1 ? '' : 's'} in ${meta.name}`
                : ''}
          </p>
          <fieldset className="flex gap-1">
            <legend className="sr-only">Sort</legend>
            {(
              [
                ['match', 'Best match', Boolean(data?.tasteUsed)],
                ['soon', 'Soonest', true],
                ['near', 'Nearest', Boolean(here)],
              ] as Array<[Sort, string, boolean]>
            )
              .filter(([, , ok]) => ok)
              .map(([s, label]) => (
                <Button
                  key={s}
                  type="button"
                  size="xs"
                  variant={activeSort === s ? 'secondary' : 'ghost'}
                  aria-pressed={activeSort === s}
                  onClick={() => setSort(s)}
                >
                  {label}
                </Button>
              ))}
          </fieldset>
        </div>

        {genres.length > 1 && (
          <fieldset className="flex flex-wrap gap-1.5">
            <legend className="sr-only">Genre</legend>
            {genres.map((g) => (
              <button
                key={g}
                type="button"
                aria-pressed={activeGenre === g}
                onClick={() => setGenre(activeGenre === g ? null : g)}
                className={cn(
                  'rounded-full border px-2.5 py-0.5 text-xs transition-colors',
                  genre === g
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'hover:bg-muted',
                )}
              >
                {g}
              </button>
            ))}
          </fieldset>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
        {data && !data.available && (
          <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            Live listings aren&apos;t available right now ({data.reason}).
          </p>
        )}
        {loading && !data ? (
          <div className="grid gap-3">
            <Skeleton className="h-36" />
            <Skeleton className="h-36" />
            <Skeleton className="h-36" />
          </div>
        ) : (
          data?.available &&
          (events.length ? (
            <ul className={cn('grid gap-3', loading && 'opacity-60')} aria-label="Shows">
              {events.map((e) => (
                <EventCard
                  key={e.id}
                  event={e}
                  tz={tz}
                  now={now}
                  match={matches.get(e.id)}
                  here={here}
                />
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              Nothing listed {WHEN.find(([w]) => w === when)?.[1].toLowerCase()}. Try a wider
              window.
            </p>
          ))
        )}
      </div>

      <div className="lg:sticky lg:top-20 lg:self-start">
        <BaseMap
          key={city}
          center={meta.center}
          zoom={meta.zoom}
          pins={pins}
          className="h-72 overflow-hidden rounded-xl border lg:h-[calc(100vh-7rem)]"
          ariaLabel={`Map of shows in ${meta.name}`}
        />
        <p className="mt-2 text-xs text-muted-foreground">
          Listings from Ticketmaster. Taste matching by Qloo.
          {city === 'nyc' ? ' Subway alerts from the MTA.' : ''}
        </p>
      </div>
    </div>
  );
}
