import type { Metadata } from 'next';
import { Suspense } from 'react';
import { TonightExplorer } from '@/components/tonight/tonight-explorer';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = {
  title: 'Tonight',
  description: 'Live music near you tonight, matched to the artists you love.',
};

export default function Page() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <div className="mb-6 max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight text-balance">
          What&apos;s on tonight
        </h1>
        <p className="mt-2 text-muted-foreground text-pretty">
          Live music in the city, soonest first. Add a few artists you love and Qloo&apos;s taste
          graph ranks the shows you&apos;d most likely enjoy, including acts you&apos;ve never heard
          of.
        </p>
      </div>
      <Suspense
        fallback={
          <div className="grid gap-3">
            <Skeleton className="h-40" />
            <Skeleton className="h-36" />
          </div>
        }
      >
        <TonightExplorer />
      </Suspense>
    </main>
  );
}
