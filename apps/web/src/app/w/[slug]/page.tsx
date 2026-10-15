import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { ArtistDashboard } from '@/components/workspace/artist-dashboard';
import { AskPanel } from '@/components/workspace/ask-panel';
import { PromoterDashboard } from '@/components/workspace/promoter-dashboard';
import { VenueDashboard } from '@/components/workspace/venue-dashboard';
import { loadWorkspace } from '@/lib/workspace';

export const metadata: Metadata = { title: 'Workspace' };

const DASHBOARDS = {
  promoter: PromoterDashboard,
  venue: VenueDashboard,
  artist: ArtistDashboard,
} as const;

async function Dashboard({ params }: { params: PageProps<'/w/[slug]'>['params'] }) {
  const load = await loadWorkspace((await params).slug);
  // The layout renders access errors.
  if (!load.ok) return null;
  const View = DASHBOARDS[load.data.workspace.persona];
  return (
    <div className="grid gap-6">
      <AskPanel />
      <View data={load.data} />
    </div>
  );
}

export default function Page({ params }: PageProps<'/w/[slug]'>) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Dashboard params={params} />
    </Suspense>
  );
}
