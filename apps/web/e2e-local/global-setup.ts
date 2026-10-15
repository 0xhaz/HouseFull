import { clerkSetup } from '@clerk/testing/playwright';

/** Fetches a Clerk testing token so signed-in tests skip bot protection. */
export default async function globalSetup() {
  await clerkSetup();
}
