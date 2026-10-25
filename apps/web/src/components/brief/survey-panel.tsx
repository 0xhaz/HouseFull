'use client';

import type { SurveySummary } from '@housefull/shared';
import {
  CheckIcon,
  CopyIcon,
  ExternalLinkIcon,
  MessageSquareQuoteIcon,
  StarIcon,
} from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getSurveyResults } from '@/lib/client-api';
import { cn } from '@/lib/utils';

const BAR = ['bg-primary', 'bg-fuchsia-500', 'bg-sky-500', 'bg-emerald-500'];

/** F9c: the post-show survey link and what attendees said, per audience. */
export function SurveyPanel({ runId, showDate }: { runId: string; showDate: string }) {
  const [summary, setSummary] = useState<SurveySummary | null | undefined>();
  const [url, setUrl] = useState('');
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState(false);
  const played = showDate <= new Date().toISOString().slice(0, 10);

  useEffect(() => {
    const link = `${window.location.origin}/s/${runId}`;
    setUrl(link);
    QRCode.toString(link, { type: 'svg', margin: 1, width: 132 }).then(setQr, () => setQr(''));
    getSurveyResults(runId).then(
      (r) => setSummary(r.summary),
      () => setSummary(null),
    );
  }, [runId]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked: the link is visible to select
    }
  }

  const n = summary?.responses ?? 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-lg font-bold tracking-tight">
          After the show: what attendees said
          {summary?.sample && <Badge variant="outline">Includes sample data</Badge>}
        </CardTitle>
        <CardDescription>
          A two-minute anonymous survey. The artists people tick place them in an audience, so you
          see who loved the night without tracking anyone.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        <div className="grid items-center gap-4 rounded-2xl border bg-muted/40 p-4 sm:grid-cols-[auto_minmax(0,1fr)]">
          {qr ? (
            <div
              className="size-[132px] overflow-hidden rounded-xl bg-white p-1"
              role="img"
              aria-label="QR code for the survey link"
              // biome-ignore lint/security/noDangerouslySetInnerHtml: SVG generated locally from our own URL
              dangerouslySetInnerHTML={{ __html: qr }}
            />
          ) : (
            <Skeleton className="size-[132px]" />
          )}
          <div className="grid min-w-0 gap-2">
            <p className="text-sm font-medium">
              {played
                ? 'Share it in the post-show email or on the venue screens.'
                : 'Ready for show night: put the QR code on the screens at the end of the set.'}
            </p>
            <code className="truncate rounded-lg bg-background px-2 py-1 text-xs">{url}</code>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={copy}
                className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1.5 text-sm hover:bg-muted"
              >
                {copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
                {copied ? 'Copied' : 'Copy link'}
              </button>
              <a
                href={`/s/${runId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1.5 text-sm hover:bg-muted"
              >
                <ExternalLinkIcon className="size-3.5" />
                Open the survey
              </a>
            </div>
          </div>
        </div>

        {summary === undefined ? (
          <Skeleton className="h-40" />
        ) : !n ? (
          <p className="text-sm text-muted-foreground">
            No responses yet. Answers appear here as they come in.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Stat
                label="Average rating"
                value={
                  summary?.overall.avgRating !== null ? (
                    <span className="inline-flex items-center gap-1">
                      {summary?.overall.avgRating}
                      <StarIcon className="size-5 fill-amber-400 text-amber-400" aria-hidden />
                    </span>
                  ) : (
                    '—'
                  )
                }
              />
              <Stat
                label="Would come back"
                value={
                  summary?.overall.wouldReturnPct !== null
                    ? `${summary?.overall.wouldReturnPct}%`
                    : '—'
                }
              />
              <Stat label="Responses" value={n} />
            </div>

            {!summary?.enough ? (
              <p className="text-sm text-muted-foreground">
                The breakdown by audience appears from 10 responses, so small numbers can’t identify
                anyone.
              </p>
            ) : (
              <>
                <div className="grid gap-3">
                  <p className="text-sm font-semibold">By audience</p>
                  {[
                    ...(summary?.bySegment ?? []),
                    {
                      segmentId: 'core',
                      name: 'Core fans (already followed the artist)',
                      ...summary?.coreFans,
                    },
                  ]
                    .filter((s) => (s.responses ?? 0) > 0)
                    .map((s, i) => (
                      <div key={s.segmentId} className="grid gap-1">
                        <p className="flex flex-wrap justify-between gap-2 text-sm">
                          <span className="font-medium">{s.name}</span>
                          <span className="text-muted-foreground tabular-nums">
                            {s.avgRating}★ · {s.wouldReturnPct ?? '—'}% would return · {s.responses}{' '}
                            {s.responses === 1 ? 'response' : 'responses'}
                          </span>
                        </p>
                        <span className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                          <span
                            className={cn(
                              'block h-full rounded-full',
                              s.segmentId === 'core' ? 'bg-foreground/40' : BAR[i % BAR.length],
                            )}
                            style={{ width: `${((s.avgRating ?? 0) / 5) * 100}%` }}
                          />
                        </span>
                      </div>
                    ))}
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <p className="text-sm font-semibold">How they heard about it</p>
                    <ul className="mt-2 grid gap-1.5">
                      {summary?.heardVia.slice(0, 5).map((h) => (
                        <li
                          key={h.channel}
                          className="grid grid-cols-[minmax(0,1fr)_3rem] items-center gap-2 text-sm"
                        >
                          <span className="relative h-6 overflow-hidden rounded-md bg-muted">
                            <span
                              className="absolute inset-y-0 left-0 bg-primary/20"
                              style={{ width: `${h.share * 100}%` }}
                            />
                            <span className="relative px-2 leading-6">{h.channel}</span>
                          </span>
                          <span className="text-right text-muted-foreground tabular-nums">
                            {Math.round(h.share * 100)}%
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-sm font-semibold">What stood out</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {summary?.tags.map((t) => (
                        <span key={t.tag} className="rounded-full bg-muted px-2.5 py-1 text-xs">
                          {t.tag} <span className="text-muted-foreground">×{t.count}</span>
                        </span>
                      ))}
                    </div>
                    {(summary?.comments.length ?? 0) > 0 && (
                      <ul className="mt-4 grid gap-2">
                        {summary?.comments.map((c) => (
                          <li key={c} className="flex gap-2 text-sm text-muted-foreground">
                            <MessageSquareQuoteIcon
                              className="mt-0.5 size-4 shrink-0"
                              aria-hidden
                            />
                            “{c}”
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  The next re-plan uses this: an audience whose attendees loved the night isn’t
                  paused just because its ads cost more.
                </p>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-2xl font-extrabold tabular-nums">{value}</p>
    </div>
  );
}
