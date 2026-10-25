'use client';

import type { LikedArtist, TonightEvent } from '@housefull/shared';
import { useCallback, useEffect, useState } from 'react';

/** A show the fan saved ("I'm going") and, after it, rated. Kept on this device only. */
export type Night = {
  eventId: string;
  artist: string;
  venue: string;
  date: string;
  startsAt?: string;
  url?: string;
  rating?: number;
  again?: boolean;
  tags?: string[];
  /** Qloo id of the artist once rated 4+: it becomes a taste signal for picks. */
  loved?: LikedArtist;
  shared?: boolean;
  ratedAt?: string;
};

const KEY = 'housefull:nights';
const MAX = 100;

function read(): Night[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function write(nights: Night[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(nights.slice(-MAX)));
  } catch {
    // storage unavailable: the diary lasts for this visit only
  }
}

/** Started (or played) shows can be rated. */
export const hasStarted = (n: Night, now = Date.now()) =>
  n.startsAt ? Date.parse(n.startsAt) <= now : n.date < new Date(now).toISOString().slice(0, 10);

export function useNights() {
  const [nights, setNights] = useState<Night[]>([]);
  useEffect(() => setNights(read()), []);

  const save = useCallback((next: Night[]) => {
    setNights(next);
    write(next);
  }, []);

  const toggleGoing = useCallback(
    (e: TonightEvent) => {
      const all = read();
      const exists = all.some((n) => n.eventId === e.id);
      save(
        exists
          ? all.filter((n) => n.eventId !== e.id || n.rating !== undefined)
          : [
              ...all,
              {
                eventId: e.id,
                artist: e.artist,
                venue: e.venue,
                date: e.date,
                startsAt: e.startsAt,
                url: e.url,
              },
            ],
      );
    },
    [save],
  );

  const rate = useCallback(
    (eventId: string, patch: Partial<Night>) => {
      save(read().map((n) => (n.eventId === eventId ? { ...n, ...patch } : n)));
    },
    [save],
  );

  const forget = useCallback(
    (eventId: string) => save(read().filter((n) => n.eventId !== eventId)),
    [save],
  );

  return { nights, toggleGoing, rate, forget };
}
