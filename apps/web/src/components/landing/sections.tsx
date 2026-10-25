import {
  BadgeCheckIcon,
  CalendarClockIcon,
  DownloadIcon,
  HandshakeIcon,
  MapPinnedIcon,
  MicVocalIcon,
  MoonStarIcon,
  PodcastIcon,
  QuoteIcon,
  RefreshCwIcon,
  ScaleIcon,
  ShieldCheckIcon,
  UsersIcon,
} from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Accent, HeroGlow, heroPill } from '@/components/page-hero';

export function SectionHeading({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  eyebrow: string;
  title: ReactNode;
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

/** The problem in one picture: the same circle of fans vs. the next ring out. */
export function BeforeAfter() {
  return (
    <section aria-labelledby="problem" className="grid gap-8">
      <SectionHeading
        id="problem"
        eyebrow="The problem"
        title={
          <>
            A half-sold show needs <Accent>new fans</Accent>, not louder ads
          </>
        }
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Panel
          label="The usual fix"
          title="More ads to the same fans"
          note="Most have already seen it and decided."
          bright={false}
        />
        <Panel
          label="With HouseFull"
          title="Reach the next ring out"
          note="People whose taste sits right next to the artist’s, near the venue."
          bright
        />
      </div>
    </section>
  );
}

function Panel({
  label,
  title,
  note,
  bright,
}: {
  label: string;
  title: string;
  note: string;
  bright: boolean;
}) {
  return (
    <div
      className={
        bright
          ? 'relative isolate grid gap-5 overflow-hidden rounded-3xl bg-zinc-950 p-6 text-white sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-center'
          : 'grid gap-5 rounded-3xl border bg-card p-6 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-center'
      }
    >
      {bright && <HeroGlow />}
      <Rings bright={bright} />
      <div>
        <p
          className={`text-xs font-semibold tracking-wide uppercase ${bright ? 'text-primary' : 'text-muted-foreground'}`}
        >
          {label}
        </p>
        <p className="mt-1 text-2xl font-extrabold tracking-tight">{title}</p>
        <p className={`mt-1 text-sm ${bright ? 'text-white/70' : 'text-muted-foreground'}`}>
          {note}
        </p>
      </div>
    </div>
  );
}

/** Concentric rings: the same core hammered, or the outer ring lit. */
function Rings({ bright }: { bright: boolean }) {
  return (
    <svg viewBox="0 0 120 120" className="mx-auto size-32" aria-hidden>
      <circle
        cx="60"
        cy="60"
        r="54"
        fill="none"
        strokeWidth="10"
        className={bright ? 'animate-pulse stroke-primary' : 'stroke-muted'}
      />
      <circle
        cx="60"
        cy="60"
        r="36"
        fill="none"
        strokeWidth="2"
        strokeDasharray="3 5"
        className={bright ? 'stroke-white/30' : 'stroke-muted-foreground/30'}
      />
      <circle cx="60" cy="60" r="20" className={bright ? 'fill-white/15' : 'fill-primary/70'} />
      {!bright &&
        [0, 1, 2].map((i) => (
          <circle
            key={i}
            cx="60"
            cy="60"
            r={24 + i * 5}
            fill="none"
            strokeWidth="1.5"
            className="stroke-primary/40"
          />
        ))}
    </svg>
  );
}

const BRIEF_PARTS = [
  { icon: UsersIcon, title: 'New audiences', note: 'By taste, with reasons' },
  { icon: MapPinnedIcon, title: 'Where & how far', note: 'Neighborhoods + trip time' },
  { icon: PodcastIcon, title: 'Where to reach them', note: 'Podcasts, TV, brands' },
  { icon: QuoteIcon, title: 'Ad copy', note: '3 variants per audience' },
  { icon: MicVocalIcon, title: 'Opening acts', note: 'Who brings new fans' },
  { icon: HandshakeIcon, title: 'Partners', note: 'Bars & shops nearby' },
  { icon: CalendarClockIcon, title: 'Countdown', note: 'What to do each day' },
  { icon: MoonStarIcon, title: 'Show night', note: 'Transit + getting home' },
  { icon: RefreshCwIcon, title: 'Re-plan', note: 'From real results' },
  { icon: DownloadIcon, title: 'Exports', note: 'Meta, TikTok, PDF, GPX' },
];

export function BriefContents() {
  return (
    <section aria-labelledby="brief" className="grid gap-8">
      <SectionHeading
        id="brief"
        eyebrow="What you get"
        title="One brief, ten ways to sell tickets"
      />
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {BRIEF_PARTS.map((b) => (
          <li
            key={b.title}
            className="group rounded-2xl border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-lg"
          >
            <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              <b.icon className="size-5" aria-hidden />
            </span>
            <p className="mt-3 font-semibold">{b.title}</p>
            <p className="text-sm text-muted-foreground">{b.note}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

const TRUST = [
  { icon: BadgeCheckIcon, title: 'Every claim sourced' },
  { icon: ShieldCheckIcon, title: 'Checked by a critic' },
  { icon: UsersIcon, title: 'Taste, never traits' },
  { icon: ScaleIcon, title: 'Compare with and without Qloo' },
];

export function Trust() {
  return (
    <section aria-label="Why you can trust it" className="grid gap-4">
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {TRUST.map((t) => (
          <li key={t.title} className="flex items-center gap-3 rounded-2xl border bg-muted/40 p-4">
            <t.icon className="size-6 shrink-0 text-primary" aria-hidden />
            <span className="font-semibold">{t.title}</span>
          </li>
        ))}
      </ul>
      <p className="text-center text-xs text-muted-foreground">
        Data from Qloo Taste AI · Ticketmaster · Google Gemini · MTA · NYC Open Data · OpenStreetMap
      </p>
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
          Promoter, venue or artist team. Invite colleagues, plan your first show in a minute.
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
