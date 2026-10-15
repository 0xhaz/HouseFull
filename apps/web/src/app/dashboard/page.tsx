import { auth } from '@clerk/nextjs/server';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { getCurrentWorkspace } from '@/lib/api';

export const metadata: Metadata = { title: 'Dashboard' };

/** Sends a signed-in user to their active workspace, or to set one up. */
async function Resolve(): Promise<never> {
  const { userId, orgId, getToken, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn();
  if (!orgId) redirect('/onboarding');
  const token = await getToken();
  const ws = token ? await getCurrentWorkspace(token) : null;
  redirect(ws ? `/w/${ws.slug}` : '/onboarding');
}

export default function Page() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
      <Suspense fallback={<Skeleton className="h-64" />}>
        <Resolve />
      </Suspense>
    </main>
  );
}
