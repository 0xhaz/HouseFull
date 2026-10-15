'use client';

import { type CampaignBrief, STEP_LABELS, type StepId, StepIdSchema } from '@housefull/shared';
import { CheckIcon, CircleAlertIcon, DatabaseIcon, LoaderIcon, ZapIcon } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getRun, type StepState, useRunStream } from '@/lib/runs';
import { cn } from '@/lib/utils';

/** Pipeline order, from the shared step list so new steps can't sort out of place. */
const ORDER: StepId[] = StepIdSchema.options;

function StatusIcon({ status }: { status: StepState['status'] }) {
  if (status === 'done') return <CheckIcon className="size-4 text-primary" aria-label="done" />;
  if (status === 'failed')
    return <CircleAlertIcon className="size-4 text-destructive" aria-label="failed" />;
  return <LoaderIcon className="size-4 animate-spin text-muted-foreground" aria-label="running" />;
}

export function RunLive({ runId }: { runId: string }) {
  const view = useRunStream(runId);
  const [result, setResult] = useState<CampaignBrief | null>(null);

  useEffect(() => {
    if (view.status === 'done') void getRun(runId).then((r) => setResult(r.result));
  }, [view.status, runId]);

  const steps = [...view.steps].sort(
    (a, b) =>
      ORDER.indexOf(a.step) - ORDER.indexOf(b.step) ||
      (a.segmentId ?? '').localeCompare(b.segmentId ?? ''),
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <CardTitle>Agent steps</CardTitle>
          <CardDescription>
            {view.status === 'connecting' && 'Connecting…'}
            {view.status === 'running' && 'Working: every result below comes from a Qloo call.'}
            {view.status === 'done' && 'Done.'}
            {view.status === 'failed' && 'The run failed.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="flex flex-col gap-3" aria-label="Agent steps">
            {steps.map((s) => (
              <li key={`${s.step}-${s.segmentId ?? ''}`} className="flex items-start gap-3 text-sm">
                <span className="mt-0.5">
                  <StatusIcon status={s.status} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 font-medium">
                    {STEP_LABELS[s.step]}
                    {s.segmentId && <Badge variant="outline">{s.segmentId}</Badge>}
                    {s.ms !== undefined && (
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {(s.ms / 1000).toFixed(1)}s
                      </span>
                    )}
                  </div>
                  {s.summary && <p className="truncate text-muted-foreground">{s.summary}</p>}
                </div>
              </li>
            ))}
          </ol>
          {view.warnings.length > 0 && (
            <ul className="mt-4 flex flex-col gap-1 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
              {view.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Qloo calls <span className="tabular-nums text-muted-foreground">{view.qloo.total}</span>
          </CardTitle>
          <CardDescription className="flex gap-3">
            <span className="inline-flex items-center gap-1">
              <ZapIcon className="size-3.5" /> {view.qloo.live} live
            </span>
            <span className="inline-flex items-center gap-1">
              <DatabaseIcon className="size-3.5" /> {view.qloo.cached} cached
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-1.5 font-mono text-xs" aria-label="Recent Qloo calls">
            {view.qloo.recent.map((c) => (
              <li key={c.id} className="flex justify-between gap-2">
                <span className="truncate">{c.label}</span>
                <span
                  className={cn(
                    'shrink-0 tabular-nums',
                    c.source === 'live' ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  {c.source === 'live' ? `${c.ms}ms` : c.source}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {result && (
        <section className="flex flex-col gap-4 lg:col-span-2" aria-label="Brief ready">
          <Card className="border-primary/40">
            <CardHeader>
              <CardTitle>The brief for {result.artist.name} is ready</CardTitle>
              <CardDescription>{result.summary.replace('[Sample data] ', '')}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href={`/runs/${runId}/brief`}>Open the campaign brief</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/runs/${runId}/compare`}>Compare without Qloo</Link>
              </Button>
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
