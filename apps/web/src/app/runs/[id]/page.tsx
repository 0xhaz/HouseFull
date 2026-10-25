import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Accent, PageHero } from '@/components/page-hero';
import { RunLive } from '@/components/run-live';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 'Live run' };

async function Live({ params }: { params: PageProps<'/runs/[id]'>['params'] }) {
  const { id } = await params;
  return <RunLive runId={id} />;
}

export default function Page({ params }: PageProps<'/runs/[id]'>) {
  return (
    <main className="flex-1">
      <PageHero
        size="sm"
        live
        eyebrow="Live run"
        title={
          <>
            Planning <Accent>the campaign</Accent>
          </>
        }
        description="Watch the agent work: every step and every Qloo call streams in as it happens. A fresh plan takes about a minute; demo shows replay in seconds."
      />
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        <Suspense fallback={<Skeleton className="h-96" />}>
          <Live params={params} />
        </Suspense>
      </div>
    </main>
  );
}
