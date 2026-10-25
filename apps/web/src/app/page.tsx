import Link from 'next/link';
import { Suspense } from 'react';
import { HeroBrief, HeroBriefPlaceholder } from '@/components/landing/hero-brief';
import {
  BriefContents,
  FinalCta,
  ForFans,
  HowItWorks,
  Personas,
  Problem,
  SectionHeading,
  Trust,
} from '@/components/landing/sections';
import { Accent, heroPill, PageHero } from '@/components/page-hero';
import { PresetExplorer } from '@/components/preset-explorer';
import { ShowForm } from '@/components/show-form';
import { Skeleton } from '@/components/ui/skeleton';
import { DemoWorkspaces } from '@/components/workspace/demo-workspaces';
import { ApiError, getPresets } from '@/lib/api';

async function Presets() {
  try {
    const presets = await getPresets();
    return <PresetExplorer presets={presets} />;
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    return (
      <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
        Can&apos;t load demo shows right now: {e.message}.
      </p>
    );
  }
}

export default function Home() {
  return (
    <main className="flex-1">
      <PageHero
        size="lg"
        live
        eyebrow="For promoters, venues and artist teams · Powered by Qloo’s taste graph"
        title={
          <>
            Fill the room with <Accent>fans you don&apos;t have yet.</Accent>
          </>
        }
        description="Pick a booked show. HouseFull finds the next ring of likely buyers, shows where in the city they are and how to reach them, and writes a campaign brief you can run today. Then it learns from your results and re-plans."
        aside={
          <Suspense fallback={<HeroBriefPlaceholder />}>
            <HeroBrief />
          </Suspense>
        }
      >
        <div className="flex flex-wrap gap-2">
          <Link href="/sign-up" className={heroPill(true)}>
            Start your workspace
          </Link>
          <Link href="#demo-workspaces" className={heroPill(false)}>
            Explore a demo
          </Link>
          <Link href="/tonight" className={heroPill(false)}>
            Going out tonight?
          </Link>
        </div>
        <p className="text-sm text-white/60">
          No sign-up needed for the demos.{' '}
          <Link href="#how" className="underline underline-offset-4 hover:text-white">
            See how it works
          </Link>
        </p>
      </PageHero>

      <div className="mx-auto grid w-full max-w-6xl grid-cols-[minmax(0,1fr)] gap-20 px-4 py-14 sm:py-20">
        <Problem />
        <HowItWorks />
        <Personas />
        <ForFans />
        <BriefContents />
        <Trust />

        <section
          id="demo-workspaces"
          aria-labelledby="demo-heading"
          className="grid gap-6 scroll-mt-20"
        >
          <SectionHeading id="demo-heading" eyebrow="Try it" title="Explore a demo workspace">
            Each demo is a full workspace with real briefs, results and re-plans. Open the one that
            matches your job. No sign-up needed.
          </SectionHeading>
          <Suspense
            fallback={
              <div className="grid gap-3 sm:grid-cols-3">
                <Skeleton className="h-40" />
                <Skeleton className="h-40" />
                <Skeleton className="h-40" />
              </div>
            }
          >
            <DemoWorkspaces />
          </Suspense>
        </section>

        <section id="try-a-show" aria-labelledby="try-heading" className="grid gap-6 scroll-mt-20">
          <SectionHeading
            id="try-heading"
            eyebrow="Or start from a show"
            title="Plan a campaign right now"
          >
            Pick a demo show to watch the agent work step by step, or plan any artist at any venue
            in the three cities.
          </SectionHeading>
          <Suspense
            fallback={
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                <Skeleton className="h-56" />
                <Skeleton className="h-[360px] lg:h-[520px]" />
              </div>
            }
          >
            <Presets />
          </Suspense>
          <div>
            <Suspense fallback={<Skeleton className="h-64" />}>
              <ShowForm />
            </Suspense>
          </div>
        </section>

        <FinalCta />
      </div>
    </main>
  );
}
