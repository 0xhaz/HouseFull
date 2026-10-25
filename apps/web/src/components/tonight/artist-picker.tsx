'use client';

import type { LikedArtist } from '@housefull/shared';
import { SearchIcon, XIcon } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { searchArtists } from '@/lib/client-api';
import { cn } from '@/lib/utils';

export const MAX_LIKES = 5;

/** Up to five artists the visitor likes, picked from Qloo search. `dark` sits on the hero. */
export function ArtistPicker({
  likes,
  onChange,
  tone = 'default',
}: {
  likes: LikedArtist[];
  onChange: (likes: LikedArtist[]) => void;
  tone?: 'default' | 'dark';
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LikedArtist[]>([]);
  const ids = { input: useId(), list: useId() };
  const full = likes.length >= MAX_LIKES;
  const dark = tone === 'dark';

  useEffect(() => {
    if (query.trim().length < 2) return setResults([]);
    const t = setTimeout(
      () =>
        searchArtists(query.trim()).then(
          (r) => setResults(r.filter((a) => !likes.some((l) => l.id === a.id)).slice(0, 6)),
          () => setResults([]),
        ),
      300,
    );
    return () => clearTimeout(t);
  }, [query, likes]);

  const add = (a: LikedArtist) => {
    onChange([...likes, a].slice(0, MAX_LIKES));
    setQuery('');
    setResults([]);
  };

  return (
    <div className="grid gap-2">
      <label htmlFor={ids.input} className={cn('text-sm font-medium', dark && 'text-white/90')}>
        Artists you like{' '}
        <span className={cn('font-normal', dark ? 'text-white/50' : 'text-muted-foreground')}>
          (optional, up to 5)
        </span>
      </label>
      <div
        className={cn(
          'relative flex flex-wrap items-center gap-1.5 rounded-xl border px-2.5 py-1.5 focus-within:ring-2',
          dark
            ? 'border-white/15 bg-white/5 focus-within:ring-white/30'
            : 'bg-background focus-within:ring-ring',
        )}
      >
        <SearchIcon
          className={cn('size-4 shrink-0', dark ? 'text-white/50' : 'text-muted-foreground')}
          aria-hidden
        />
        {likes.length > 0 && (
          <ul className="contents" aria-label="Artists you like">
            {likes.map((l) => (
              <li key={l.id}>
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full py-0.5 pr-1 pl-2.5 text-sm',
                    dark ? 'bg-white/15 text-white' : 'border bg-primary/5',
                  )}
                >
                  {l.name}
                  <button
                    type="button"
                    aria-label={`Remove ${l.name}`}
                    className={cn(
                      'grid size-5 place-items-center rounded-full',
                      dark ? 'hover:bg-white/20' : 'hover:bg-muted',
                    )}
                    onClick={() => onChange(likes.filter((x) => x.id !== l.id))}
                  >
                    <XIcon className="size-3" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
        <input
          id={ids.input}
          value={query}
          disabled={full}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            full
              ? 'That’s five: remove one to add another'
              : likes.length
                ? 'Add another'
                : 'Who do you love? e.g. Clairo, Khruangbin'
          }
          aria-controls={ids.list}
          aria-expanded={results.length > 0}
          role="combobox"
          autoComplete="off"
          className={cn(
            'h-8 min-w-40 flex-1 bg-transparent text-sm outline-none',
            dark ? 'text-white placeholder:text-white/40' : 'placeholder:text-muted-foreground',
          )}
        />
        {results.length > 0 && (
          <ul
            id={ids.list}
            aria-label="Matching artists"
            className="absolute top-full left-0 z-30 mt-1 w-full overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg"
          >
            {results.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => add(a)}
                >
                  {a.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
