'use client';

import {
  CITY_META,
  CITY_TZ,
  type LikedArtist,
  localDate,
  SCENE_LABEL,
  type Scene,
  type SpotKind,
  type TonightEvent,
  type TonightResult,
  type TonightSpots,
  type TonightWhen,
} from '@housefull/shared';
import {
  LoaderIcon,
  LocateFixedIcon,
  MapPinIcon,
  MusicIcon,
  SparklesIcon,
  TrainFrontIcon,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { BaseMap, type MapPin } from '@/components/map/base-map';
import { HeroGlow } from '@/components/page-hero';
import { Skeleton } from '@/components/ui/skeleton';
import { parseCity } from '@/lib/city';
import { getTonight, getTonightSpots } from '@/lib/client-api';
import { cn } from '@/lib/utils';
import { ArtistPicker } from './artist-picker';
import { isOn, LineupRow, type Match, PosterCard, startOf } from './event-card';
import { SpotCard } from './spot-card';

const WHEN: Array<[TonightWhen, string]> = [
  ['tonight', 'Tonight'],
  ['tomorrow', 'Tomorrow'],
  ['weekend', 'This weekend'],
  ['week', 'Next 7 days'],
];
const SCENES: Scene[] = ['jazz', 'indie', 'electronic', 'hiphop', 'folk', 'pop', 'latin', 'other'];
const SPOT_FILTERS: Array<[SpotKind | 'all', string]> = [
  ['all', 'All'],
  ['jazz', 'Jazz & blues'],
  ['pub', 'Pubs'],
  ['bar', 'Bars'],
];
const LIKES_KEY = 'housefull:likes';
const SOON_MS = 2 * 3_600_000;

/** Remembered on this device only. Storage can be unavailable (private mode): fine without it. */
function loadLikes(): LikedArtist[] {
  try {
    const v = JSON.parse(localStorage.getItem(LIKES_KEY) ?? '[]');
    return Array.isArray(v) ? v.slice(0, 5) : [];
  } catch {
    return [];
  }
}

const roomOk = (e: TonightEvent, intimate: boolean) =>
  !intimate || (e.venueType !== 'arena' && e.venueType !== 'hall');

/** Gig guide: what's on in the city, ranked by your taste, plus places to walk into tonight. */
export function TonightExplorer() {
  const city = parseCity(useSearchParams().get('city'));
  const tz = CITY_TZ[city];
  const meta = CITY_META[city];
  const [when, setWhen] = useState<TonightWhen>('tonight');
  const [likes, setLikes] = useState<LikedArtist[]>([]);
  const [data, setData] = useState<TonightResult | null>(null);
  const [spots, setSpots] = useState<TonightSpots | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scene, setScene] = useState<Scene | 'all'>('all');
  const [intimate, setIntimate] = useState(false);
  const [spotKind, setSpotKind] = useState<SpotKind | 'all'>('all');
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

  // Clock and countdowns tick; listings refresh every ten minutes.
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: likesKey stands in for likes
  useEffect(() => {
    let live = true;
    setSpots(null);
    getTonightSpots(city, likes).then(
      (r) => live && setSpots(r),
      () => live && setSpots({ city, date: '', available: false, spots: [] }),
    );
    return () => {
      live = false;
    };
  }, [city, likesKey]);

  const matches = useMemo(() => {
    // Qloo affinities bunch together, so label by rank among the scored shows.
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

  const sceneCounts = useMemo(() => {
    const c = new Map<Scene | 'all', number>();
    for (const e of data?.events ?? [])
      if (roomOk(e, intimate)) {
        c.set('all', (c.get('all') ?? 0) + 1);
        c.set(e.scene, (c.get(e.scene) ?? 0) + 1);
      }
    return c;
  }, [data, intimate]);

  const events = useMemo(
    () =>
      (data?.events ?? [])
        .filter((e) => (scene === 'all' || e.scene === scene) && roomOk(e, intimate))
        .sort((a, b) => startOf(a) - startOf(b)),
    [data, scene, intimate],
  );

  // Top picks: best taste matches when we know the visitor's taste, otherwise what starts next.
  const picks = useMemo(() => {
    const upcoming = events.filter((e) => isOn(e, now) || startOf(e) > now);
    if (data?.tasteUsed)
      return [...upcoming]
        .filter((e) => matches.has(e.id))
        .sort((a, b) => (b.taste ?? 0) - (a.taste ?? 0))
        .slice(0, 10);
    // Small rooms first: jazz clubs, bars and clubs before halls and arenas, then by time.
    const room = { jazz: 0, bar: 1, club: 2, venue: 3, hall: 4, arena: 5 } as const;
    return upcoming
      .filter((e) => e.image)
      .sort((a, b) => room[a.venueType] - room[b.venueType] || startOf(a) - startOf(b))
      .slice(0, 10);
  }, [events, data, matches, now]);

  const groups = useMemo(() => groupByTime(events, tz, now), [events, tz, now]);
  // One notice for the lineup instead of the same alert on every row.
  const alerts = useMemo(() => {
    const m = new Map<string, { header: string; routes: string[] }>();
    for (const e of events) for (const t of e.transit ?? []) m.set(t.header, t);
    return [...m.values()].slice(0, 4);
  }, [events]);
  const shownSpots = useMemo(
    () => (spots?.spots ?? []).filter((s) => spotKind === 'all' || s.kind === spotKind),
    [spots, spotKind],
  );

  const pins = useMemo<MapPin[]>(() => {
    const out = new Map<string, MapPin>();
    for (const e of events)
      if (e.lat !== undefined && e.lng !== undefined && !out.has(e.venue))
        out.set(e.venue, {
          id: e.id,
          lat: e.lat,
          lng: e.lng,
          label: `${e.artist} · ${e.venue}`,
          tone: 'primary',
          shape: 'dot',
        });
    for (const s of shownSpots)
      if (s.lat !== undefined && s.lng !== undefined)
        out.set(s.id, {
          id: s.id,
          lat: s.lat,
          lng: s.lng,
          label: s.name,
          tone: 'muted',
          shape: 'dot',
        });
    return [...out.values()].slice(0, 60);
  }, [events, shownSpots]);

  function locate() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setHere({ lat: p.coords.latitude, lng: p.coords.longitude });
        setLocating(false);
      },
      () => setLocating(false),
      { maximumAge: 300_000, timeout: 10_000 },
    );
  }

  const clock = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'long',
    hour: 'numeric',
    minute: '2-digit',
  }).format(now);
  const nowHHMM = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(now);
  const whenText = WHEN.find(([w]) => w === when)?.[1] ?? 'Tonight';

  return (
    <>
      {/* Hero: always dark, like a room at night. */}
      <section className="relative isolate overflow-hidden bg-zinc-950 text-white">
        <HeroGlow />
        <div className="mx-auto grid max-w-6xl gap-6 px-4 pt-10 pb-8 sm:pt-14">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80 ring-1 ring-white/15">
              <span className="relative flex size-2 text-primary" aria-hidden>
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-70" />
                <span className="relative inline-flex size-2 rounded-full bg-current" />
              </span>
              Live in {meta.name} · {clock}
            </p>
            <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-balance sm:text-6xl">
              {whenText} in{' '}
              <span className="bg-gradient-to-r from-primary via-fuchsia-400 to-sky-300 bg-clip-text text-transparent">
                {meta.name}
              </span>
            </h1>
            <p className="mt-3 max-w-2xl text-white/70 text-pretty sm:text-lg">
              Gigs, jazz clubs and pubs with live music. Tell us who you love and Qloo&apos;s taste
              graph finds the shows you&apos;d enjoy, including acts you&apos;ve never heard of.
            </p>
            <p className="mt-3 text-sm text-white/60" aria-live="polite">
              {loading && !data
                ? 'Finding shows…'
                : data?.available
                  ? `${sceneCounts.get('all') ?? 0} shows · ${spots ? spots.spots.length : '…'} live-music spots`
                  : ''}
            </p>
          </div>

          <div className="flex flex-wrap gap-2" role="tablist" aria-label="When">
            {WHEN.map(([w, label]) => (
              <button
                key={w}
                type="button"
                role="tab"
                aria-selected={when === w}
                onClick={() => setWhen(w)}
                className={cn(
                  'rounded-full px-4 py-2 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none',
                  when === w
                    ? 'bg-white text-zinc-950'
                    : 'bg-white/10 text-white ring-1 ring-white/15 hover:bg-white/20',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <ArtistPicker likes={likes} onChange={changeLikes} tone="dark" />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={locate}
                disabled={locating}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-white/10 px-4 text-sm font-medium ring-1 ring-white/15 hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none"
              >
                {locating ? (
                  <LoaderIcon className="size-4 animate-spin" />
                ) : (
                  <LocateFixedIcon className="size-4" />
                )}
                {here ? 'Using your location' : 'Near me'}
              </button>
              <span className="text-xs text-white/50">Your location stays in your browser.</span>
            </div>
          </div>
        </div>
      </section>

      {/* Scene bar: sticks under the site header. */}
      <div className="sticky top-14 z-30 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-2 overflow-x-auto px-4 py-2.5 [scrollbar-width:none]">
          <fieldset className="flex shrink-0 gap-1.5">
            <legend className="sr-only">Scene</legend>
            {(['all', ...SCENES] as const).map((s) => {
              const count = sceneCounts.get(s) ?? 0;
              if (s !== 'all' && !count) return null;
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={scene === s}
                  onClick={() => setScene(s)}
                  className={cn(
                    'shrink-0 rounded-full border px-3 py-1.5 text-sm whitespace-nowrap transition-colors',
                    scene === s
                      ? 'border-foreground bg-foreground text-background'
                      : 'hover:bg-muted',
                  )}
                >
                  {s === 'all' ? 'All music' : SCENE_LABEL[s]}
                  <span className="ml-1.5 text-xs tabular-nums opacity-60">{count}</span>
                </button>
              );
            })}
          </fieldset>
          <span className="mx-1 h-6 w-px shrink-0 bg-border" aria-hidden />
          <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm whitespace-nowrap">
            <input
              type="checkbox"
              checked={intimate}
              onChange={(e) => setIntimate(e.target.checked)}
              className="size-4 accent-[var(--primary)]"
            />
            Intimate rooms only
          </label>
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-10 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid min-w-0 content-start gap-10">
          {error && <p className="text-sm text-destructive">{error}</p>}
          {data && !data.available && (
            <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
              Live listings aren&apos;t available right now ({data.reason}).
            </p>
          )}

          <Rail
            title="Walk in tonight"
            icon={<MusicIcon className="size-5 text-primary" aria-hidden />}
            subtitle="Jazz clubs, pubs and bars known for live music. No ticket needed. Hours come from their listing, so check before you go."
            action={
              <fieldset className="flex flex-wrap gap-1">
                <legend className="sr-only">Kind of place</legend>
                {SPOT_FILTERS.map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={spotKind === k}
                    onClick={() => setSpotKind(k)}
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-xs',
                      spotKind === k
                        ? 'border-foreground bg-foreground text-background'
                        : 'hover:bg-muted',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </fieldset>
            }
          >
            {!spots ? (
              <RailSkeleton />
            ) : shownSpots.length ? (
              <ul
                className="relative -mx-4 flex min-w-0 snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2"
                aria-label="Live-music spots"
              >
                {shownSpots.map((s) => (
                  <SpotCard key={s.id} spot={s} nowHHMM={nowHHMM} here={here} />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No spots found right now.</p>
            )}
          </Rail>

          <Rail
            title={data?.tasteUsed ? 'Top picks for you' : 'Small rooms, big nights'}
            icon={<SparklesIcon className="size-5 text-primary" aria-hidden />}
            subtitle={
              data?.tasteUsed
                ? `Closest to ${likes.map((l) => l.name).join(', ')}, by Qloo’s taste graph`
                : 'Jazz clubs, bars and small venues first. Add artists you love above for picks matched to your taste'
            }
          >
            {loading && !data ? (
              <RailSkeleton tall />
            ) : picks.length ? (
              <ul
                className="relative -mx-4 flex min-w-0 snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2"
                aria-label="Top picks"
              >
                {picks.map((e) => (
                  <PosterCard key={e.id} event={e} tz={tz} now={now} match={matches.get(e.id)} />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Nothing coming up in this scene.</p>
            )}
          </Rail>

          <section aria-labelledby="lineup" className="grid gap-2">
            <h2 id="lineup" className="text-2xl font-bold tracking-tight">
              The lineup
            </h2>
            {alerts.length > 0 && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
                <p className="flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-400">
                  <TrainFrontIcon className="size-4" aria-hidden />
                  Subway alerts near tonight&apos;s venues
                </p>
                <ul className="mt-1.5 grid gap-1">
                  {alerts.map((a) => (
                    <li key={a.header}>
                      <span className="font-medium">{a.routes.join(' ')}:</span> {a.header}
                    </li>
                  ))}
                </ul>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Alerts name lines, not stops, so they may not affect your trip. From the MTA.
                </p>
              </div>
            )}
            {loading && !data ? (
              <div className="grid gap-3">
                <Skeleton className="h-28" />
                <Skeleton className="h-28" />
                <Skeleton className="h-28" />
              </div>
            ) : groups.length ? (
              <div className={cn('grid gap-6', loading && 'opacity-60')}>
                {groups.map((g) => (
                  <div key={g.label}>
                    <h3 className="sticky top-[6.75rem] z-10 -mx-1 flex items-center gap-2 bg-background/90 px-1 py-2 text-sm font-semibold tracking-wide uppercase backdrop-blur">
                      {g.live && <span className="size-2 rounded-full bg-primary" aria-hidden />}
                      {g.label}
                      <span className="font-normal text-muted-foreground normal-case">
                        {g.events.length} show{g.events.length === 1 ? '' : 's'}
                      </span>
                    </h3>
                    <ul aria-label={g.label}>
                      {g.events.map((e) => (
                        <LineupRow
                          key={e.id}
                          event={e}
                          tz={tz}
                          now={now}
                          match={matches.get(e.id)}
                          here={here}
                        />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              data?.available && (
                <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                  Nothing in this scene {whenText.toLowerCase()}. Try another scene or a wider
                  window.
                </p>
              )
            )}
          </section>
        </div>

        <aside className="lg:sticky lg:top-[7.5rem] lg:self-start">
          <BaseMap
            key={city}
            center={meta.center}
            zoom={meta.zoom}
            pins={pins}
            className="h-72 overflow-hidden rounded-2xl border lg:h-[calc(100vh-9.5rem)]"
            ariaLabel={`Map of shows and live-music spots in ${meta.name}`}
          />
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className="size-2.5 rounded-full bg-primary" aria-hidden /> Shows
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="size-2.5 rounded-full bg-foreground/60" aria-hidden /> Live-music
              spots
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPinIcon className="size-3" aria-hidden />
              Ticketmaster · Qloo{city === 'nyc' ? ' · MTA' : ''}
            </span>
          </p>
        </aside>
      </div>
    </>
  );
}

function Rail({
  title,
  subtitle,
  icon,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="grid min-w-0 grid-cols-1 gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            {icon}
            {title}
          </h2>
          {subtitle && (
            <p className="mt-0.5 text-sm text-muted-foreground text-pretty">{subtitle}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function RailSkeleton({ tall }: { tall?: boolean }) {
  return (
    <div className="flex gap-3 overflow-hidden">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton
          key={i}
          className={cn('shrink-0 rounded-2xl', tall ? 'h-80 w-64' : 'h-64 w-72')}
        />
      ))}
    </div>
  );
}

/** On now · Starting soon · Later tonight · then one group per day. */
function groupByTime(events: TonightEvent[], tz: string, now: number) {
  const today = localDate(tz, new Date(now));
  const dayLabel = (iso: string) =>
    new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${iso}T12:00:00Z`));
  const groups = new Map<string, { label: string; live?: boolean; events: TonightEvent[] }>();
  const put = (key: string, label: string, e: TonightEvent, live?: boolean) => {
    const g = groups.get(key) ?? { label, live, events: [] };
    g.events.push(e);
    groups.set(key, g);
  };
  for (const e of events) {
    const start = startOf(e);
    if (isOn(e, now)) put('0-now', 'On now', e, true);
    else if (e.startsAt && start > now && start - now <= SOON_MS) put('1-soon', 'Starting soon', e);
    else if (e.date === today) put('2-later', start < now ? 'Earlier today' : 'Later tonight', e);
    else put(`3-${e.date}`, dayLabel(e.date), e);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, g]) => g);
}
