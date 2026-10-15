import { RedirectToSignIn } from '@clerk/nextjs';
import { PERSONA_META } from '@housefull/shared';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PERSONA_ICONS } from '@/components/workspace/persona-icons';
import { SwitchWorkspace } from '@/components/workspace/switch-workspace';
import { WorkspaceNav } from '@/components/workspace/workspace-nav';
import { loadWorkspace } from '@/lib/workspace';
import { WorkspaceProvider } from '@/lib/workspace-context';

async function Shell({
  params,
  children,
}: {
  params: LayoutProps<'/w/[slug]'>['params'];
  children: React.ReactNode;
}) {
  const { slug } = await params;
  const load = await loadWorkspace(slug);
  if (!load.ok) {
    if (load.status === 404) notFound();
    if (load.status === 401) return <RedirectToSignIn />;
    if (load.status === 403) return <SwitchWorkspace />;
    return (
      <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
        Can&apos;t load this workspace right now: {load.message}.
      </p>
    );
  }
  const ws = load.data.workspace;
  const Icon = PERSONA_ICONS[ws.persona];
  return (
    <WorkspaceProvider workspace={ws}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{ws.name}</h1>
          <p className="text-sm text-muted-foreground">
            {PERSONA_META[ws.persona].label} workspace
          </p>
        </div>
        {ws.isDemo && (
          <Badge variant="secondary" className="ml-auto">
            Demo: open to everyone
          </Badge>
        )}
      </div>
      <WorkspaceNav slug={ws.slug} isDemo={ws.isDemo} />
      <div className="mt-6">{children}</div>
    </WorkspaceProvider>
  );
}

export default function Layout({ params, children }: LayoutProps<'/w/[slug]'>) {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Shell params={params}>{children}</Shell>
      </Suspense>
    </main>
  );
}
