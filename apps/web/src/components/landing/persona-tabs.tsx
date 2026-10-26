'use client';

import { CITY_META, type WorkspaceOverview } from '@housefull/shared';
import {
  ArrowRightIcon,
  BuildingIcon,
  CheckIcon,
  MailIcon,
  MegaphoneIcon,
  MicVocalIcon,
  MusicIcon,
  StarIcon,
} from 'lucide-react';
import Link from 'next/link';
import { type ReactNode, useState } from 'react';
import type { PersonaPreviews } from '@/lib/showcase';
import { cn } from '@/lib/utils';

type Key = 'promoter' | 'venue' | 'artist' | 'fan';

const TABS: Array<{
  key: Key;
  label: string;
  icon: typeof MegaphoneIcon;
  headline: string;
  points: string[];
  href: string;
  cta: string;
}> = [
  {
    key: 'promoter',
    label: 'Promoters',
    icon: MegaphoneIcon,
    headline: 'Sell out the shows you’ve booked',
    points: [
      'Which show needs help, today',
      'Ads per audience, ready to export',
      'Re-plan from real results',
    ],
    href: '/w/demo-promoter',
    cta: 'Open the promoter demo',
  },
  {
    key: 'venue',
    label: 'Venues',
    icon: BuildingIcon,
    headline: 'Know your room, fill the dates between',
    points: [
      'Your on-sale calendar, one click to a plan',
      'Who your room draws',
      'Drafted emails to nearby bars',
    ],
    href: '/w/demo-venue',
    cta: 'Open the venue demo',
  },
  {
    key: 'artist',
    label: 'Artist teams',
    icon: MicVocalIcon,
    headline: 'One act, every city on the tour',
    points: [
      'New fans city by city',
      'Taste that carries across markets',
      'Support acts and in-stores to pitch',
    ],
    href: '/w/demo-artist',
    cta: 'Open the artist demo',
  },
  {
    key: 'fan',
    label: 'Fans',
    icon: MusicIcon,
    headline: 'What’s on tonight, picked for you',
    points: [
      'Matched to artists you love',
      'Jazz clubs and pubs open now',
      'Near you, with a live countdown',
    ],
    href: '/tonight',
    cta: 'See what’s on tonight',
  },
];

