'use client';

import {
  BadgeCheckIcon,
  BarChart3Icon,
  MapPinnedIcon,
  RefreshCwIcon,
  SparklesIcon,
  TicketIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { Showcase } from '@/lib/showcase';
import { cn } from '@/lib/utils';
import { NextRing } from './next-ring';

const STEPS = [
  {
    icon: TicketIcon,
    title: 'Pick the show',
    line: 'Any artist, any venue, or straight from Ticketmaster.',
  },
  {
    icon: SparklesIcon,
    title: 'Find the next ring',
    line: 'Qloo’s taste graph finds who else would like this act.',
  },
  {
    icon: MapPinnedIcon,
    title: 'Map where they are',
    line: 'Neighborhoods where that taste runs high, and the trip time.',
  },
  {
    icon: BadgeCheckIcon,
    title: 'Get the brief',
    line: 'Ad copy, channels and partners, with a source for every claim.',
  },
  {
    icon: BarChart3Icon,
    title: 'Check in results',
    line: 'Clicks and sales per audience, from Meta or by hand.',
  },
  {
    icon: RefreshCwIcon,
    title: 'Re-plan',
    line: 'Budget moves to what sells, and a new version explains why.',
  },
] as const;

const AUTOPLAY_MS = 4500;

const dateFmt = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

/** "How it works" as a live pipeline: six steps, the last three loop. Auto-plays until touched. */
export function FlowDiagram({ showcase }: { showcase?: Showcase }) {
  const [step, setStep] = useState(0);
  const [auto, setAuto] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  // Only play while the diagram is on screen.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(Boolean(e?.isIntersecting)), {
      threshold: 0.3,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!auto || !visible) return;
    const t = setInterval(() => setStep((s) => (s + 1) % STEPS.length), AUTOPLAY_MS);
    return () => clearInterval(t);
  }, [auto, visible]);

  const choose = (i: number) => {
    setAuto(false);
    setStep(i);
  };
  const current = STEPS[step] ?? STEPS[0];

  return (
    <div ref={ref} className="grid gap-6">
      {/* The pipeline */}
      <div className="relative">
        <ol
          className="relative grid grid-cols-3 gap-3 sm:grid-cols-6"
          aria-label="How HouseFull works"
        >
          {STEPS.map((s, i) => {
            const active = i === step;
            const done = i < step;
            return (
              <li key={s.title} className="relative">
                {i > 0 && (
                  <span
                    aria-hidden
                    // Edge to edge: from the previous box (56px wide, centered; 12px grid gap)
                    // to this one, with 6px of air on each side.
                    className={cn(
                      'absolute top-9 right-[calc(50%+34px)] left-[calc(-50%+22px)] hidden h-0.5 -translate-y-1/2 sm:block',
                      done || active ? 'bg-primary' : 'bg-border',
                    )}
                  >
                    {active && (
                      <span className="absolute inset-0 animate-[flow_1.2s_linear_infinite] bg-[linear-gradient(90deg,transparent,white,transparent)] bg-[length:40%_100%] bg-no-repeat opacity-70" />
                    )}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => choose(i)}
                  aria-current={active ? 'step' : undefined}
                  className="group relative z-10 flex w-full flex-col items-center gap-2 rounded-2xl p-2 text-center focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <span
                    className={cn(
                      'grid size-14 place-items-center rounded-2xl border-2 transition-all duration-300',
                      active
                        ? 'scale-110 border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/30'
                        : done
                          ? 'border-primary/50 bg-card text-primary'
                          : 'border-border bg-card text-muted-foreground group-hover:border-primary/50',
                    )}
                  >
                    <s.icon className="size-6" aria-hidden />
                  </span>
                  <span
                    className={cn(
                      'text-xs font-semibold sm:text-sm',
                      !active && 'text-muted-foreground',
                    )}
                  >
                    <span className="text-muted-foreground">{i + 1}.</span> {s.title}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        {/* The loop: results feed the next version of the brief. */}
        <div aria-hidden className="mx-auto mt-1 hidden w-1/2 translate-x-1/2 sm:block">
          <div className="relative h-5 rounded-b-2xl border-x-2 border-b-2 border-dashed border-primary/50">
            <span className="absolute -bottom-2.5 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-background px-2 text-[11px] font-medium whitespace-nowrap text-primary">
              <RefreshCwIcon className="size-3" />
              learns from every result
            </span>
          </div>
        </div>
      </div>

      {/* The stage: what this step looks like, with the live demo brief */}
      <div className="grid overflow-hidden rounded-3xl border bg-card lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className="flex flex-col justify-between gap-6 p-6 sm:p-8">
          <div>
            <p className="text-sm font-semibold tracking-wide text-primary uppercase">
              Step {step + 1} of {STEPS.length}
            </p>
            <h3 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
              {current.title}
            </h3>
            <p className="mt-2 text-muted-foreground text-pretty">{current.line}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5" aria-hidden>
              {STEPS.map((s, i) => (
                <span
                  key={s.title}
                  className={cn(
                    'h-1.5 rounded-full transition-all duration-300',
                    i === step ? 'w-8 bg-primary' : 'w-1.5 bg-border',
                  )}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => setAuto((a) => !a)}
              className="text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              {auto ? 'Pause' : 'Play'}
            </button>
            {showcase && (
              <Link
                href={`/runs/${showcase.runId}/brief`}
                className="ml-auto text-sm font-semibold text-primary underline-offset-4 hover:underline"
              >
                Open the real brief →
              </Link>
            )}
          </div>
        </div>
        <div className="relative min-h-80 overflow-hidden bg-zinc-950 p-5 text-white sm:p-8">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_80%_0%,color-mix(in_oklab,var(--primary)_35%,transparent),transparent_60%),radial-gradient(50%_60%_at_0%_100%,rgba(147,51,234,0.3),transparent_60%)]"
          />
          <div key={step} className="relative animate-[rise_.45s_ease-out]">
            {showcase ? <Stage step={step} s={showcase} /> : <StagePlaceholder step={step} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stage({ step, s }: { step: number; s: Showcase }) {
  switch (step) {
    case 0:
      return (
        <div className="mx-auto max-w-sm">
          <div className="overflow-hidden rounded-2xl bg-white text-zinc-900 shadow-2xl">
            <div className="bg-gradient-to-r from-primary to-fuchsia-500 px-5 py-4 text-white">
              <p className="text-xs font-semibold tracking-wide uppercase opacity-80">
                Booked show
              </p>
              <p className="text-2xl font-extrabold">{s.artist}</p>
            </div>
            <div className="grid gap-3 px-5 py-4 text-sm">
              <p className="flex justify-between">
                <span className="text-zinc-500">Venue</span>
                <span className="font-semibold">{s.venue}</span>
              </p>
              <p className="flex justify-between">
                <span className="text-zinc-500">When</span>
                <span className="font-semibold">
                  {dateFmt.format(new Date(`${s.date}T00:00:00Z`))} · {s.city}
                </span>
              </p>
              {s.soldPct !== undefined && (
                <div>
                  <p className="flex justify-between">
                    <span className="text-zinc-500">Sold</span>
                    <span className="font-semibold">{s.soldPct}%</span>
                  </p>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-zinc-200">
                    <div
                      className="h-full animate-[grow_1s_ease-out] rounded-full bg-primary"
                      style={{ width: `${s.soldPct}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="border-t border-dashed border-zinc-300 px-5 py-3 text-xs text-zinc-500">
              If it’s selling slowly, HouseFull finds who else would buy.
            </div>
          </div>
        </div>
      );
    case 1:
      return <NextRing artist={s.artist} tags={s.tags} segments={s.segments} />;
    case 2:
      return (
        <div className="grid gap-4">
          {s.segments.slice(0, 2).map((seg, i) => (
            <div key={seg.id}>
              <p className="text-sm font-semibold">
                <span className={cn('mr-2 inline-block size-2.5 rounded-full', DOT[i])} />
                {seg.name}
              </p>
              <ul className="mt-2 grid gap-1.5">
                {seg.neighborhoods.slice(0, 3).map((n, j) => (
                  <li
                    key={n.name}
                    className="grid grid-cols-[minmax(0,1fr)_7rem_3.5rem] items-center gap-3 text-sm"
                  >
                    <span className="truncate text-white/80">{n.name}</span>
                    <span className="h-2 overflow-hidden rounded-full bg-white/10">
                      <span
                        className={cn(
                          'block h-full animate-[grow_.9s_ease-out] rounded-full',
                          BAR[i],
                        )}
                        style={{ width: `${Math.max(20, 100 - j * 22)}%` }}
                      />
                    </span>
                    <span className="text-right text-xs text-white/60 tabular-nums">
                      {n.minutes} min
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <p className="text-xs text-white/50">
            Ranked by how much stronger this taste is there than across the city, so busy areas
            don’t win on size alone.
          </p>
        </div>
      );
    case 3: {
      const seg = s.segments.find((x) => x.ad) ?? s.segments[0];
      return (
        <div className="mx-auto grid max-w-md gap-3">
          {seg?.ad && (
            <div className="rounded-2xl bg-white p-4 text-zinc-900 shadow-2xl">
              <p className="text-[11px] font-semibold tracking-wide text-zinc-500 uppercase">
                Ad variant A · {seg.name}
              </p>
              <p className="mt-1 text-lg leading-snug font-bold">{seg.ad.headline}</p>
              <p className="mt-1 text-sm text-zinc-600">{seg.ad.body}</p>
              <span className="mt-3 inline-block rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                {seg.ad.cta}
              </span>
            </div>
          )}
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/15">
              {s.claims} claims, each linked to a Qloo call
            </span>
            <span className="rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/15">
              {s.criticPassed ? 'Critic passed' : 'Critic notes attached'}
            </span>
            <span className="rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/15">
              + openers, partners, street team, countdown
            </span>
          </div>
        </div>
      );
    }
    case 4: {
      const max = Math.max(...s.results.map((r) => r.metric), 1);
      return (
        <div className="grid gap-3">
          <p className="text-sm text-white/70">
            Cost per sale by audience{s.sample ? ' (sample data)' : ''}: lower is better.
          </p>
          {s.results.slice(0, 4).map((r, i) => (
            <div key={r.name} className="grid gap-1">
              <p className="flex justify-between text-sm">
                <span className="truncate">{r.name}</span>
                <span className="font-semibold tabular-nums">
                  {r.sales ? `$${r.metric.toFixed(0)}` : 'no sales'}
                </span>
              </p>
              <span className="h-2.5 overflow-hidden rounded-full bg-white/10">
                <span
                  className={cn(
                    'block h-full animate-[grow_.9s_ease-out] rounded-full',
                    i === 0 ? 'bg-emerald-400' : 'bg-white/40',
                  )}
                  style={{ width: `${r.sales ? Math.max(8, (r.metric / max) * 100) : 100}%` }}
                />
              </span>
            </div>
          ))}
          {!s.results.length && <p className="text-sm text-white/60">No results checked in yet.</p>}
        </div>
      );
    }
    default:
      return (
        <div className="grid gap-3">
          <p className="text-sm text-white/70">Version {s.version}: what changed, and why.</p>
          {s.changes.map((c) => (
            <div
              key={c.detail}
              className="flex gap-3 rounded-xl bg-white/[0.06] p-3 ring-1 ring-white/10"
            >
              <span className="h-fit shrink-0 rounded-full bg-primary/90 px-2 py-0.5 text-[11px] font-semibold capitalize">
                {c.kind.replace('_', ' ')}
              </span>
              <span className="text-sm text-white/85">{c.detail}</span>
            </div>
          ))}
          {!s.changes.length && (
            <p className="text-sm text-white/60">Re-plans appear here after results come in.</p>
          )}
        </div>
      );
  }
}

const DOT = ['bg-primary', 'bg-fuchsia-400', 'bg-sky-400'];
const BAR = ['bg-primary', 'bg-fuchsia-400', 'bg-sky-400'];

function StagePlaceholder({ step }: { step: number }) {
  const s = STEPS[step] ?? STEPS[0];
  return (
    <div className="grid h-full place-items-center py-16 text-center">
      <s.icon className="size-14 text-white/70" aria-hidden />
      <p className="mt-3 text-white/70">{s.line}</p>
    </div>
  );
}
