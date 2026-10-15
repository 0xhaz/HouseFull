import type { Metadata } from 'next';
import { OutreachBoard } from '@/components/workspace/outreach/outreach-board';

export const metadata: Metadata = { title: 'Outreach' };

/** Contacts from the workspace's briefs, with drafts and status. The layout checks access. */
export default function Page() {
  return <OutreachBoard />;
}
