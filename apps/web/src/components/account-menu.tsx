'use client';

import { OrganizationSwitcher, Show, SignInButton, UserButton } from '@clerk/nextjs';
import { LayoutDashboardIcon } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

/** Signed in: workspace (organization) switcher and account. Signed out: demos and sign-in. */
export function AccountMenu() {
  return (
    <Show
      when="signed-in"
      fallback={
        <>
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/#demo-workspaces">Demo workspaces</Link>
          </Button>
          <SignInButton mode="modal">
            <Button size="sm" variant="outline">
              Sign in
            </Button>
          </SignInButton>
        </>
      }
    >
      <Button asChild variant="ghost" size="icon-sm" aria-label="Dashboard">
        <Link href="/dashboard">
          <LayoutDashboardIcon />
        </Link>
      </Button>
      <OrganizationSwitcher
        hidePersonal
        afterCreateOrganizationUrl="/onboarding"
        afterSelectOrganizationUrl="/w/:slug"
        appearance={{ elements: { organizationSwitcherTrigger: 'max-w-40 sm:max-w-56' } }}
      />
      <UserButton />
    </Show>
  );
}
