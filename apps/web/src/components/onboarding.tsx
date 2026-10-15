'use client';

import { useAuth, useOrganization, useOrganizationList } from '@clerk/nextjs';
import {
  CITY_META,
  type City,
  type CreateWorkspace,
  PERSONA_META,
  type Persona,
} from '@housefull/shared';
import { LoaderIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useId, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PERSONA_ICONS } from '@/components/workspace/persona-icons';
import { saveWorkspace, searchVenues, type Venue } from '@/lib/client-api';
import { cn } from '@/lib/utils';

const CITIES = Object.keys(CITY_META) as City[];

/** Step 1: an organization to hold the workspace. Step 2: who it's for, and the details. */
export function Onboarding() {
  const { organization, membership, isLoaded } = useOrganization();
  if (!isLoaded) return <LoaderIcon className="size-5 animate-spin text-muted-foreground" />;
  if (!organization) return <ChooseOrganization />;
  if (membership?.role !== 'org:admin')
    return (
      <Card>
        <CardHeader>
          <CardTitle>{organization.name} isn&apos;t set up yet</CardTitle>
          <CardDescription>
            Ask an admin of this organization to choose its workspace type, or switch to another
            organization from the menu at the top.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  return <SetUpWorkspace orgName={organization.name} />;
}

function ChooseOrganization() {
  const { isLoaded, createOrganization, setActive, userMemberships } = useOrganizationList({
    userMemberships: true,
  });
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const nameId = useId();

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!isLoaded || name.trim().length < 2) return;
    setBusy(true);
    try {
      // A readable slug for the workspace URL; Clerk's own adds a long number.
      const base =
        name
          .trim()
          .toLowerCase()
          .normalize('NFKD')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 40) || 'workspace';
      const org = await createOrganization({ name: name.trim(), slug: base }).catch(() =>
        // Taken: add a short suffix.
        createOrganization({
          name: name.trim(),
          slug: `${base}-${Math.random().toString(36).slice(2, 6)}`,
        }),
      );
      await setActive({ organization: org.id });
    } catch (err) {
      toast.error((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Name your workspace</CardTitle>
        <CardDescription>
          A workspace is shared with your team: invite colleagues once it&apos;s set up.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        <form onSubmit={create} className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="grid flex-1 gap-1.5">
            <Label htmlFor={nameId}>Company or team name</Label>
            <Input
              id={nameId}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Night Shift Presents"
              autoFocus
            />
          </div>
          <Button type="submit" disabled={busy || name.trim().length < 2}>
            {busy && <LoaderIcon className="size-3.5 animate-spin" />}
            Create workspace
          </Button>
        </form>
        {(userMemberships.data?.length ?? 0) > 0 && (
          <div className="grid gap-2">
            <p className="text-sm text-muted-foreground">Or open one you belong to:</p>
            <div className="flex flex-wrap gap-2">
              {userMemberships.data?.map((m) => (
                <Button
                  key={m.id}
                  variant="outline"
                  size="sm"
                  onClick={() => setActive?.({ organization: m.organization.id })}
                >
                  {m.organization.name}
                </Button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SetUpWorkspace({ orgName }: { orgName: string }) {
  const router = useRouter();
  const { getToken } = useAuth();
  const [persona, setPersona] = useState<Persona>('promoter');
  const [cities, setCities] = useState<City[]>(['nyc']);
  const [artist, setArtist] = useState('');
  const [venueCity, setVenueCity] = useState<City>('nyc');
  const [venue, setVenue] = useState<Venue | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Venue[]>([]);
  const [busy, setBusy] = useState(false);
  const ids = { artist: useId(), venue: useId(), list: useId() };

  useEffect(() => {
    if (venue || query.trim().length < 2) return setResults([]);
    const t = setTimeout(
      () => searchVenues(query, venueCity).then(setResults, () => setResults([])),
      300,
    );
    return () => clearTimeout(t);
  }, [query, venueCity, venue]);

  const profile: CreateWorkspace['profile'] | null =
    persona === 'promoter'
      ? cities.length
        ? { cities }
        : null
      : persona === 'artist'
        ? artist.trim()
          ? { artist: artist.trim() }
          : null
        : venue
          ? { venue: { name: venue.name, lat: venue.lat, lng: venue.lng, city: venueCity } }
          : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setBusy(true);
    try {
      // Skip the cache: the token must carry the organization we just activated.
      const ws = await saveWorkspace({ persona, profile }, await getToken({ skipCache: true }));
      router.push(`/w/${ws.slug}`);
    } catch (err) {
      toast.error((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-6">
      <fieldset className="grid gap-3">
        <legend className="mb-3 text-lg font-semibold">Who is {orgName} for?</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {(Object.keys(PERSONA_META) as Persona[]).map((p) => {
            const Icon = PERSONA_ICONS[p];
            return (
              <label
                key={p}
                className={cn(
                  'flex cursor-pointer flex-col gap-2 rounded-xl border p-4 transition-colors has-focus-visible:ring-2 has-focus-visible:ring-ring',
                  persona === p ? 'border-primary bg-primary/5' : 'hover:bg-muted/50',
                )}
              >
                <input
                  type="radio"
                  name="persona"
                  value={p}
                  checked={persona === p}
                  onChange={() => setPersona(p)}
                  className="sr-only"
                />
                <Icon className="size-5 text-primary" aria-hidden />
                <span className="font-medium">{PERSONA_META[p].label}</span>
                <span className="text-sm text-muted-foreground">{PERSONA_META[p].blurb}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {persona === 'promoter' && (
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-medium">Cities you book</legend>
          <div className="flex flex-wrap gap-2">
            {CITIES.map((c) => (
              <label
                key={c}
                className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm"
              >
                <input
                  type="checkbox"
                  checked={cities.includes(c)}
                  onChange={(e) =>
                    setCities((cur) =>
                      e.target.checked ? [...cur, c] : cur.filter((x) => x !== c),
                    )
                  }
                />
                {CITY_META[c].name}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {persona === 'artist' && (
        <div className="grid max-w-md gap-1.5">
          <Label htmlFor={ids.artist}>Artist</Label>
          <Input
            id={ids.artist}
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            placeholder="Men I Trust"
          />
        </div>
      )}

      {persona === 'venue' && (
        <div className="grid max-w-xl gap-3">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Venue city">
            {CITIES.map((c) => (
              <Button
                key={c}
                type="button"
                size="sm"
                role="radio"
                aria-checked={venueCity === c}
                variant={venueCity === c ? 'default' : 'outline'}
                onClick={() => {
                  setVenueCity(c);
                  setVenue(null);
                  setQuery('');
                }}
              >
                {CITY_META[c].name}
              </Button>
            ))}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={ids.venue}>Your venue</Label>
            <Input
              id={ids.venue}
              value={query}
              onChange={(e) => {
                setVenue(null);
                setQuery(e.target.value);
              }}
              placeholder="Search venues"
              aria-controls={ids.list}
              autoComplete="off"
            />
            {results.length > 0 && (
              <ul id={ids.list} aria-label="Matching venues" className="rounded-md border">
                {results.slice(0, 6).map((v) => (
                  <li key={v.entityId}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                      onClick={() => {
                        setVenue(v);
                        setQuery(v.name);
                        setResults([]);
                      }}
                    >
                      {v.name}
                      {v.address && (
                        <span className="block text-xs text-muted-foreground">{v.address}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <div>
        <Button type="submit" disabled={busy || !profile}>
          {busy && <LoaderIcon className="size-3.5 animate-spin" />}
          Open the dashboard
        </Button>
      </div>
    </form>
  );
}
