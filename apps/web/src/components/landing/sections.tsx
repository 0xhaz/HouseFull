import {
  ArrowRightIcon,
  BadgeCheckIcon,
  CalendarClockIcon,
  CheckIcon,
  DownloadIcon,
  HandshakeIcon,
  MapPinnedIcon,
  MicVocalIcon,
  MoonStarIcon,
  PodcastIcon,
  QuoteIcon,
  RefreshCwIcon,
  ScaleIcon,
  SearchIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TicketIcon,
  TrainFrontIcon,
  UsersIcon,
} from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Accent, HeroGlow, heroPill } from '@/components/page-hero';
import { Button } from '@/components/ui/button';
import { PERSONA_ICONS } from '@/components/workspace/persona-icons';
import { cn } from '@/lib/utils';

export function SectionHeading({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="max-w-2xl">
      <p className="text-sm font-semibold tracking-wide text-primary uppercase">{eyebrow}</p>
      <h2 id={id} className="mt-1 text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">
        {title}
      </h2>
      {children && <p className="mt-3 text-muted-foreground text-pretty">{children}</p>}
    </div>
  );
}

/** Why: a half-sold show usually gets more ads aimed at the fans who already passed. */
export function Problem() {
  const points = [
    {
      title: 'The usual fix reaches the same people',
      body: 'More spend on the artist’s existing fans and lookalikes. Most of them have already seen the show and decided.',
    },
    {
      title: 'Demographics don’t buy tickets',
      body: '“18–34 in Brooklyn” is a million people. Taste is what predicts who’d love this show and doesn’t know it’s on.',
    },
    {
      title: 'Time runs out fast',
      body: 'Three weeks out there’s no room for a research project. You need a plan you can run today, and a way to tell if it’s working.',
    },
  ];
  return (
    <section aria-labelledby="problem" className="grid gap-8">
      <SectionHeading
        id="problem"
        eyebrow="The problem"
        title="A show at 40% sold needs new fans, not louder ads"
      >
        HouseFull finds the next ring of buyers: people whose taste sits right next to the
        artist&apos;s, who live within reach of the venue, and who haven&apos;t heard about this
        show yet.
      </SectionHeading>
      <ul className="grid gap-4 md:grid-cols-3">
        {points.map((p) => (
          <li key={p.title} className="rounded-2xl border bg-card p-5">
            <p className="font-medium">{p.title}</p>
            <p className="mt-2 text-sm text-muted-foreground text-pretty">{p.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

const STEPS = [
  {
    icon: TicketIcon,
    title: 'Pick the show',
    body: 'Find it on Ticketmaster, or enter any artist and venue. Add how many tickets have sold and the budget you have left.',
    detail: 'New York, New Orleans and Los Angeles',
  },
  {
    icon: SearchIcon,
    title: 'Find the next ring',
    body: 'Qloo’s taste graph maps what the artist’s fans also love, then clusters it into audiences you’re not reaching yet. Each audience gets the neighborhoods where that taste runs high (above the city’s baseline, not just where people live) and the travel time to your door.',
    detail: 'You watch every step and every Qloo call stream in live',
  },
  {
    icon: SparklesIcon,
    title: 'Get the campaign brief',
    body: 'For each audience: why they fit, where they are, what they listen to and watch, three ad variants, and partner places nearby. Plus opening acts, a street-team route, and a day-by-day countdown to the show.',
    detail: 'A critic checks every claim before you see it',
  },
  {
    icon: RefreshCwIcon,
    title: 'Measure and re-plan',
    body: 'Run the ads with the tracking links provided, then check in results by hand or from a Meta Ads export. HouseFull scores each audience and rewrites the brief, showing exactly what changed and why.',
    detail: 'Every version is kept, so you can compare',
  },
];

export function HowItWorks() {
  return (
    <section aria-labelledby="how" className="grid gap-8">
      <SectionHeading
        id="how"
        eyebrow="How it works"
        title="From a booked show to a campaign in about a minute"
      >
        Four steps, the same for every team. What changes is the dashboard each team sees on top.
      </SectionHeading>
      <ol className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, i) => (
          <li key={s.title} className="relative flex flex-col rounded-2xl border bg-card p-5">
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                <s.icon className="size-4.5" aria-hidden />
              </span>
              <span className="text-xs font-medium text-muted-foreground">Step {i + 1}</span>
            </div>
            <p className="mt-4 font-medium">{s.title}</p>
            <p className="mt-2 text-sm text-muted-foreground text-pretty">{s.body}</p>
            <p className="mt-auto pt-4 text-xs text-primary">{s.detail}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

const PERSONAS = [
  {
    key: 'promoter',
    who: 'Promoters',
    title: 'Sell out the shows you’ve already booked',
    pain: 'You’re carrying a roster across cities, and a few dates are always behind.',
    benefits: [
      'New buyers beyond the artist’s core fans, described by taste, not demographics',
      'Which neighborhoods to target, and how long the trip to the venue is',
      'Ready-to-run ad copy per audience, exported for Meta and TikTok',
      'A countdown that says what to do today, for every show',
      'Results in, brief re-planned: spend moves to the audiences that convert',
      'Contact details for nearby bars, opening acts and podcasts, with a drafted email for each',
    ],
    dashboard:
      'Every show with tickets sold and days to go, the ones that need attention, today’s step for each, and where the new buyers are in each city.',
  },
  {
    key: 'venue',
    who: 'Venues',
    title: 'Know your room’s audience, and fill the dates in between',
    pain: 'You see the calendar first, but rarely who your shows actually draw.',
    benefits: [
      'Your upcoming Ticketmaster dates, each one click away from a brief',
      'Venue fit: how well an act’s fans match your room and its neighborhood',
      'Your room’s taste profile across shows: who it draws and where they live',
      'Bars, record stores and cafés nearby that share your audience, for cross-promotion',
      'Show night in New York: transit disruptions and the best late train home',
      'Outreach to neighbors and acts to book: phone, website and a drafted email, tracked to reply',
    ],
    dashboard:
      'Planned shows, your on-sale calendar, who your room draws, and the partners worth calling.',
  },
  {
    key: 'artist',
    who: 'Artist teams',
    title: 'One act, many cities: who the new fans are in each',
    pain: 'Every tour stop is a different market, but the creative usually isn’t.',
    benefits: [
      'Each stop’s new audiences side by side, so you can see how the cities differ',
      'Taste threads: what carries across cities, so one idea can work in many markets',
      'Opening acts who bring new fans to the bill, not the same ones',
      'In visitor cities like New Orleans, the cities fans travel in from',
      'Street-team routes past the shops that match each audience',
      'Pitch in-stores, support slots and podcast spots per city, with drafted emails',
    ],
    dashboard:
      'The whole tour with today’s step per date, the taste threads across cities, and new fans city by city.',
  },
] as const;

export function Personas() {
  return (
    <section aria-labelledby="personas" className="grid gap-8">
      <SectionHeading
        id="personas"
        eyebrow="Built for the whole bill"
        title="One engine, a dashboard for each team"
      >
        Promoters, venues and artist teams look at the same show from different sides. Each
        workspace is set up for one of them, and shared with your colleagues.
      </SectionHeading>
      <div className="grid gap-4 lg:grid-cols-3">
        {PERSONAS.map((p) => {
          const Icon = PERSONA_ICONS[p.key];
          return (
            <article key={p.key} className="flex flex-col rounded-2xl border bg-card p-5">
              <p className="flex items-center gap-2 text-sm font-medium text-primary">
                <Icon className="size-4" aria-hidden />
                {p.who}
              </p>
              <h3 className="mt-2 text-lg font-semibold tracking-tight text-balance">{p.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{p.pain}</p>
              <ul className="mt-4 grid gap-2">
                {p.benefits.map((b) => (
                  <li key={b} className="flex gap-2 text-sm">
                    <CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                    <span className="text-pretty">{b}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 rounded-lg bg-muted/60 p-3 text-sm">
                <p className="font-medium">Your dashboard</p>
                <p className="mt-1 text-muted-foreground text-pretty">{p.dashboard}</p>
              </div>
              <div className="mt-auto pt-4">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/w/demo-${p.key}`}>
                    Open the {p.who.toLowerCase().replace(/s$/, '')} demo
                    <ArrowRightIcon />
                  </Link>
                </Button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

const BRIEF_PARTS = [
  {
    icon: UsersIcon,
    title: 'New audiences',
    body: 'Three or so taste-based groups beyond the core fans, each with the reasons it fits.',
  },
  {
    icon: MapPinnedIcon,
    title: 'Where and how far',
    body: 'Neighborhoods on a map, with transit time (or drive time in LA) to the venue.',
  },
  {
    icon: PodcastIcon,
    title: 'Where to reach them',
    body: 'The podcasts, TV and brands each audience over-indexes on, and the ad interests to target.',
  },
  {
    icon: QuoteIcon,
    title: 'Ad copy',
    body: 'Three variants per audience with headline, body and call to action, ready to export.',
  },
  {
    icon: MicVocalIcon,
    title: 'Opening acts',
    body: 'Local acts whose fans are the audiences you want, to add reach to the bill.',
  },
  {
    icon: HandshakeIcon,
    title: 'Partners and street team',
    body: 'Nearby bars, cafés and record stores open that night, and a walking route to poster them.',
  },
  {
    icon: CalendarClockIcon,
    title: 'Countdown',
    body: 'What to do each day from now to the doors opening, audience by audience.',
  },
  {
    icon: MoonStarIcon,
    title: 'Show night (New York)',
    body: 'Subway disruptions and street events that night, and the best late train home.',
  },
  {
    icon: RefreshCwIcon,
    title: 'Results and re-plan',
    body: 'Tracking links, a scoreboard per audience, and a new version when the numbers say so.',
  },
  {
    icon: DownloadIcon,
    title: 'Take it with you',
    body: 'Meta and TikTok ad CSVs, a print-ready PDF, and a GPX file for the street team.',
  },
];

export function BriefContents() {
  return (
    <section aria-labelledby="brief" className="grid gap-8">
      <SectionHeading id="brief" eyebrow="What you get" title="Everything in a campaign brief">
        One page per show, written for the person who has to run the campaign tomorrow.
      </SectionHeading>
      <ul className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-5">
        {BRIEF_PARTS.map((b) => (
          <li key={b.title}>
            <b.icon className="size-5 text-primary" aria-hidden />
            <p className="mt-2 font-medium">{b.title}</p>
            <p className="mt-1 text-sm text-muted-foreground text-pretty">{b.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

const TRUST = [
  {
    icon: BadgeCheckIcon,
    title: 'Every claim has a source',
    body: 'Each reason in a brief links to the Qloo call behind it. Claims without one are dropped before you see them.',
  },
  {
    icon: ShieldCheckIcon,
    title: 'A critic reviews the copy',
    body: 'Rule checks plus a second model look for invented numbers and unsupported claims, and the copy is rewritten if needed.',
  },
  {
    icon: UsersIcon,
    title: 'Taste, never traits',
    body: 'Audiences are built from what people love, never from age, gender, ethnicity or religion, and copy never mentions them.',
  },
  {
    icon: ScaleIcon,
    title: 'With and without Qloo',
    body: 'Every brief can be compared with what a model writes on its own, so you can see what the taste data adds.',
  },
];

const SOURCES = [
  'Qloo Taste AI',
  'Ticketmaster',
  'Google Gemini',
  'MTA',
  'NYC Open Data',
  'OpenStreetMap',
];

export function Trust() {
  return (
    <section
      aria-labelledby="trust"
      className="grid gap-8 rounded-2xl border bg-muted/40 p-6 sm:p-8"
    >
      <SectionHeading
        id="trust"
        eyebrow="Why you can act on it"
        title="Grounded, checked, and fair"
      >
        Safety and incident data only ever appears as show-night context for the promoter. It is
        never used to rank or exclude audiences.
      </SectionHeading>
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {TRUST.map((t) => (
          <li key={t.title}>
            <t.icon className="size-5 text-primary" aria-hidden />
            <p className="mt-2 font-medium">{t.title}</p>
            <p className="mt-1 text-sm text-muted-foreground text-pretty">{t.body}</p>
          </li>
        ))}
      </ul>
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase">Data from</p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {SOURCES.map((s) => (
            <li key={s} className="rounded-full border bg-background px-3 py-1 text-sm">
              {s}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section
      aria-labelledby="start"
      className="relative isolate flex flex-col items-start gap-5 overflow-hidden rounded-3xl bg-zinc-950 p-6 text-white sm:flex-row sm:items-center sm:justify-between sm:p-10"
    >
      <HeroGlow />
      <div className="max-w-xl">
        <h2 id="start" className="text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">
          Set up a workspace for <Accent>your team</Accent>
        </h2>
        <p className="mt-2 text-white/70 text-pretty">
          Pick promoter, venue or artist team, invite your colleagues, and plan your first show.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/sign-up" className={heroPill(true)}>
          Start your workspace
        </Link>
        <Link href="#demo-workspaces" className={heroPill(false)}>
          See the demos
        </Link>
      </div>
    </section>
  );
}

/** The fan side: what's on tonight, and how it closes the loop with campaigns. */
export function ForFans() {
  const points = [
    {
      icon: SearchIcon,
      title: 'Matched to your taste',
      body: 'Add a few artists you love. Qloo ranks tonight’s shows by how close each act is to them, so you find bands you didn’t know you’d like.',
    },
    {
      icon: MapPinnedIcon,
      title: 'Jazz clubs, pubs and small rooms',
      body: 'Gigs plus the bars and clubs known for live music, open now or opening soon, with directions in one tap. Your location never leaves your browser.',
    },
    {
      icon: TrainFrontIcon,
      title: 'Know before you go',
      body: 'In New York, live subway alerts on the lines near tonight’s venues, so a delay doesn’t cost you the opener.',
    },
  ];
  return (
    <section
      aria-labelledby="fans"
      className="relative isolate grid gap-8 overflow-hidden rounded-3xl bg-zinc-950 p-6 text-white sm:p-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]"
    >
      <HeroGlow />
      <div>
        <p className="text-sm font-semibold tracking-wide text-primary uppercase">For fans</p>
        <h2
          id="fans"
          className="mt-1 text-3xl font-extrabold tracking-tight text-balance sm:text-4xl"
        >
          Going out <Accent>tonight?</Accent>
        </h2>
        <p className="mt-3 text-white/70 text-pretty">
          The same taste graph works from the other side. Tonight shows what&apos;s on in the city,
          ranked for you. When a promoter is running a HouseFull campaign for fans like you, the
          show is marked as promoted, so the right people hear about it and you always know why
          it&apos;s there.
        </p>
        <Link href="/tonight" className={cn(heroPill(true), 'mt-5')}>
          See what&apos;s on tonight
          <ArrowRightIcon className="size-4" />
        </Link>
      </div>
      <ul className="grid gap-5">
        {points.map((p) => (
          <li key={p.title} className="flex gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10 text-white ring-1 ring-white/15">
              <p.icon className="size-5" aria-hidden />
            </span>
            <div>
              <p className="font-semibold">{p.title}</p>
              <p className="mt-1 text-sm text-white/70 text-pretty">{p.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
