'use client';

import { OrganizationSwitcher } from '@clerk/nextjs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/** Shown when the workspace belongs to an organization that isn't the caller's active one. */
export function SwitchWorkspace() {
  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>This workspace belongs to another organization</CardTitle>
        <CardDescription>
          Switch to it if you&apos;re a member. Otherwise ask its admin for an invite.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <OrganizationSwitcher hidePersonal afterSelectOrganizationUrl="/w/:slug" />
      </CardContent>
    </Card>
  );
}
