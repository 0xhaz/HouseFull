'use client';

import { haversineKm } from '@housefull/geo';
import { SCENE_LABEL, type TonightEvent, VENUE_TYPE_LABEL } from '@housefull/shared';
import {
  BookmarkPlusIcon,
  CheckIcon,
  ExternalLinkIcon,
  MegaphoneIcon,
  NavigationIcon,
  TrainFrontIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type Match = 'liked' | 'top' | 'good' | 'some';
export const MATCH_LABEL: Record<Match, string> = {
  liked: 'You like them',
  top: 'Top match',
  good: 'Good match',
  some: 'Some overlap',
};

const SHOW_MS = 3 * 3_600_000;

export const startOf = (e: TonightEvent) =>
  e.startsAt ? Date.parse(e.startsAt) : Date.parse(`${e.date}T23:00:00Z`);
export const isOn = (e: TonightEvent, now: number) =>
  Boolean(e.startsAt) && startOf(e) <= now && now < startOf(e) + SHOW_MS;

/** "On now", "In 40 min", or the local start time in the city. */
export function whenLabel(e: TonightEvent, tz: string, now: number) {
  if (e.startsAt) {
    const start = startOf(e);
    const mins = Math.round((start - now) / 60_000);
    if (isOn(e, now)) return { text: 'On now', live: true };
    if (mins > 0 && mins < 180)
      return {
        text: mins < 60 ? `In ${mins} min` : `In ${Math.floor(mins / 60)} h ${mins % 60} min`,
        live: mins <= 60,
      };
  }
  return { text: timeOf(e, tz), live: false };
}

/** "8:00 PM", in the city's time zone. */
export function timeOf(e: TonightEvent, tz: string) {
  if (e.startsAt)
    return new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      minute: '2-digit',
    }).format(startOf(e));
  if (!e.time) return 'TBA';
  const [h, m] = e.time.split(':').map(Number);
  const hh = h ?? 0;
  return `${hh % 12 || 12}:${String(m ?? 0).padStart(2, '0')} ${hh < 12 ? 'AM' : 'PM'}`;
}

export function distanceKm(e: { lat?: number; lng?: number }, here?: { lat: number; lng: number }) {
  if (!here || e.lat === undefined || e.lng === undefined) return undefined;
  return haversineKm(here, { lat: e.lat, lng: e.lng });
}
export const fmtKm = (km: number) =>
  km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;

export function directionsUrl(p: { lat?: number; lng?: number }) {
  if (p.lat === undefined || p.lng === undefined) return undefined;
  return `https://www.google.com/maps/dir/?${new URLSearchParams({
    api: '1',
    destination: `${p.lat},${p.lng}`,
    travelmode: 'transit',
  })}`;
}

function LiveDot() {
  return (
    <span className="relative flex size-2" aria-hidden>
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-60" />
      <span className="relative inline-flex size-2 rounded-full bg-current" />
    </span>
  );
}

/** Poster card for the "Top picks" rail: image, time, match, artist. */
export function PosterCard({
  event: e,
  tz,
  now,
  match,
}: {
  event: TonightEvent;
  tz: string;
  now: number;
  match?: Match;
}) {
  const when = whenLabel(e, tz, now);
  const inner = (
    <>
      {e.image ? (
        // biome-ignore lint/performance/noImgElement: remote images from Ticketmaster's CDN
        <img
          src={e.image}
          alt=""
          loading="lazy"
          className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/70 via-fuchsia-700/60 to-zinc-900" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/10" />
      <div className="absolute inset-x-3 top-3 flex flex-wrap gap-1.5">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold backdrop-blur',
            when.live ? 'bg-primary text-primary-foreground' : 'bg-black/50',
          )}
        >
          {when.live && <LiveDot />}
          {when.text}
        </span>
        {(match === 'liked' || match === 'top') && (
          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-zinc-900">
            {MATCH_LABEL[match]}
          </span>
        )}
      </div>
      <div className="absolute inset-x-3 bottom-3">
        <p className="text-xs font-medium tracking-wide text-white/70 uppercase">
          {e.scene === 'other' ? VENUE_TYPE_LABEL[e.venueType] : SCENE_LABEL[e.scene]}
        </p>
        <p className="mt-0.5 line-clamp-2 text-xl leading-tight font-bold">{e.artist}</p>
        <p className="mt-1 truncate text-sm text-white/80">{e.venue}</p>
      </div>
    </>
  );
  const cls =
    'group relative block aspect-[4/5] overflow-hidden rounded-2xl bg-zinc-900 text-white shadow-sm focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none';
  return (
    <li className="w-56 shrink-0 snap-start sm:w-64">
      {e.url ? (
        <a href={e.url} target="_blank" rel="noopener noreferrer" className={cls}>
          {inner}
          <span className="sr-only">(tickets, opens Ticketmaster)</span>
        </a>
      ) : (
        <div className={cls}>{inner}</div>
      )}
    </li>
  );
}

