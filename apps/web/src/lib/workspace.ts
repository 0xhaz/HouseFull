import { auth } from '@clerk/nextjs/server';
import type { WorkspaceOverview } from '@housefull/shared';
import { cache } from 'react';
import { ApiError, getWorkspace } from '@/lib/api';

export type WorkspaceLoad =
  | { ok: true; data: WorkspaceOverview }
  | { ok: false; status: 401 | 403 | 404 | 503; message: string };

/** One fetch per request, shared by the workspace layout and its pages. */
export const loadWorkspace = cache(async (slug: string): Promise<WorkspaceLoad> => {
  const { getToken } = await auth();
  try {
    return { ok: true, data: await getWorkspace(slug, await getToken()) };
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    const status = e.status === 401 || e.status === 403 || e.status === 404 ? e.status : 503;
    return { ok: false, status, message: e.message };
  }
});
