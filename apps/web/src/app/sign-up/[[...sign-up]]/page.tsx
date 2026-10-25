import { SignUp } from '@clerk/nextjs';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Accent, PageHero } from '@/components/page-hero';

export const metadata: Metadata = { title: 'Create your account' };

export default function Page() {
  return (
    <main className="flex-1">
      <PageHero
        eyebrow="HouseFull"
        title={
          <>
            Start filling <Accent>rooms</Accent>
          </>
        }
        description="Create an account, set up a workspace for your team, and plan your first show in about a minute."
        aside={
          <div className="flex justify-center lg:justify-end">
            <Suspense>
              <SignUp />
            </Suspense>
          </div>
        }
      />
    </main>
  );
}
