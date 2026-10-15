'use client';

import type { LikedArtist } from '@housefull/shared';
import { XIcon } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { Input } from '@/components/ui/input';
import { searchArtists } from '@/lib/client-api';

export const MAX_LIKES = 5;

/** Up to five artists the visitor likes, picked from Qloo search. */
export function ArtistPicker({
  likes,
  onChange,
}: {
  likes: LikedArtist[];
  onChange: (likes: LikedArtist[]) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LikedArtist[]>([]);
  const ids = { input: useId(), list: useId() };
  const full = likes.length >= MAX_LIKES;

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
      <label htmlFor={ids.input} className="text-sm font-medium">
        Artists you like{' '}
        <span className="font-normal text-muted-foreground">(optional, up to 5)</span>
      </label>
      {likes.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Artists you like">
          {likes.map((l) => (
            <li key={l.id}>
              <span className="inline-flex items-center gap-1 rounded-full border bg-primary/5 py-0.5 pr-1 pl-2.5 text-sm">
                {l.name}
                <button
                  type="button"
                  aria-label={`Remove ${l.name}`}
                  className="grid size-5 place-items-center rounded-full hover:bg-muted"
                  onClick={() => onChange(likes.filter((x) => x.id !== l.id))}
                >
                  <XIcon className="size-3" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="relative">
        <Input
          id={ids.input}
          value={query}
          disabled={full}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={full ? 'That’s five: remove one to add another' : 'Search for an artist'}
          aria-controls={ids.list}
          aria-expanded={results.length > 0}
          role="combobox"
          autoComplete="off"
        />
        {results.length > 0 && (
          <ul
            id={ids.list}
            aria-label="Matching artists"
            className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border bg-popover shadow-md"
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
