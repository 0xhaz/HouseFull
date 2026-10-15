import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PresetExplorer } from '@/components/preset-explorer';
import { ShowForm } from '@/components/show-form';
import { Skeleton } from '@/components/ui/skeleton';
import { getPresets } from '@/lib/api';
import { loadWorkspace } from '@/lib/workspace';

export const metadata: Metadata = { title: 'Plan a show' };

async function Planner({ params }: { params: PageProps<'/w/[slug]/new'>['params'] }) {
  const load = await loadWorkspace((await params).slug);
  if (!load.ok) return null;
  const { persona, profile } = load.data.workspace;
  // Promoters can start from a demo show; venues and artist teams start from their own.
  const presets = persona === 'promoter' ? await getPresets().catch(() => []) : [];
  return (
    <div className="grid gap-8">
      {presets.length > 0 && <PresetExplorer presets={presets} />}
      <div className="max-w-3xl">
        <ShowForm key={profile.venue?.name ?? profile.artist ?? 'show'} />
      </div>
    </div>
  );
}

export default function Page({ params }: PageProps<'/w/[slug]/new'>) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Planner params={params} />
    </Suspense>
  );
}
