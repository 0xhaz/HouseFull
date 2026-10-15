'use client';

import { haversineKm } from '@housefull/geo';
import type { TonightEvent } from '@housefull/shared';
import {
  ExternalLinkIcon,
  MapPinIcon,
  MegaphoneIcon,
  NavigationIcon,
  TrainFrontIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type Match = 'liked' | 'top' | 'good' | 'some';
export const MATCH_LABEL: Record<Match, string> = {
  liked: 'An artist you like',
  top: 'Top match for your taste',
  good: 'Good match',
  some: 'Some overlap',
};

const SHOW_MS = 3 * 3_600_000;

/** "On now", "Starts in 40 min", or the local start time in the city. */
export function whenLabel(e: TonightEvent, tz: string, now: number) {
  if (e.startsAt) {
    const start = Date.parse(e.startsAt);
    const mins = Math.round((start - now) / 60_000);
    if (start <= now && now < start + SHOW_MS) return { text: 'On now', live: true };
    if (mins > 0 && mins < 180)
      return {
        text:
          mins < 60
            ? `Starts in ${mins} min`
            : `Starts in ${Math.floor(mins / 60)} h ${mins % 60} min`,
        live: mins <= 60,
      };
    const day = (t: number) => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(t);
    const time = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      minute: '2-digit',
    }).format(start);
    const label =
      day(start) === day(now)
        ? start < now
          ? 'Earlier today'
          : 'Tonight'
        : day(start) === day(now + 86_400_000)
          ? 'Tomorrow'
          : new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(start);
    return { text: `${label} ${time}`, live: false };
  }
  const day = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' }).format(
    new Date(`${e.date}T00:00:00Z`),
  );
  return { text: e.time ? `${day} ${e.time.slice(0, 5)}` : day, live: false };
}

export function distanceKm(e: TonightEvent, here?: { lat: number; lng: number }) {
  if (!here || e.lat === undefined || e.lng === undefined) return undefined;
  return haversineKm(here, { lat: e.lat, lng: e.lng });
}

export function EventCard({
  event: e,
  tz,
  now,
  match,
  here,
}: {
  event: TonightEvent;
  tz: string;
  now: number;
  match?: Match;
  here?: { lat: number; lng: number };
}) {
  const when = whenLabel(e, tz, now);
  const km = distanceKm(e, here);
  const directions =
    e.lat !== undefined && e.lng !== undefined
      ? `https://www.google.com/maps/dir/?${new URLSearchParams({
          api: '1',
          destination: `${e.lat},${e.lng}`,
          travelmode: 'transit',
        })}`
      : undefined;
  return (
    <li className="grid grid-cols-[minmax(0,1fr)] gap-3 rounded-xl border bg-card p-4 sm:grid-cols-[7rem_minmax(0,1fr)]">
      <div className="relative hidden aspect-video overflow-hidden rounded-lg bg-muted sm:block sm:aspect-square">
        {e.image && (
          // Ticketmaster CDN images; plain img keeps them out of the Next image optimizer.
          // biome-ignore lint/performance/noImgElement: remote images from Ticketmaster's CDN
          <img src={e.image} alt="" loading="lazy" className="size-full object-cover" />
        )}
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 text-sm font-medium',
              when.live ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            {when.live && (
              <span className="relative flex size-2" aria-hidden>
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-primary" />
              </span>
            )}
            {when.text}
          </span>
          {match && (
            <Badge variant={match === 'liked' || match === 'top' ? 'default' : 'secondary'}>
              {MATCH_LABEL[match]}
            </Badge>
          )}
          {e.status === 'rescheduled' && <Badge variant="outline">Rescheduled</Badge>}
        </div>
        <p className="mt-1 text-lg font-semibold leading-snug">{e.artist}</p>
        {e.name !== e.artist && <p className="truncate text-sm text-muted-foreground">{e.name}</p>}
        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-sm">
          <MapPinIcon className="size-3.5 text-muted-foreground" aria-hidden />
          {e.venue}
          {km !== undefined && (
            <span className="text-muted-foreground">
              · {km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`} away
            </span>
          )}
          {e.priceFrom && (
            <span className="text-muted-foreground">
              · from{' '}
              {new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: e.priceFrom.currency,
                maximumFractionDigits: 0,
              }).format(e.priceFrom.amount)}
            </span>
          )}
        </p>
        {e.genres.length > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">{e.genres.join(' · ')}</p>
        )}
        {e.campaign && (
          <p className="mt-2 flex gap-1.5 rounded-md bg-primary/5 px-2.5 py-1.5 text-sm">
            <MegaphoneIcon className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
            <span>
              <span className="font-medium">Promoted.</span> The promoter is looking for fans of{' '}
              {e.campaign.becauseYouLike.join(', ')}, like you.
            </span>
          </p>
        )}
        {e.transit?.map((t) => (
          <p
            key={t.header}
            className="mt-2 flex gap-1.5 text-sm text-amber-700 dark:text-amber-400"
          >
            <TrainFrontIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              <span className="font-medium">
                Subway alert, {t.routes.join(' ')} train{t.routes.length > 1 ? 's' : ''}:
              </span>{' '}
              {t.header} <span className="text-muted-foreground">(may not affect your stop)</span>
            </span>
          </p>
        ))}
        <div className="mt-3 flex flex-wrap gap-2">
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
