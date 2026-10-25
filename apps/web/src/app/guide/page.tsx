import type { Metadata } from 'next';
import Link from 'next/link';
import { Accent, heroPill, PageHero } from '@/components/page-hero';

export const metadata: Metadata = {
  title: 'User guide',
  description:
    'How to use HouseFull: demo workspaces, planning a show, the brief, results, outreach and Tonight.',
};

const SECTIONS: Array<{
  id: string;
  title: string;
  who: string;
  intro: string;
  steps: string[];
  cta?: [string, string];
}> = [
  {
    id: 'start',
    title: 'Start in a minute',
    who: 'Everyone',
    intro: 'No account needed to look around: three demo workspaces are open to everyone.',
    steps: [
      'Open the landing page and click through “How it works”: every step shows data from a live demo brief.',
      'Choose “Explore a demo” and pick Promoter, Venue or Artist team.',
      'When you’re ready for your own: “Start your workspace”, sign up, name the workspace and choose who it’s for.',
    ],
    cta: ['/#demo-workspaces', 'Open the demos'],
  },
  {
    id: 'plan',
    title: 'Plan a show',
    who: 'Promoters, venues, artist teams',
    intro: 'Any artist, any venue in New York, New Orleans or Los Angeles.',
    steps: [
      'In your workspace, choose “Plan a show” (or use “Plan your own show” on the landing page).',
      'Find the show on Ticketmaster to fill artist, venue and date, or type them in. Add % sold and budget if you have them.',
      'Click “Plan this show” and watch the agent work: each step and Qloo call streams in. A fresh plan takes about a minute; demo shows replay in seconds.',
      'Open the campaign brief when it appears.',
    ],
    cta: ['/#try-a-show', 'Plan a show'],
  },
  {
    id: 'brief',
    title: 'Read the brief',
    who: 'Promoters, venues, artist teams',
    intro:
      'The top shows the venue fit, a one-paragraph diagnosis and how many claims are sourced.',
    steps: [
      'New audiences: pick an audience to see its neighborhoods on the map (with trip time), why it fits, its podcasts, TV and brands, and three ad variants.',
      'Openers & partners: opening acts that bring new fans, nearby bars and shops with a suggested deal, and a street-team walking route (Google Maps or GPX).',
      'Schedule: what to do each day until the show, plus competing shows that night.',
      'Show night (New York): subway disruptions, street events and a getting-home plan.',
      'Export: Meta or TikTok ad CSVs (ad sets are named hf-s1… so results map back), or a PDF. “Without Qloo” compares with a model that has no data.',
    ],
  },
  {
    id: 'results',
    title: 'Check in results and re-plan',
    who: 'Promoters, venues, artist teams',
    intro: 'The brief gets better as the campaign runs.',
    steps: [
      'On the brief’s Results tab, enter clicks, sales and spend per audience, or upload a Meta Ads Manager export.',
      'Once there’s enough signal (50 clicks per audience or 5 sales), click “Re-plan from results”.',
      'Version 2 explains what changed: budget moved to what sells, a lookalike audience added, a weak one paused. Earlier versions stay available.',
    ],
  },
  {
    id: 'survey',
    title: 'Hear from the crowd',
    who: 'Promoters, venues, artist teams',
    intro:
      'A two-minute anonymous survey after the show tells you which audiences loved the night.',
    steps: [
      'On the brief’s Results tab, copy the survey link or show the QR code on the venue screens at the end of the set.',
      'Attendees rate the night, say whether they’d come back, and tick artists they also like. Those artists place them in an audience, so nobody is tracked.',
      'From 10 responses you see ratings and return intent per audience, how people heard about the show, and what stood out.',
      'The next re-plan uses it: an audience that loved the night isn’t paused just because its ads cost more.',
    ],
  },
  {
    id: 'ask',
    title: 'Ask your workspace',
    who: 'Promoters, venues, artist teams',
    intro: 'Plain-language questions, answered only from your own briefs and results.',
    steps: [
      'On the workspace overview, type a question or pick a suggestion, e.g. “Which show needs the most help this week?”.',
      'Each answer links to the briefs it used; follow-up suggestions keep the thread going.',
    ],
  },
  {
    id: 'outreach',
    title: 'Contact partners, acts and podcasts',
    who: 'Promoters, venues, artist teams',
    intro: 'Everyone worth contacting, straight from your briefs, with the reason they fit.',
    steps: [
      'Open “Outreach” in your workspace. Filter by places, acts or podcasts.',
      'Each card has the address, phone, website and opening hours where available.',
      '“Write email”: choose what you’re asking for, add a note (e.g. “we can offer two guest-list spots”), and HouseFull drafts it. Edit, then copy or open it in your email app. Nothing is sent for you, and drafts never mention ticket sales.',
      'Track each contact: drafted, contacted, replied or declined.',
    ],
  },
  {
    id: 'dashboards',
    title: 'Your dashboard',
    who: 'By persona',
    intro: 'Each workspace type gets its own overview.',
    steps: [
      'Promoters: every show with tickets sold and days to go, what needs attention, today’s step per show, new buyers per city.',
      'Venues: planned shows, your on-sale Ticketmaster calendar (one click to a brief), who your room draws, local partners.',
      'Artist teams: the tour, taste threads that carry across cities, and new fans city by city.',
      'Team: invite colleagues by email from the Team tab; switch workspaces from the menu at the top.',
    ],
  },
  {
    id: 'tonight',
    title: 'Find a show tonight',
    who: 'Fans',
    intro: 'Live music in the city, picked for you. No account needed.',
    steps: [
      'Open “Tonight” and choose tonight, tomorrow, this weekend or the next 7 days.',
      'Add up to five artists you love: the rail becomes “Top picks for you”, ranked by Qloo, including acts you’ve never heard of.',
      '“Walk in tonight” lists jazz clubs, pubs and bars known for live music, with open hours and directions.',
      'Filter by scene or “Intimate rooms only”. “Near me” adds distances; your location stays in your browser.',
      'Tap “I’m going” on a show. Afterwards, “Your nights” asks how it was: rate it, and shows you loved sharpen your picks. Sharing with the organizer is optional and anonymous.',
    ],
    cta: ['/tonight', 'Open Tonight'],
  },
];

