'use client';

import { useAuth } from '@clerk/nextjs';
import type { Workspace } from '@housefull/shared';
import { createContext, type ReactNode, useCallback, useContext } from 'react';
import type { RunContext } from '@/lib/runs';

const WorkspaceCtx = createContext<Workspace | null>(null);

/** Scopes everything planned below it to one workspace. */
export function WorkspaceProvider({
  workspace,
  children,
}: {
  workspace: Workspace;
  children: ReactNode;
}) {
  return <WorkspaceCtx.Provider value={workspace}>{children}</WorkspaceCtx.Provider>;
}

export const useWorkspace = () => useContext(WorkspaceCtx);

/** Resolves where a new run goes and the token that allows it (none outside a workspace). */
export function useRunContext(): () => Promise<RunContext> {
  const ws = useWorkspace();
  const { getToken } = useAuth();
  return useCallback(async () => {
    if (!ws) return {};
    return { workspace: ws.slug, token: ws.isDemo ? null : await getToken() };
  }, [ws, getToken]);
}
