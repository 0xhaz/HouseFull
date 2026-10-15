import { OrganizationProfile } from '@clerk/nextjs';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Team' };

/** Members, invitations and roles come from the Clerk organization behind the workspace. */
export default function Page() {
  return <OrganizationProfile routing="hash" />;
}
