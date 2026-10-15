import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError, getRun } from '@/lib/api';

export const metadata: Metadata = { title: 'With and without Qloo' };

/** The baseline is model-written Markdown; show it as plain text. */
const plain = (md: string) =>
  md
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/^\s*[*-]\s+/gm, '· ')
    .replace(/^#+\s*/gm, '');

async function Compare({ params }: PageProps<'/runs/[id]/compare'>) {
  const { id } = await params;
  const run = await getRun(id).catch((e) => {
    if (e instanceof ApiError) notFound();
    throw e;
  });
  const brief = run.result;
  if (!brief) notFound();
  const claims =
    brief.segments.reduce((n, s) => n + s.why.length, 0) + brief.venueFit.reasons.length;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-sm text-muted-foreground">Same show, same question, same model</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">With and without Qloo</h1>
        <p className="mt-2 max-w-2xl text-pretty text-muted-foreground">
          Left: HouseFull&apos;s brief, built from Qloo&apos;s taste graph, with every claim linked
          to the call it came from. Right: the same model asked the same question with no data.
        </p>
      </header>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              With Qloo <Badge variant="secondary">{claims} sourced claims</Badge>
            </CardTitle>
            <CardDescription>{brief.summary.replace('[Sample data] ', '')}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm">
            {brief.segments.map((s) => (
              <div key={s.id} className="flex flex-col gap-1">
                <p className="font-medium">{s.name}</p>
                <p className="text-muted-foreground">
                  Fans of {s.seeds.map((x) => x.name).join(', ')}
                </p>
                <p className="text-muted-foreground">
                  {s.neighborhoods
                    .slice(0, 3)
                    .map((n) => `${n.name} (${n.lift.toFixed(2)}×, ${n.accessMin} min)`)
                    .join(' · ')}
                </p>
              </div>
            ))}
            <p className="text-muted-foreground">
              Openers: {brief.openers.map((o) => o.artist.name).join(', ') || 'none'} · Partners:{' '}
              {brief.partnerDeals.map((d) => d.place.name).join(', ') || 'none'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Without Qloo <Badge variant="outline">no sources</Badge>
            </CardTitle>
            <CardDescription>
              Plain model answer: no taste data, no neighborhood lift, nothing to check
            </CardDescription>
          </CardHeader>
          <CardContent>
            {brief.baselineComparison ? (
              <p className="whitespace-pre-line text-sm text-muted-foreground">
                {plain(brief.baselineComparison.llmOnly)}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                The comparison wasn&apos;t generated for this run (no LLM configured).
              </p>
            )}
          </CardContent>
        </Card>
      </div>
      <Link
        href={`/runs/${id}/brief`}
        className="text-sm text-primary underline underline-offset-4"
      >
        Back to the brief
      </Link>
    </div>
  );
}

export default function Page(props: PageProps<'/runs/[id]/compare'>) {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Compare {...props} />
      </Suspense>
    </main>
  );
}
