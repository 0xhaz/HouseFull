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
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
      <Suspense
        fallback={
          <div className="flex flex-col gap-6">
            <Skeleton className="h-16 w-2/3" />
            <Skeleton className="h-40" />
            <Skeleton className="h-96" />
          </div>
        }
      >
        <Brief {...props} />
      </Suspense>
    </main>
  );
}
