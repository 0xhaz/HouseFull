import { SignIn } from '@clerk/nextjs';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Accent, PageHero } from '@/components/page-hero';

export const metadata: Metadata = { title: 'Sign in' };

export default function Page() {
  return (
    <main className="flex-1">
      <PageHero
        eyebrow="HouseFull"
        title={
          <>
            Welcome <Accent>back</Accent>
          </>
        }
        description="Your workspaces, briefs and outreach are where you left them."
        aside={
          <div className="flex justify-center lg:justify-end">
            <Suspense>
              <SignIn />
            </Suspense>
          </div>
        }
      />
    </main>
  );
}
