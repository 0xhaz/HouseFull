import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Onboarding } from '@/components/onboarding';
import { Accent, PageHero } from '@/components/page-hero';

export const metadata: Metadata = { title: 'Set up your workspace' };

export default function Page() {
  return (
    <main className="flex-1">
      <PageHero
        size="sm"
        eyebrow="Welcome to HouseFull"
        title={
          <>
            Set up <Accent>your workspace</Accent>
          </>
        }
        description="Name it, tell us who it’s for, and your dashboard opens. You can invite your team right after."
      />
      <div className="mx-auto w-full max-w-4xl px-4 py-8">
        <Suspense>
          <Onboarding />
        </Suspense>
      </div>
    </main>
  );
}
