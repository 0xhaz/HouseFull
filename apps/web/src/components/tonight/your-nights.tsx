'use client';

import { type LikedArtist, SURVEY_TAGS } from '@housefull/shared';
import { BookHeartIcon, LoaderIcon, StarIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { postTonightRating, searchArtists } from '@/lib/client-api';
import { cn } from '@/lib/utils';
import { hasStarted, type Night } from './nights';

const dayFmt = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

/**
 * The fan's diary: shows to rate, shows coming up, and shows rated. Rating a show 4+ makes its
 * artist a taste signal for Tonight's picks.
 */
export function YourNights({
  nights,
  likes,
  onRate,
  onForget,
}: {
  nights: Night[];
  likes: LikedArtist[];
  onRate: (eventId: string, patch: Partial<Night>) => void;
  onForget: (eventId: string) => void;
}) {
  const [rating, setRating] = useState<Night | null>(null);
  const now = Date.now();
  const toRate = nights.filter((n) => n.rating === undefined && hasStarted(n, now));
  const coming = nights.filter((n) => n.rating === undefined && !hasStarted(n, now));
  const rated = nights.filter((n) => n.rating !== undefined).reverse();
  if (!nights.length) return null;

  return (
    <section aria-labelledby="nights" className="grid gap-3 rounded-2xl border bg-card p-4 sm:p-5">
      <h2 id="nights" className="flex items-center gap-2 text-xl font-bold tracking-tight">
        <BookHeartIcon className="size-5 text-primary" aria-hidden />
        Your nights
      </h2>
      {toRate.map((n) => (
        <div
          key={n.eventId}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-primary/5 p-3 ring-1 ring-primary/20"
        >
          <p className="text-sm">
            <span className="font-semibold">How was {n.artist}?</span>{' '}
            <span className="text-muted-foreground">
              {n.venue} · {dayFmt.format(new Date(`${n.date}T00:00:00Z`))}
            </span>
          </p>
          <Button size="sm" onClick={() => setRating(n)}>
            Rate it
          </Button>
        </div>
      ))}
      {coming.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Shows you’re going to">
          {coming.map((n) => (
            <li
              key={n.eventId}
              className="inline-flex items-center gap-1.5 rounded-full border py-1 pr-1 pl-3 text-sm"
            >
              Going: {n.artist}
              <span className="text-muted-foreground">
                · {dayFmt.format(new Date(`${n.date}T00:00:00Z`))}
              </span>
              <button
                type="button"
                aria-label={`Not going to ${n.artist}`}
                onClick={() => onForget(n.eventId)}
                className="grid size-5 place-items-center rounded-full hover:bg-muted"
              >
                <XIcon className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {rated.length > 0 && (
        <ul className="grid gap-1.5" aria-label="Shows you rated">
          {rated.slice(0, 6).map((n) => (
            <li key={n.eventId} className="flex flex-wrap items-center gap-x-2 text-sm">
              <span className="sr-only">{n.rating} out of 5:</span>
              <span className="inline-flex" aria-hidden>
                {[1, 2, 3, 4, 5].map((s) => (
                  <StarIcon
                    key={s}
                    aria-hidden
                    className={cn(
                      'size-3.5',
                      s <= (n.rating ?? 0)
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-muted-foreground/30',
                    )}
                  />
                ))}
              </span>
              <span className="font-medium">{n.artist}</span>
              <span className="text-muted-foreground">
                {n.venue} · {dayFmt.format(new Date(`${n.date}T00:00:00Z`))}
                {n.loved ? ' · now shaping your picks' : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">Saved on this device only.</p>
      {rating && (
        <RateDialog
          night={rating}
          likes={likes}
          onClose={() => setRating(null)}
          onSave={(patch) => {
            onRate(rating.eventId, patch);
            setRating(null);
          }}
        />
      )}
    </section>
  );
}

function RateDialog({
  night,
  likes,
  onClose,
  onSave,
}: {
  night: Night;
  likes: LikedArtist[];
  onClose: () => void;
  onSave: (patch: Partial<Night>) => void;
}) {
  const [stars, setStars] = useState(0);
  const [again, setAgain] = useState<boolean | undefined>();
  const [tags, setTags] = useState<string[]>([]);
  const [share, setShare] = useState(false);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!stars) return;
    setBusy(true);
    let loved: LikedArtist | undefined;
    if (stars >= 4) {
      // Loved it: the artist becomes a taste signal (exact name match on Qloo only).
      const hits = await searchArtists(night.artist).catch(() => []);
      loved = hits.find((h) => h.name.toLowerCase() === night.artist.toLowerCase());
    }
    let shared = false;
    if (share) {
      try {
        const r = await postTonightRating({
          artist: night.artist,
          venue: night.venue,
          date: night.date,
          rating: stars,
          wouldReturn: again,
          tags: tags as never,
          likes: [...likes.map((l) => l.id), ...(loved ? [loved.id] : [])],
        });
        shared = r.shared;
        toast(
          r.shared
            ? 'Thanks! Shared anonymously with the show’s organizer.'
            : 'Saved. This show wasn’t planned on HouseFull, so nothing was shared.',
        );
      } catch (e) {
        toast.error((e as Error).message);
      }
    }
    onSave({
      rating: stars,
      again,
      tags,
      loved,
      shared,
      ratedAt: new Date().toISOString(),
    });
    setBusy(false);
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>How was {night.artist}?</DialogTitle>
          <DialogDescription>{night.venue}</DialogDescription>
        </DialogHeader>
        <fieldset>
          <legend className="sr-only">Your rating</legend>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <label
                key={n}
                className="cursor-pointer rounded-lg p-1 has-focus-visible:ring-2 has-focus-visible:ring-ring"
              >
                <input
                  type="radio"
                  name="night-rating"
                  value={n}
                  checked={stars === n}
                  onChange={() => setStars(n)}
                  className="sr-only"
                />
                <span className="sr-only">
                  {n} star{n > 1 ? 's' : ''}
                </span>
                <StarIcon
                  aria-hidden
                  className={cn(
                    'size-9',
                    n <= stars ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40',
                  )}
                />
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-wrap gap-2">
          {[
            [true, 'Would go again'],
            [false, 'Once was enough'],
          ].map(([v, label]) => (
            <button
              key={String(v)}
              type="button"
              aria-pressed={again === v}
              onClick={() => setAgain(again === v ? undefined : (v as boolean))}
              className={cn(
                'rounded-full border px-3 py-1.5 text-sm',
                again === v
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'hover:bg-muted',
              )}
            >
              {label as string}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {SURVEY_TAGS.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={tags.includes(t)}
              onClick={() => setTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t])}
              className={cn(
                'rounded-full border px-3 py-1 text-xs',
                tags.includes(t)
                  ? 'border-foreground bg-foreground text-background'
                  : 'hover:bg-muted',
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={share}
            onChange={(e) => setShare(e.target.checked)}
            className="mt-0.5 size-4 accent-[var(--primary)]"
          />
          <span>
            Share anonymously with the show’s organizer
            <span className="block text-xs text-muted-foreground">
              Only if they planned it on HouseFull. No name, email or location is sent.
            </span>
          </span>
        </label>
        <DialogFooter>
          <Button onClick={save} disabled={!stars || busy}>
            {busy && <LoaderIcon className="animate-spin" />}
            Save rating
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
