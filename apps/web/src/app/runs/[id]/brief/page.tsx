import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { BriefScreen } from '@/components/brief/brief-screen';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError, asReplan, getVersion, getVersions } from '@/lib/api';

export const metadata: Metadata = { title: 'Campaign brief' };

async function Brief({ params, searchParams }: PageProps<'/runs/[id]/brief'>) {
  const { id } = await params;
  const { v } = await searchParams;
  let versions: Awaited<ReturnType<typeof getVersions>>;
  try {
    versions = await getVersions(id);
  } catch (e) {
    if (e instanceof ApiError) notFound();
    throw e;
  }
  if (versions.length === 0) notFound();
  const latest = Math.max(...versions.map((x) => x.version));
  const wanted = Number(Array.isArray(v) ? v[0] : v);
  const version = versions.some((x) => x.version === wanted) ? wanted : latest;
  const current = await getVersion(id, version);
  return (
    <BriefScreen
      runId={id}
      brief={current.brief}
      version={version}
      versions={versions.map((x) => ({
        version: x.version,
        summary: asReplan(x.changeNote)?.summary,
      }))}
      note={asReplan(current.changeNote)}
    />
  );
}

export default function Page(props: PageProps<'/runs/[id]/brief'>) {
  return (
    <main className="flex-1">
      <Suspense
        fallback={
          <>
            <div className="bg-zinc-950">
              <div className="mx-auto grid max-w-6xl gap-4 px-4 py-10">
                <Skeleton className="h-6 w-48 bg-white/10" />
                <Skeleton className="h-10 w-2/3 bg-white/10" />
              </div>
            </div>
            <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8">
              <Skeleton className="h-40" />
              <Skeleton className="h-96" />
            </div>
          </>
        }
      >
        <Brief {...props} />
      </Suspense>
    </main>
  );
}