export default function Page() {
  return (
    <main className="flex-1">
      <PageHero
        size="sm"
        eyebrow="User guide"
        title={
          <>
            How to use <Accent>HouseFull</Accent>
          </>
        }
        description="Everything a promoter, venue, artist team or fan can do, step by step."
      >
        <div className="flex flex-wrap gap-2">
          <Link href="/#demo-workspaces" className={heroPill(true)}>
            Try a demo workspace
          </Link>
          <Link href="/about" className={heroPill(false)}>
            About HouseFull
          </Link>
        </div>
      </PageHero>

      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-10 px-4 py-12 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <nav aria-label="On this page" className="lg:sticky lg:top-20 lg:self-start">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            On this page
          </p>
          <ol className="mt-3 grid gap-1">
            {SECTIONS.map((s, i) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="flex gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted"
                >
                  <span className="w-4 text-muted-foreground tabular-nums">{i + 1}</span>
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="grid gap-6">
          {SECTIONS.map((s, i) => (
            <section
              key={s.id}
              id={s.id}
              aria-labelledby={`${s.id}-h`}
              className="scroll-mt-20 rounded-3xl border bg-card p-6 sm:p-8"
            >
              <p className="text-xs font-semibold tracking-wide text-primary uppercase">
                {i + 1} · {s.who}
              </p>
              <h2 id={`${s.id}-h`} className="mt-1 text-2xl font-extrabold tracking-tight">
                {s.title}
              </h2>
              <p className="mt-1 text-muted-foreground">{s.intro}</p>
              <ol className="mt-5 grid gap-3">
                {s.steps.map((step, j) => (
                  <li key={step} className="flex gap-3">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary tabular-nums">
                      {j + 1}
                    </span>
                    <span className="pt-0.5 text-pretty">{step}</span>
                  </li>
                ))}
              </ol>
              {s.cta && (
                <Link
                  href={s.cta[0]}
                  className="mt-5 inline-flex rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background hover:opacity-90"
                >
                  {s.cta[1]} →
                </Link>
              )}
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