/** One show in the lineup: time, image, who, where, why it fits, and how to go. */
export function LineupRow({
  event: e,
  tz,
  now,
  match,
  here,
  going,
  onGoing,
}: {
  event: TonightEvent;
  tz: string;
  now: number;
  match?: Match;
  here?: { lat: number; lng: number };
  /** Saved to "Your nights"; after the show it asks for a rating. */
  going?: boolean;
  onGoing?: () => void;
}) {
  const when = whenLabel(e, tz, now);
  const km = distanceKm(e, here);
  const directions = directionsUrl(e);
  const time = timeOf(e, tz);
  return (
    <li className="grid grid-cols-[4.25rem_minmax(0,1fr)] gap-3 border-b py-4 last:border-b-0 sm:grid-cols-[4.75rem_5.5rem_minmax(0,1fr)]">
      <div className="pt-0.5">
        <p className="text-lg leading-none font-bold tabular-nums">
          {time.replace(/ (AM|PM)$/, '')}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{/(AM|PM)$/.exec(time)?.[0]}</p>
        {(when.live || when.text.startsWith('In ')) && (
          <p
            className={cn(
              'mt-1.5 inline-flex items-center gap-1 text-xs font-semibold',
              when.live ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            {when.live && <LiveDot />}
            {when.text}
          </p>
        )}
      </div>
      <div className="relative hidden aspect-square overflow-hidden rounded-xl bg-muted sm:block">
        {e.image && (
          // biome-ignore lint/performance/noImgElement: remote images from Ticketmaster's CDN
          <img src={e.image} alt="" loading="lazy" className="size-full object-cover" />
        )}
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          {e.scene !== 'other' && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {SCENE_LABEL[e.scene]}
            </span>
          )}
          {match && (
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                match === 'liked' || match === 'top'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-primary/10 text-primary',
              )}
            >
              {MATCH_LABEL[match]}
            </span>
          )}
          {e.status === 'rescheduled' && (
            <span className="rounded-full border px-2 py-0.5 text-[11px]">Rescheduled</span>
          )}
        </div>
        <p className="mt-1 text-lg leading-snug font-semibold">{e.artist}</p>
        {e.name !== e.artist && <p className="truncate text-sm text-muted-foreground">{e.name}</p>}
        <p className="mt-0.5 text-sm">
          {e.venue}
          <span className="text-muted-foreground">
            {' '}
            · {VENUE_TYPE_LABEL[e.venueType]}
            {km !== undefined && ` · ${fmtKm(km)}`}
            {e.priceFrom &&
              ` · from ${new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: e.priceFrom.currency,
                maximumFractionDigits: 0,
              }).format(e.priceFrom.amount)}`}
          </span>
        </p>
        {e.campaign && (
          <p className="mt-2 flex gap-1.5 rounded-lg bg-primary/5 px-2.5 py-1.5 text-sm">
            <MegaphoneIcon className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
            <span>
              <span className="font-medium">Promoted.</span> The promoter is looking for fans of{' '}
              {e.campaign.becauseYouLike.join(', ')}, like you.
            </span>
          </p>
        )}
        {e.transit?.length ? (
          <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
            <TrainFrontIcon className="size-3" aria-hidden />
            Subway alert nearby: {[...new Set(e.transit.flatMap((t) => t.routes))].join(' ')} train
            {new Set(e.transit.flatMap((t) => t.routes)).size > 1 ? 's' : ''}
          </p>
        ) : null}
        <div className="mt-2.5 flex flex-wrap gap-2">
          {onGoing && (
            <Button
              size="sm"
              variant={going ? 'secondary' : 'outline'}
              aria-pressed={going}
              onClick={onGoing}
            >
              {going ? <CheckIcon /> : <BookmarkPlusIcon />}
              {going ? 'Going' : 'I’m going'}
            </Button>
          )}
          {e.url && (
            <Button asChild size="sm">
              <a href={e.url} target="_blank" rel="noopener noreferrer">
                Tickets
                <ExternalLinkIcon />
              </a>
            </Button>
          )}
          {directions && (
            <Button asChild size="sm" variant="outline">
              <a href={directions} target="_blank" rel="noopener noreferrer">
                <NavigationIcon />
                Directions
              </a>
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}
