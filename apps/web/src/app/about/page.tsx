import {
  ArrowDownIcon,
  ArrowRightIcon,
  BadgeCheckIcon,
  BotIcon,
  BrainIcon,
  DatabaseIcon,
  GlobeIcon,
  LockIcon,
  ServerIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TicketIcon,
  TrainFrontIcon,
  UsersIcon,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { type ReactNode, Suspense } from 'react';
import { FlowDiagram } from '@/components/landing/flow-diagram';
import { SectionHeading } from '@/components/landing/sections';
import { Accent, heroPill, PageHero } from '@/components/page-hero';
import { Skeleton } from '@/components/ui/skeleton';
import { loadShowcase } from '@/lib/showcase';

export const metadata: Metadata = {
  title: 'About',
  description:
    'HouseFull is a Qloo-powered campaign agent that finds the next ring of ticket buyers for live music.',
};

const REPO = 'https://github.com/0xhaz/HouseFull';

async function Flow() {
  const { showcase } = await loadShowcase();
  return <FlowDiagram showcase={showcase} />;
}

const QLOO = [
  {
    what: 'The next ring',
    how: 'Taste-adjacent artists from the insights API, clustered into three new audiences',
  },
  {
    what: 'Where they live',
    how: 'Per-audience heatmaps divided by a city baseline (lift), snapped to neighborhoods',
  },
  { what: 'How to reach them', how: 'Podcasts, TV shows and brands each audience over-indexes on' },
  {
    what: 'Partners and openers',
    how: 'Taste-matched places near the venue; smaller acts that bring the audiences',
  },
  { what: 'Outreach', how: 'Contact details from Qloo entities: address, phone, website, hours' },
  {
    what: 'Tonight',
    how: 'Affinity of tonight’s acts to the artists a fan likes; jazz clubs and pubs by tag',
  },
];

export default function Page() {
  return (
    <main className="flex-1">
      <PageHero
        eyebrow="About HouseFull"
        title={
          <>
            A campaign agent for <Accent>live music</Accent>
          </>
        }
        description="Most promotion goes to fans who already know about the show. HouseFull uses Qloo’s taste graph to find people with similar taste who haven’t heard about it yet, and turns that into a plan a promoter, venue or artist team can start the same day."
      >
        <div className="flex flex-wrap gap-2">
          <Link href="/guide" className={heroPill(true)}>
            Read the user guide
          </Link>
          <a href={REPO} className={heroPill(false)} target="_blank" rel="noopener noreferrer">
            Source on GitHub
          </a>
        </div>
      </PageHero>

      <div className="mx-auto grid w-full max-w-6xl grid-cols-[minmax(0,1fr)] gap-20 px-4 py-14 sm:py-20">
        <section aria-labelledby="what" className="grid gap-8">
          <SectionHeading
            id="what"
            eyebrow="What it does"
            title="From a booked show to a full room"
          >
            Plan any show in New York, New Orleans or Los Angeles. In about a minute you get new
            audiences, where they live and how to reach them, plus ad copy, partners, openers, a
            countdown and a show-night plan. When you check in results, it re-plans.
          </SectionHeading>
          <Suspense fallback={<Skeleton className="h-[30rem] rounded-3xl" />}>
            <Flow />
          </Suspense>
        </section>

        <section aria-labelledby="qloo" className="grid gap-8">
          <SectionHeading
            id="qloo"
            eyebrow="Qloo-powered"
            title={
              <>
                Qloo picks the audiences, <Accent>Gemini writes the copy</Accent>
              </>
            }
          >
            Every decision comes from Qloo’s taste graph. Gemini names audiences, writes copy and
            checks it, but it doesn’t choose who to target.
          </SectionHeading>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {QLOO.map((q) => (
              <li key={q.what} className="rounded-2xl border bg-card p-5">
                <SparklesIcon className="size-5 text-primary" aria-hidden />
                <p className="mt-3 font-semibold">{q.what}</p>
                <p className="mt-1 text-sm text-muted-foreground">{q.how}</p>
              </li>
            ))}
          </ul>
          <div className="grid gap-4 md:grid-cols-2">
            <Fact title="Taking popularity out">
              Raw heatmap affinity correlates with plain popularity (r ≈ 0.99), so it mostly shows
              where people live. Divided by a city baseline, the correlation drops to r ≈ 0.07 and
              what’s left is taste.
            </Fact>
            <Fact title="Every claim is sourced">
              Each Qloo call is logged with an id, and every reason in a brief carries the id of the
              call it came from. Unverifiable claims are dropped.
            </Fact>
          </div>
        </section>

        <section aria-labelledby="arch" className="grid gap-8">
          <SectionHeading id="arch" eyebrow="Architecture" title="How it’s built" />
          <Architecture />
        </section>

        <section aria-labelledby="values" className="grid gap-8">
          <SectionHeading id="values" eyebrow="Responsible by design" title="What it won’t do" />
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: UsersIcon,
                t: 'Target traits',
                d: 'Audiences are defined by taste, never by age, gender, ethnicity, religion or sexuality.',
              },
              {
                icon: ShieldCheckIcon,
                t: 'Rank by safety data',
                d: 'Incident counts are show-night context for promoters only.',
              },
              {
                icon: LockIcon,
                t: 'Track your location',
                d: 'Tonight computes distances in your browser.',
              },
              {
                icon: BadgeCheckIcon,
                t: 'Make things up',
                d: 'Numbers must come from the facts; a critic checks every brief.',
              },
            ].map((v) => (
              <li key={v.t} className="rounded-2xl border bg-muted/40 p-5">
                <v.icon className="size-5 text-primary" aria-hidden />
                <p className="mt-3 font-semibold">{v.t}</p>
                <p className="mt-1 text-sm text-muted-foreground">{v.d}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="credits" className="grid gap-6">
          <SectionHeading id="credits" eyebrow="Credits" title="Data, tools and license" />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border bg-card p-5 text-sm">
              <p className="font-semibold">Data</p>
              <ul className="mt-2 grid gap-1 text-muted-foreground">
                <li>Qloo Taste AI (hackathon API)</li>
                <li>Ticketmaster Discovery API</li>
                <li>NYC Open Data (DCP, NYPD), data.nola.gov, LA GeoHub (CC BY 4.0)</li>
                <li>MTA GTFS and service alerts</li>
                <li>© OpenStreetMap contributors (ODbL), OpenFreeMap tiles</li>
              </ul>
            </div>
            <div className="rounded-2xl border bg-card p-5 text-sm">
              <p className="font-semibold">Built with</p>
              <p className="mt-2 text-muted-foreground">
                Next.js 16, React 19, Tailwind CSS 4, NestJS 12, Postgres with PostGIS and pgRouting
                on Supabase, Gemini on Vertex AI, Clerk, MapLibre. Hosted on Vercel and Google Cloud
                Run.
              </p>
              <p className="mt-3">
                <a
                  href={REPO}
                  className="font-semibold text-primary underline-offset-4 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open source under the MIT license →
                </a>
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Fact({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground text-pretty">{children}</p>
    </div>
  );
}

/** The system on one screen: clients → web → API/agent → data and services. */
function Architecture() {
  return (
    <div className="grid gap-3 rounded-3xl border bg-card p-5 sm:p-8">
      <Row>
        <Node icon={GlobeIcon} title="Browser" note="Promoters, venues, artists, fans" />
        <Node icon={BotIcon} title="AI assistants" note="8 tools over MCP" />
      </Row>
      <Down />
      <Row>
        <Node icon={GlobeIcon} title="Web app" note="Next.js on Vercel" accent />
        <Node icon={LockIcon} title="Clerk" note="Sign-in · organizations = workspaces" />
      </Row>
      <Down />
      <Row>
        <Node
          icon={ServerIcon}
          title="API"
          note="NestJS on Cloud Run · REST, live streaming, MCP"
          accent
        />
        <Node
          icon={BrainIcon}
          title="Agent"
          note="Pipeline · brief · critic · re-plan · ask · outreach"
          accent
        />
      </Row>
      <Down />
      <Row>
        <Node icon={SparklesIcon} title="Qloo Taste AI" note="The taste graph" accent />
        <Node icon={BrainIcon} title="Gemini" note="Names, copy, critique" />
        <Node icon={TicketIcon} title="Ticketmaster" note="Shows tonight, conflicts" />
        <Node icon={TrainFrontIcon} title="MTA" note="Subway alerts, late service" />
        <Node icon={DatabaseIcon} title="Postgres" note="PostGIS · pgRouting · runs & briefs" />
      </Row>
      <p className="flex items-center justify-center gap-2 pt-2 text-xs text-muted-foreground">
        A run executes inside its live stream; an ordered event log lets any instance replay it
        <ArrowRightIcon className="size-3" aria-hidden />
      </p>
    </div>
  );
}

const Row = ({ children }: { children: ReactNode }) => (
  <div className="flex flex-wrap justify-center gap-3">{children}</div>
);
const Down = () => (
  <div className="flex justify-center text-muted-foreground" aria-hidden>
    <ArrowDownIcon className="size-5" />
  </div>
);
function Node({
  icon: Icon,
  title,
  note,
  accent,
}: {
  icon: typeof GlobeIcon;
  title: string;
  note: string;
  accent?: boolean;
}) {
  return (
    <div
      className={
        accent
          ? 'flex min-w-48 flex-1 items-start gap-3 rounded-2xl bg-zinc-950 p-4 text-white sm:max-w-72'
          : 'flex min-w-48 flex-1 items-start gap-3 rounded-2xl border bg-background p-4 sm:max-w-72'
      }
    >
      <Icon
        className={
          accent ? 'mt-0.5 size-5 shrink-0 text-primary' : 'mt-0.5 size-5 shrink-0 text-primary'
        }
        aria-hidden
      />
      <div>
        <p className="font-semibold">{title}</p>
        <p className={accent ? 'text-xs text-white/70' : 'text-xs text-muted-foreground'}>{note}</p>
      </div>
    </div>
  );
}
