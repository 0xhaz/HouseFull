import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

/**
 * Public-first: the landing page, demo workspaces, run pages and share links stay open.
 * Only account pages require a session; workspace pages check access themselves
 * (demo workspaces are public, the rest need the matching active organization).
 */
const needsSession = createRouteMatcher(['/dashboard(.*)', '/onboarding(.*)']);

export default clerkMiddleware(async (auth, req) => {
  if (needsSession(req)) await auth.protect();
});

export const config = {
  matcher: [
    '/((?!_next|vendor|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
  ],
};