/** One tab per persona: three short promises and a live preview of their screen. */
export function PersonaTabs({ previews }: { previews: PersonaPreviews }) {
  const [tab, setTab] = useState<Key>('promoter');
  const t = TABS.find((x) => x.key === tab) ?? TABS[0];
  return (
    <div className="grid gap-6">
      <div role="tablist" aria-label="Who it’s for" className="flex flex-wrap gap-2">
        {TABS.map((x) => (
          <button
            key={x.key}
            type="button"
            role="tab"
            aria-selected={tab === x.key}
            onClick={() => setTab(x.key)}
            className={cn(
              'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors',
              tab === x.key ? 'border-foreground bg-foreground text-background' : 'hover:bg-muted',
            )}
          >
            <x.icon className="size-4" aria-hidden />
            {x.label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        key={tab}
        className="grid animate-[rise_.4s_ease-out] items-center gap-8 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]"
      >
        <div>
          <h3 className="text-2xl font-extrabold tracking-tight text-balance sm:text-3xl">
            {t.headline}
          </h3>
          <ul className="mt-5 grid gap-3">
            {t.points.map((p) => (
              <li key={p} className="flex items-center gap-3 text-base">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <CheckIcon className="size-3.5" aria-hidden />
                </span>
                {p}
              </li>
            ))}
          </ul>
          <Link
            href={t.href}
            className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90"
          >
            {t.cta}
            <ArrowRightIcon className="size-4" />
          </Link>
        </div>
        <BrowserFrame url={t.href}>
          {tab === 'promoter' && <PromoterPreview data={previews.promoter} />}
          {tab === 'venue' && <VenuePreview data={previews.venue} />}
          {tab === 'artist' && <ArtistPreview data={previews.artist} />}
          {tab === 'fan' && <FanPreview />}
        </BrowserFrame>
      </div>
    </div>
  );
}

function BrowserFrame({ url, children }: { url: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-2xl shadow-black/10">
      <div className="flex items-center gap-2 border-b bg-muted/60 px-4 py-2.5">
        <span className="size-2.5 rounded-full bg-red-400" />
        <span className="size-2.5 rounded-full bg-amber-400" />
        <span className="size-2.5 rounded-full bg-emerald-400" />
        <span className="ml-3 truncate rounded-md bg-background px-3 py-0.5 text-xs text-muted-foreground">
          housefull · {url}
        </span>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
}

const Tile = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="rounded-xl border p-3">
    <p className="text-[11px] text-muted-foreground">{label}</p>
    <p className="text-xl font-extrabold tabular-nums">{value}</p>
  </div>
);

const daysTo = (iso: string) =>
  Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.now()) / 86_400_000);

function PromoterPreview({ data }: { data?: WorkspaceOverview }) {
  const runs = data?.runs ?? [];
  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-3 gap-2">
        <Tile label="Shows on sale" value={runs.length || '—'} />
        <Tile label="Re-planned" value={runs.filter((r) => r.version > 1).length} />
        <Tile label="New audiences" value={runs.reduce((n, r) => n + r.segments.length, 0)} />
      </div>
      <ul className="grid gap-2">
        {runs.slice(0, 3).map((r) => (
          <li
            key={r.id}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border p-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {r.show.artist}{' '}
                <span className="font-normal text-muted-foreground">
                  · {CITY_META[r.show.city].name}
                </span>
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="h-1.5 w-28 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-primary"
                    style={{ width: `${r.show.soldPct ?? 0}%` }}
                  />
                </span>
                <span className="text-xs text-muted-foreground">{r.show.soldPct ?? '—'}% sold</span>
              </div>
            </div>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">
              {daysTo(r.show.date)} days{r.version > 1 ? ' · v2' : ''}
            </span>
          </li>
        ))}
        {!runs.length && <li className="text-sm text-muted-foreground">Demo shows load here.</li>}
      </ul>
    </div>
  );
}

function VenuePreview({ data }: { data?: WorkspaceOverview }) {
  const venue = data?.workspace.profile.venue;
  const partners = [
    ...new Set((data?.runs ?? []).flatMap((r) => r.partners.map((p) => p.name))),
  ].slice(0, 3);
  const fans = [
    ...new Set((data?.runs ?? []).flatMap((r) => r.segments.flatMap((s) => s.fansOf))),
  ].slice(0, 6);
  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-2">
        <Tile label="Room" value={venue?.name ?? '—'} />
        <Tile label="Capacity" value={venue?.capacity?.toLocaleString('en-US') ?? '—'} />
      </div>
      <div className="rounded-xl border p-3">
        <p className="text-xs font-semibold">Who your room draws</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {fans.map((f) => (
            <span key={f} className="rounded-full bg-muted px-2 py-0.5 text-xs">
              {f}
            </span>
          ))}
        </div>
      </div>
      <ul className="grid gap-2">
        {partners.map((p) => (
          <li key={p} className="flex items-center justify-between gap-2 rounded-xl border p-3">
            <span className="truncate text-sm font-medium">{p}</span>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground">
              <MailIcon className="size-3" aria-hidden />
              Write email
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ArtistPreview({ data }: { data?: WorkspaceOverview }) {
  const byCity = new Map<string, WorkspaceOverview['runs'][number]>();
  for (const r of data?.runs ?? []) if (!byCity.has(r.show.city)) byCity.set(r.show.city, r);
  const cols = [...byCity.values()].slice(0, 3);
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {cols.map((r) => (
        <div key={r.id} className="rounded-xl border p-3">
          <p className="text-sm font-bold">{CITY_META[r.show.city].name}</p>
          <p className="truncate text-xs text-muted-foreground">{r.show.venue.name}</p>
          <ul className="mt-2 grid gap-1.5">
            {r.segments.slice(0, 3).map((s, i) => (
              <li key={s.id} className="flex items-center gap-1.5 text-xs">
                <span
                  className={cn(
                    'size-2 shrink-0 rounded-full',
                    ['bg-primary', 'bg-fuchsia-400', 'bg-sky-400'][i],
                  )}
                />
                <span className="truncate">{s.name}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {!cols.length && <p className="text-sm text-muted-foreground">Tour cities load here.</p>}
    </div>
  );
}

/** Illustrative only: the real page is live listings and places. */
function FanPreview() {
  const cards = [
    {
      when: 'On now',
      title: 'Late set, small room',
      where: 'Jazz club · 0.6 km',
      tone: 'from-primary to-fuchsia-600',
      badge: 'Top match',
    },
    {
      when: 'In 40 min',
      title: 'Indie headliner',
      where: 'Club · 1.8 km',
      tone: 'from-fuchsia-600 to-sky-500',
      badge: 'Good match',
    },
    {
      when: '9:30 PM',
      title: 'Soul night',
      where: 'Pub with live music · 1.1 km',
      tone: 'from-sky-500 to-emerald-500',
      badge: '',
    },
  ];
  return (
    <div className="grid gap-3">
      <div className="flex gap-2 overflow-hidden">
        {cards.map((c) => (
          <div
            key={c.title}
            className={cn(
              'relative aspect-[4/5] w-36 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br p-2.5 text-white',
              c.tone,
            )}
          >
            <span className="rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-semibold">
              {c.when}
            </span>
            {c.badge && (
              <span className="ml-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-zinc-900">
                {c.badge}
              </span>
            )}
            <div className="absolute inset-x-2.5 bottom-2.5">
              <p className="text-sm leading-tight font-bold">{c.title}</p>
              <p className="text-[11px] text-white/80">{c.where}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between rounded-xl border p-3 text-sm">
        <span className="font-medium">Jazz &amp; blues club</span>
        <span className="inline-flex items-center gap-1 text-xs">
          <StarIcon className="size-3 fill-amber-400 text-amber-400" aria-hidden /> 4.7 ·{' '}
          <span className="text-emerald-600 dark:text-emerald-400">Open now · until 3 AM</span>
        </span>
      </div>
    </div>
  );
}
