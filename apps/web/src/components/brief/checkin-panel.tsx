'use client';

import type { CampaignBrief } from '@housefull/shared';
import { FileUpIcon, LoaderIcon, RefreshCwIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  getScoreboard,
  postCheckin,
  postReplan,
  type Scoreboard,
  type SegmentResult,
} from '@/lib/client-api';

const metric = (m: Scoreboard['segments'][number]) =>
  m.metricLabel === 'cost per sale'
    ? m.sales === 0
      ? 'no sales yet'
      : `$${m.metric.toFixed(2)} / sale`
    : m.metricLabel === 'clicks per $'
      ? `${m.metric.toFixed(2)} clicks / $`
      : m.metricLabel === 'sales per click'
        ? `${(m.metric * 100).toFixed(1)}% buy`
        : `${m.metric} clicks`;

export function CheckinPanel({
  runId,
  brief,
  isLatest,
}: {
  runId: string;
  brief: CampaignBrief;
  isLatest: boolean;
}) {
  const router = useRouter();
  const [board, setBoard] = useState<Scoreboard | null>(null);
  const [busy, setBusy] = useState<'save' | 'csv' | 'replan' | null>(null);
  const [values, setValues] = useState<Record<string, SegmentResult>>({});

  useEffect(() => {
    getScoreboard(runId).then(setBoard, () => setBoard(null));
  }, [runId]);

  const name = (id: string) => brief.segments.find((s) => s.id === id)?.name ?? id;
  const set = (id: string, key: 'clicks' | 'sales' | 'spendUsd', v: string) =>
    setValues((prev) => ({
      ...prev,
      [id]: { ...prev[id], segmentId: id, [key]: v === '' ? undefined : Number(v) },
    }));

  async function save(e: FormEvent) {
    e.preventDefault();
    const bySegment = Object.values(values).filter(
      (v) => v.clicks !== undefined || v.sales !== undefined || v.spendUsd !== undefined,
    );
    if (!bySegment.length) return toast.error('Enter results for at least one segment');
    setBusy('save');
    try {
      const r = await postCheckin(runId, { bySegment });
      setBoard(r.scoreboard);
      setValues({});
      toast.success(`Saved results for ${r.saved} segment${r.saved === 1 ? '' : 's'}`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function upload(file: File) {
    setBusy('csv');
    try {
      const r = await postCheckin(runId, { csv: await file.text() });
      setBoard(r.scoreboard);
      toast.success(
        `Imported ${r.saved} segment${r.saved === 1 ? '' : 's'}${r.unmatched.length ? `; skipped ${r.unmatched.length} ad sets not named hf-…` : ''}`,
      );
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function replan(force: boolean) {
    setBusy('replan');
    try {
      const r = await postReplan(runId, force);
      toast.success(r.result.summary);
      router.push(`/runs/${runId}/brief?v=${r.version}`);
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <CardTitle>Add results</CardTitle>
          <CardDescription>
            Per segment, from your ticketing and ad tools. Or upload a Meta Ads Manager export: ad
            sets named <code className="font-mono text-xs">hf-s1…</code> map to segments
            automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="flex flex-col gap-3">
            <div className="grid grid-cols-[minmax(0,1fr)_repeat(3,5rem)] items-center gap-2 text-xs text-muted-foreground">
              <span>Segment</span>
              <span>Clicks</span>
              <span>Sales</span>
              <span>Spend $</span>
            </div>
            {brief.segments.map((s) => (
              <div
                key={s.id}
                className="grid grid-cols-[minmax(0,1fr)_repeat(3,5rem)] items-center gap-2"
              >
                <span className="truncate text-sm">{s.name}</span>
                {(['clicks', 'sales', 'spendUsd'] as const).map((k) => (
                  <Input
                    key={k}
                    type="number"
                    min={0}
                    inputMode="numeric"
                    aria-label={`${s.name} ${k === 'spendUsd' ? 'spend in dollars' : k}`}
                    value={values[s.id]?.[k] ?? ''}
                    onChange={(e) => set(s.id, k, e.target.value)}
                  />
                ))}
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={busy !== null}>
                {busy === 'save' && <LoaderIcon className="size-3.5 animate-spin" />}
                Save results
              </Button>
              <Button type="button" variant="outline" disabled={busy !== null} asChild>
                <label className="cursor-pointer">
                  {busy === 'csv' ? (
                    <LoaderIcon className="size-3.5 animate-spin" />
                  ) : (
                    <FileUpIcon className="size-3.5" />
                  )}
                  Upload Meta CSV
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void upload(f);
                      e.target.value = '';
                    }}
                  />
                </label>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            How each segment is doing
            {board?.sample && <Badge variant="outline">Includes sample data</Badge>}
            {board?.earlySignal && board.segments.length > 0 && (
              <Badge variant="secondary">Early signal</Badge>
            )}
          </CardTitle>
          <CardDescription>{board?.reason ?? 'No results yet'}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {board && board.segments.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="pb-1 font-normal">Segment</th>
                  <th className="pb-1 text-right font-normal">Clicks</th>
                  <th className="pb-1 text-right font-normal">Sales</th>
                  <th className="pb-1 text-right font-normal">Spend</th>
                  <th className="pb-1 text-right font-normal">Result</th>
                </tr>
              </thead>
              <tbody>
                {board.segments.map((s, i) => (
                  <tr key={s.segmentId} className="border-t">
                    <td className="py-1.5">
                      {i === 0 && <span className="mr-1 text-primary">★</span>}
                      {name(s.segmentId)}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">{s.clicks}</td>
                    <td className="py-1.5 text-right tabular-nums">{s.sales}</td>
                    <td className="py-1.5 text-right tabular-nums">${s.spendUsd.toFixed(0)}</td>
                    <td className="py-1.5 text-right tabular-nums">{metric(s)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {isLatest ? (
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={() => replan(false)} disabled={busy !== null || !board?.ready}>
                {busy === 'replan' ? (
                  <LoaderIcon className="size-3.5 animate-spin" />
                ) : (
                  <RefreshCwIcon className="size-3.5" />
                )}
                Re-plan from results
              </Button>
              {board && !board.ready && board.segments.length > 0 && (
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline underline-offset-2"
                  onClick={() => replan(true)}
                  disabled={busy !== null}
                >
                  Re-plan anyway (thin data)
                </button>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              You&apos;re viewing an older version; re-plan from the latest.
            </p>
          )}
          {busy === 'replan' && (
            <p className="text-xs text-muted-foreground">
              Finding more fans like your best segment… about 20 seconds.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
