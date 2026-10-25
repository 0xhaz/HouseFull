import { RedirectToSignIn } from '@clerk/nextjs';
import { PERSONA_META } from '@housefull/shared';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { PageHero } from '@/components/page-hero';
import { Skeleton } from '@/components/ui/skeleton';
import { PERSONA_ICONS } from '@/components/workspace/persona-icons';
import { SwitchWorkspace } from '@/components/workspace/switch-workspace';
import { WorkspaceNav } from '@/components/workspace/workspace-nav';
import { loadWorkspace } from '@/lib/workspace';
import { WorkspaceProvider } from '@/lib/workspace-context';

const Body = ({ children }: { children: React.ReactNode }) => (
  <div className="mx-auto w-full max-w-6xl px-4 py-8">{children}</div>
);

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
    return (
      <>
        <PageHero size="sm" title="Workspace" />
        <Body>
          {load.status === 403 ? (
            <SwitchWorkspace />
          ) : (
            <p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
              Can&apos;t load this workspace right now: {load.message}.
            </p>
          )}
        </Body>
      </>
    );
  }
  const ws = load.data.workspace;
  const Icon = PERSONA_ICONS[ws.persona];
  return (
    <WorkspaceProvider workspace={ws}>
      <PageHero
        size="sm"
        eyebrow={
          <span className="inline-flex items-center gap-1.5">
            <Icon className="size-3.5" aria-hidden />
            {PERSONA_META[ws.persona].label} workspace
            {ws.isDemo && <span className="text-white/60">· Demo, open to everyone</span>}
          </span>
        }
        title={ws.name.replace(/ \(demo\)$/, '')}
        description={PERSONA_META[ws.persona].blurb}
      >
        <WorkspaceNav slug={ws.slug} isDemo={ws.isDemo} />
      </PageHero>
      <Body>{children}</Body>
    </WorkspaceProvider>
  );
}

export default function Layout({ params, children }: LayoutProps<'/w/[slug]'>) {
  return (
    <main className="flex-1">
      <Suspense
        fallback={
          <>
            <div className="bg-zinc-950">
              <div className="mx-auto grid max-w-6xl gap-4 px-4 py-10">
                <Skeleton className="h-6 w-48 bg-white/10" />
                <Skeleton className="h-10 w-2/3 bg-white/10" />
                <Skeleton className="h-9 w-80 bg-white/10" />
              </div>
            </div>
            <Body>
              <Skeleton className="h-96" />
            </Body>
          </>
        }
      >
        <Shell params={params}>{children}</Shell>
      </Suspense>
    </main>
  );
}
