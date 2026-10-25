'use client';

import { type CampaignBrief, CITY_META, type ReplanResult } from '@housefull/shared';
import {
  ArrowLeftRightIcon,
  CalendarIcon,
  DownloadIcon,
  MapPinIcon,
  ShieldCheckIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Accent, heroGlass, heroPill, PageHero } from '@/components/page-hero';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { API_BASE } from '@/lib/api';
import { ActsAndPartners } from './acts-and-partners';
import { CheckinPanel } from './checkin-panel';
import { DisruptionsCard } from './disruptions-card';
import { GettingHomeCard } from './getting-home-card';
import { ScheduleList } from './schedule-list';
import { SegmentPanel } from './segment-panel';
import { SurveyPanel } from './survey-panel';

type Props = {
  runId: string;
  brief: CampaignBrief;
  version: number;
  versions: Array<{ version: number; summary?: string }>;
  note?: ReplanResult;
};

const dateFmt = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
});

export function BriefScreen({ runId, brief, version, versions, note }: Props) {
  const router = useRouter();
  const latest = Math.max(...versions.map((v) => v.version));
  const sample = note?.summary.startsWith('[Sample data]');
  const claims =
    brief.segments.reduce((n, s) => n + s.why.length, 0) +
    brief.venueFit.reasons.length +
    brief.openers.reduce((n, o) => n + o.why.length, 0);

  const daysOut = Math.round(
    (Date.parse(`${brief.show.date}T00:00:00Z`) -
      Date.parse(new Date().toISOString().slice(0, 10))) /
      86_400_000,
  );
  return (
    <>
      <PageHero
        size="sm"
        eyebrow={`Campaign brief · version ${version}${version === latest ? '' : ` of ${latest}`}`}
        title={
          <>
            {brief.artist.name} <span className="text-white/50">at</span>{' '}
            <Accent>{brief.show.venue.name}</Accent>
          </>
        }
        description={
          <span className="flex flex-wrap gap-x-4 gap-y-1 text-base">
            <span className="inline-flex items-center gap-1.5">
              <MapPinIcon className="size-4" />
              {CITY_META[brief.show.city].name}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarIcon className="size-4" />
              {dateFmt.format(new Date(brief.show.date))}
            </span>
          </span>
        }
        aside={
          <dl className={`${heroGlass} grid grid-cols-2 gap-px overflow-hidden`}>
            {[
              ['New audiences', brief.segments.length],
              ['Sourced claims', claims],
              ...(brief.show.soldPct !== undefined
                ? [['Sold', `${brief.show.soldPct}%`] as const]
                : []),
              ['Days to show', daysOut >= 0 ? daysOut : 'Played'],
            ].map(([label, value]) => (
              <div key={label} className="bg-white/[0.03] p-4">
                <dt className="text-xs text-white/60">{label}</dt>
                <dd className="mt-1 text-3xl font-extrabold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          {versions.length > 1 && (
            <Select
              value={String(version)}
              onValueChange={(v) => router.push(`/runs/${runId}/brief?v=${v}`)}
            >
              <SelectTrigger
                aria-label="Brief version"
                className="h-10 w-48 rounded-full border-white/15 bg-white/10 text-white hover:bg-white/20 [&_svg]:text-white/70"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {versions.map((v) => (
                  <SelectItem key={v.version} value={String(v.version)}>
                    Version {v.version}
                    {v.version === latest ? ' (latest)' : v.version === 1 ? ' (first plan)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger className={heroPill(false)}>
              <DownloadIcon className="size-3.5" />
              Export
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(['meta', 'tiktok'] as const).map((p) => (
                <DropdownMenuItem key={p} asChild>
                  <a
                    href={new URL(`/runs/${runId}/export/ads?platform=${p}`, API_BASE).toString()}
                    download
                  >
                    {p === 'meta' ? 'Meta Ads CSV' : 'TikTok Ads CSV'}
                  </a>
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem asChild>
                <Link href={`/runs/${runId}/print?v=${version}`}>Brief as PDF</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Link href={`/runs/${runId}/compare`} className={heroPill(false)}>
            <ArrowLeftRightIcon className="size-3.5" />
            Without Qloo
          </Link>
        </div>
      </PageHero>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
        {note && (
          <Card className="border-primary/40">
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                What changed in version {version}
                {sample && <Badge variant="outline">Based on sample data</Badge>}
              </CardTitle>
              <CardDescription>{note.summary.replace('[Sample data] ', '')}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-1 text-sm">
                {note.changes.map((c) => (
                  <li key={c.detail}>
                    <Badge variant="secondary" className="mr-2">
                      {c.kind.replace('_', ' ')}
                    </Badge>
                    {c.detail}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="grid grid-cols-[minmax(0,1fr)] gap-6 pt-6 md:grid-cols-[auto_minmax(0,1fr)]">
            <div className="flex flex-col items-start gap-1">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                Venue fit
              </span>
              <span className="text-5xl font-semibold tabular-nums">{brief.venueFit.score}</span>
              <span className="text-xs text-muted-foreground">out of 100</span>
            </div>
            <div className="flex flex-col gap-3">
              <p className="text-pretty">{brief.summary.replace('[Sample data] ', '')}</p>
              <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
                {brief.venueFit.reasons.map((r) => (
                  <li key={r.text}>· {r.text}</li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2">
                <Badge
                  variant={brief.critic.passed ? 'secondary' : 'outline'}
                  className="h-auto gap-1 whitespace-normal"
                >
                  <ShieldCheckIcon className="size-3" />
                  {brief.critic.passed
                    ? `${claims} claims, each linked to a Qloo call`
                    : `${brief.critic.notes.length} review note${brief.critic.notes.length === 1 ? '' : 's'}`}
                </Badge>
                {brief.core.demographics && (
                  <Badge
                    variant="outline"
                    title="Aggregate skew only; never used to target or exclude people"
                  >
                    Current fans {brief.core.demographics.ageSkew}
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="audiences">
          <TabsList className="flex-wrap">
            <TabsTrigger value="audiences">New audiences</TabsTrigger>
            <TabsTrigger value="acts">Openers & partners</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            {brief.show.city === 'nyc' && <TabsTrigger value="night">Show night</TabsTrigger>}
            <TabsTrigger value="results">Results</TabsTrigger>
          </TabsList>
          <TabsContent value="audiences" className="mt-4">
            <SegmentPanel brief={brief} />
          </TabsContent>
          <TabsContent value="acts" className="mt-4">
            <ActsAndPartners brief={brief} runId={runId} />
          </TabsContent>
          <TabsContent value="schedule" className="mt-4">
            <ScheduleList brief={brief} />
          </TabsContent>
          <TabsContent value="night" className="mt-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <GettingHomeCard brief={brief} />
              <DisruptionsCard brief={brief} />
            </div>
          </TabsContent>
          <TabsContent value="results" className="mt-4">
            <div className="grid gap-6">
              <CheckinPanel runId={runId} brief={brief} isLatest={version === latest} />
              <SurveyPanel runId={runId} showDate={brief.show.date} />
            </div>
          </TabsContent>
        </Tabs>

        {brief.warnings.length > 0 && (
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">
              {brief.warnings.length} note{brief.warnings.length === 1 ? '' : 's'} from the agent
            </summary>
            <ul className="mt-2 flex flex-col gap-1">
              {brief.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </>
  );
}
