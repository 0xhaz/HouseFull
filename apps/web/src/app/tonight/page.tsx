import type { Metadata } from 'next';
import { Suspense } from 'react';
import { TonightExplorer } from '@/components/tonight/tonight-explorer';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = {
  title: 'Tonight',
  description:
    'Gigs, jazz clubs and pubs with live music near you, matched to the artists you love.',
};

export default function Page() {
  return (
    <main className="flex-1">
      <Suspense
        fallback={
          <div className="bg-zinc-950">
            <div className="mx-auto grid max-w-6xl gap-4 px-4 py-14">
              <Skeleton className="h-10 w-2/3 bg-white/10" />
              <Skeleton className="h-6 w-1/2 bg-white/10" />
              <Skeleton className="h-11 w-full bg-white/10" />
            </div>
          </div>
        }
      >
        <TonightExplorer />
      </Suspense>
    </main>
  );
}
