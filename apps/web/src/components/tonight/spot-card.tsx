'use client';

import { SPOT_KIND_LABEL, type TonightSpot } from '@housefull/shared';
import { NavigationIcon, StarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { directionsUrl, distanceKm, fmtKm } from './event-card';

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};
const ampm = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  const hh = h ?? 0;
  return `${hh % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${hh < 12 || hh === 24 ? 'AM' : 'PM'}`;
};

/** "Open now · until 2 AM", "Opens 6:30 PM", "Closed tonight", from the listing's hours. */
export function openState(hours: string | undefined, nowHHMM: string) {
  if (!hours) return { text: 'Hours not listed', open: undefined };
  if (hours === 'closed') return { text: 'Closed tonight', open: false };
  const now = minutes(nowHHMM);
  for (const range of hours.split(', ')) {
    const [a, b] = range.split('–') as [string, string];
    const open = minutes(a);
    let close = minutes(b);
    if (close <= open) close += 24 * 60;
    if ((now >= open && now < close) || (now + 24 * 60 >= open && now + 24 * 60 < close))
      return { text: `Open now · until ${ampm(b)}`, open: true };
    if (now < open) return { text: `Opens ${ampm(a)}`, open: false };
  }
  return { text: 'Closed for the night', open: false };
}

export function SpotCard({
  spot: s,
  nowHHMM,
  here,
}: {
  spot: TonightSpot;
  nowHHMM: string;
  here?: { lat: number; lng: number };
}) {
  const state = openState(s.hours, nowHHMM);
  const km = distanceKm(s, here);
  const directions = directionsUrl(s);
  return (
    <li className="w-64 shrink-0 snap-start overflow-hidden rounded-2xl border bg-card sm:w-72">
      <div className="relative aspect-[16/10] bg-muted">
        {s.image && (
          // biome-ignore lint/performance/noImgElement: remote images from Qloo's CDN
          <img src={s.image} alt="" loading="lazy" className="size-full object-cover" />
        )}
        <span className="absolute top-2.5 left-2.5 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
          {SPOT_KIND_LABEL[s.kind]}
        </span>
        {s.taste !== undefined && s.taste >= 66 && (
          <span className="absolute bottom-2.5 left-2.5 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-zinc-900">
            Your kind of place
          </span>
        )}
      </div>
      <div className="grid gap-1 p-3.5">
        <div className="flex items-start justify-between gap-2">
          <p className="leading-snug font-semibold">{s.name}</p>
          {s.rating !== undefined && (
            <span className="inline-flex shrink-0 items-center gap-0.5 text-sm tabular-nums">
              <StarIcon className="size-3.5 fill-amber-400 text-amber-400" aria-hidden />
              {s.rating.toFixed(1)}
              <span className="sr-only"> out of 5</span>
            </span>
          )}
        </div>
        <p
          className={cn(
            'text-sm font-medium',
            state.open ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
          )}
        >
          {state.text}
        </p>
        {s.address && (
          <p className="truncate text-sm text-muted-foreground">
            {s.address.replace(
              /,? (New York|Brooklyn|New Orleans|Los Angeles),? [A-Z]{2} \d{5}$/,
              '',
            )}
            {km !== undefined && ` · ${fmtKm(km)}`}
          </p>
        )}
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-sm">
          {directions && (
            <a
              href={directions}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
            >
              <NavigationIcon className="size-3.5" aria-hidden />
              Directions
            </a>
          )}
          {s.website && (
            <a
              href={s.website}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              Who’s playing
            </a>
          )}
        </div>
      </div>
    </li>
  );
}
