import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Onboarding } from '@/components/onboarding';

export const metadata: Metadata = { title: 'Set up your workspace' };

export default function Page() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Set up your workspace</h1>
      <Suspense>
        <Onboarding />
      </Suspense>
    </main>
  );
}
