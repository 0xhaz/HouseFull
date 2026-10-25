import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Accent, PageHero } from '@/components/page-hero';
import { SurveyForm } from '@/components/survey/survey-form';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError, getSurveyInfo } from '@/lib/api';

export const metadata: Metadata = {
  title: 'How was the show?',
  description: 'A two-minute, anonymous post-show survey.',
};

const dateFmt = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
});

/** The post-show survey for one show (the id is the show's run). Linked by QR at the venue. */
async function Survey({ params }: { params: PageProps<'/s/[id]'>['params'] }) {
  const { id } = await params;
  const info = await getSurveyInfo(id).catch((e) => {
    if (e instanceof ApiError) return undefined;
    throw e;
  });
  if (!info)
    return (
      <>
        <PageHero size="sm" eyebrow="Post-show survey" title="This survey isn’t open" />
        <div className="mx-auto max-w-2xl px-4 py-10 text-muted-foreground">
          The link may be mistyped, or the show’s plan isn’t ready yet.
        </div>
      </>
    );
  return (
    <>
      <PageHero
        size="sm"
        eyebrow={`${info.show.venue} · ${dateFmt.format(new Date(`${info.show.date}T00:00:00Z`))}`}
        title={
          <>
            How was <Accent>{info.show.artist}</Accent>?
          </>
        }
        description="Two minutes, anonymous. It helps the venue and organizers book more nights like this."
      />
      <div className="mx-auto w-full max-w-2xl px-4 py-8">
        <SurveyForm info={info} />
      </div>
    </>
  );
}

export default function Page({ params }: PageProps<'/s/[id]'>) {
  return (
    <main className="flex-1">
      <Suspense
        fallback={
          <div className="mx-auto grid max-w-2xl gap-4 px-4 py-10">
            <Skeleton className="h-24" />
            <Skeleton className="h-64" />
          </div>
        }
      >
        <Survey params={params} />
      </Suspense>
    </main>
  );
}
