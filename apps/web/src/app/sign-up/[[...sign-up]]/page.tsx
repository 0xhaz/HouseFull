import { SignUp } from '@clerk/nextjs';
import type { Metadata } from 'next';
import { Suspense } from 'react';

export const metadata: Metadata = { title: 'Create your account' };

export default function Page() {
  return (
    <main className="flex flex-1 justify-center px-4 py-12">
      <Suspense>
        <SignUp />
      </Suspense>
    </main>
  );
}
