'use client';

import {
  type CampaignBrief,
  type RunEvent,
  RunEventSchema,
  type RunStatus,
  type StepId,
} from '@housefull/shared';
import { useEffect, useReducer } from 'react';
import { API_BASE } from '@/lib/api';

/** `ctx` files the run under a workspace; the token proves the caller may write there. */
export async function startRun(body: { presetId: string }, ctx: RunContext = {}): Promise<string> {
  const res = await fetch(new URL('/runs', API_BASE), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(ctx.token ? { authorization: `Bearer ${ctx.token}` } : {}),
    },
    body: JSON.stringify({ ...body, ...(ctx.workspace ? { workspace: ctx.workspace } : {}) }),
  });
  if (res.status === 429) throw new Error('Too many runs from this network. Try again in a bit.');
  if (res.status === 401 || res.status === 403)
    throw new Error('You can’t plan shows in this workspace. Check your active organization.');
  if (!res.ok) throw new Error(`Could not start a run (${res.status})`);
  return ((await res.json()) as { runId: string }).runId;
}

export type RunContext = { workspace?: string; token?: string | null };

export type StepState = {
  step: StepId;
  segmentId?: string;
  status: 'started' | 'done' | 'skipped' | 'failed';
  summary?: string;
  ms?: number;
};

export type RunView = {
  lastSeq: number;
  steps: StepState[];
  qloo: {
    total: number;
    live: number;
    cached: number;
    recent: Array<{ id: string; label: string; ms: number; source: string }>;
  };
  warnings: string[];
  status: RunStatus | 'connecting';
};

const initial: RunView = {
  lastSeq: 0,
  steps: [],
  qloo: { total: 0, live: 0, cached: 0, recent: [] },
  warnings: [],
  status: 'connecting',
};

type Action = { seq: number; event: RunEvent } | { connected: true };

function reduce(state: RunView, action: Action): RunView {
  if ('connected' in action)
    return state.status === 'connecting' ? { ...state, status: 'running' } : state;
  // The server replays the whole log on reconnect; ignore what we've already applied.
  if (action.seq <= state.lastSeq) return state;
  const e = action.event;
  const next = { ...state, lastSeq: action.seq };
  switch (e.type) {
    case 'step': {
      const key = (s: StepState) => s.step === e.step && s.segmentId === e.segmentId;
      const entry: StepState = {
        step: e.step,
        segmentId: e.segmentId,
        status: e.status,
        summary: e.summary,
        ms: e.ms,
      };
      const exists = state.steps.some(key);
      return {
        ...next,
        steps: exists ? state.steps.map((s) => (key(s) ? entry : s)) : [...state.steps, entry],
      };
    }
    case 'qloo': {
      const label = `${e.endpoint}${e.filterType ? ` · ${e.filterType.replace('urn:entity:', '').replace('urn:', '')}` : ''}`;
      return {
        ...next,
        qloo: {
          total: state.qloo.total + 1,
          live: state.qloo.live + (e.source === 'live' ? 1 : 0),
          cached: state.qloo.cached + (e.source === 'live' ? 0 : 1),
          recent: [{ id: e.callId, label, ms: e.ms, source: e.source }, ...state.qloo.recent].slice(
            0,
            8,
          ),
        },
      };
    }
    case 'warning':
      return { ...next, warnings: [...state.warnings, e.message] };
    case 'done':
      return { ...next, status: e.status };
  }
}

/** Subscribes to a run's SSE stream; EventSource reconnects on its own until `done`. */
export function useRunStream(runId: string): RunView {
  const [view, dispatch] = useReducer(reduce, initial);
  useEffect(() => {
    const source = new EventSource(new URL(`/runs/${runId}/stream`, API_BASE));
    source.onopen = () => dispatch({ connected: true });
    source.onmessage = (msg) => {
      const parsed = RunEventSchema.safeParse(JSON.parse(msg.data));
      if (!parsed.success) return;
      dispatch({ seq: Number(msg.lastEventId), event: parsed.data });
      if (parsed.data.type === 'done') source.close();
    };
    return () => source.close();
  }, [runId]);
  return view;
}

export async function getRun(
  runId: string,
): Promise<{ status: RunStatus; result: CampaignBrief | null }> {
  const res = await fetch(new URL(`/runs/${runId}`, API_BASE));
  if (!res.ok) throw new Error(`Run ${runId} not found`);
  return res.json();
}
