'use client';

import type {
  CreateWorkspace,
  DraftRequest,
  LikedArtist,
  OutreachContact,
  OutreachDraft,
  OutreachUpdate,
  ShowInput,
  TonightResult,
  TonightWhen,
  Workspace,
} from '@housefull/shared';
import { API_BASE } from '@/lib/api';
import type { RunContext } from '@/lib/runs';

async function send<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(new URL(path, API_BASE), {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (body as { message?: unknown }).message;
    throw new Error(typeof msg === 'string' ? msg : `Request failed (${res.status})`);
  }
  return body as T;
}

export type Venue = { entityId: string; name: string; address?: string; lat: number; lng: number };
export const searchVenues = (q: string, city: string) =>
  send<Venue[]>(`/shows/venues?${new URLSearchParams({ q, city })}`);

export type TmShow = {
  id: string;
  name: string;
  artist: string;
  venue: string;
  date: string;
  lat: number;
  lng: number;
};
export const searchShows = (q: string, city: string) =>
  send<{ available: boolean; reason?: string; events: TmShow[] }>(
    `/shows/search?${new URLSearchParams({ q, city })}`,
  );

export const startShowRun = (show: ShowInput, ctx: RunContext = {}) =>
  send<{ runId: string }>('/runs', {
    method: 'POST',
    headers: ctx.token ? { authorization: `Bearer ${ctx.token}` } : undefined,
    body: JSON.stringify({ show, ...(ctx.workspace ? { workspace: ctx.workspace } : {}) }),
  });

export type ScoredSegment = {
  segmentId: string;
  clicks: number;
  sales: number;
  spendUsd: number;
  metric: number;
  metricLabel: string;
};
export type Scoreboard = {
  version: number;
  segments: ScoredSegment[];
  missing: string[];
  ready: boolean;
  earlySignal: boolean;
  reason: string;
  sources: string[];
  sample: boolean;
};
export type SegmentResult = {
  segmentId: string;
  clicks?: number;
  sales?: number;
  spendUsd?: number;
};

export const getScoreboard = (runId: string) => send<Scoreboard>(`/runs/${runId}/checkins`);
export const postCheckin = (
  runId: string,
  body: { bySegment: SegmentResult[] } | { csv: string },
) =>
  send<{ saved: number; unmatched: string[]; scoreboard: Scoreboard }>(`/runs/${runId}/checkins`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
export const postReplan = (runId: string, force = false) =>
  send<{ version: number; result: { summary: string } }>(`/runs/${runId}/replan`, {
    method: 'POST',
    body: JSON.stringify({ force }),
  });

export const saveWorkspace = (body: CreateWorkspace, token: string | null) =>
  send<Workspace>('/workspaces/current', {
    method: 'PUT',
    headers: token ? { authorization: `Bearer ${token}` } : undefined,
    body: JSON.stringify(body),
  });

export type AskAnswer = {
  answer: string;
  sources: Array<{ ref: string; runId: string; segmentId?: string; label: string }>;
  followUps: string[];
};
export const askWorkspace = (slug: string, question: string, token: string | null) =>
  send<AskAnswer>(`/workspaces/${encodeURIComponent(slug)}/ask`, {
    method: 'POST',
    headers: token ? { authorization: `Bearer ${token}` } : undefined,
    body: JSON.stringify({ question }),
  });

export const searchArtists = (q: string) =>
  send<LikedArtist[]>(`/tonight/artists?${new URLSearchParams({ q })}`);
export const getTonight = (city: string, when: TonightWhen, likes: LikedArtist[]) =>
  send<TonightResult>(
    `/tonight?${new URLSearchParams({
      city,
      when,
      ...(likes.length ? { likes: JSON.stringify(likes) } : {}),
    })}`,
  );

const authed = (token: string | null) => (token ? { authorization: `Bearer ${token}` } : undefined);
export const getOutreach = (slug: string, token: string | null) =>
  send<OutreachContact[]>(`/workspaces/${encodeURIComponent(slug)}/outreach`, {
    headers: authed(token),
  });
export const draftOutreachEmail = (slug: string, body: DraftRequest, token: string | null) =>
  send<OutreachDraft>(`/workspaces/${encodeURIComponent(slug)}/outreach/draft`, {
    method: 'POST',
    headers: authed(token),
    body: JSON.stringify(body),
  });
export const saveOutreachStatus = (
  slug: string,
  entityId: string,
  body: OutreachUpdate,
  token: string | null,
) =>
  send<{ ok: true }>(
    `/workspaces/${encodeURIComponent(slug)}/outreach/${encodeURIComponent(entityId)}`,
    { method: 'PUT', headers: authed(token), body: JSON.stringify(body) },
  );
