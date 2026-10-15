import type { Metadata } from 'next';
import { Suspense } from 'react';
import { RunLive } from '@/components/run-live';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 'Live run' };

async function Live({ params }: { params: PageProps<'/runs/[id]'>['params'] }) {
  const { id } = await params;
  return <RunLive runId={id} />;
}

export default function Page({ params }: PageProps<'/runs/[id]'>) {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Planning the campaign</h1>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Live params={params} />
      </Suspense>
    </main>
  );
}
