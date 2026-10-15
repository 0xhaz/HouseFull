import type { CampaignBrief } from '@housefull/shared';
import { ClockIcon, DownloadIcon, FootprintsIcon, MapIcon, StoreIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { API_BASE } from '@/lib/api';

/** Google Maps walking directions from the venue through the stops. */
function walkingLink(
  venue: { lat: number; lng: number },
  stops: Array<{ lat: number; lng: number }>,
) {
  const pts = stops.slice(0, 10);
  const last = pts[pts.length - 1] ?? venue;
  const p = new URLSearchParams({
    api: '1',
    origin: `${venue.lat},${venue.lng}`,
    destination: `${last.lat},${last.lng}`,
    travelmode: 'walking',
  });
  if (pts.length > 1)
    p.set(
      'waypoints',
      pts
        .slice(0, -1)
        .map((x) => `${x.lat},${x.lng}`)
        .join('|'),
    );
  return `https://www.google.com/maps/dir/?${p}`;
}

export function ActsAndPartners({ brief, runId }: { brief: CampaignBrief; runId: string }) {
  const segName = (id: string) => brief.segments.find((s) => s.id === id)?.name ?? id;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Opening acts that bring new fans</CardTitle>
          <CardDescription>
            Liked by the next-ring audiences, less by {brief.artist.name}&apos;s current fans.
            Availability not checked.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {brief.openers.length === 0 && (
            <p className="text-sm text-muted-foreground">No candidates for this show.</p>
          )}
          <ol className="flex flex-col gap-4 text-sm">
            {brief.openers.map((o, i) => (
              <li key={o.artist.entityId} className="flex gap-3">
                <span className="w-5 shrink-0 font-semibold tabular-nums text-muted-foreground">
                  {i + 1}
                </span>
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="font-medium">{o.artist.name}</span>
                  {o.why.map((w) => (
                    <span key={w.text} className="text-muted-foreground">
                      {w.text}
                    </span>
                  ))}
                  <div className="flex flex-wrap gap-1.5">
                    {o.bringsSegments.map((id) => (
                      <Badge key={id} variant="outline">
                        Brings {segName(id)}
                      </Badge>
                    ))}
                  </div>
                  {o.localEvents && o.localEvents.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      Has played locally:{' '}
                      {o.localEvents.map((e) => `${e.venue} (${e.date})`).join(', ')}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Make it a night</CardTitle>
          <CardDescription>
            Taste-matched places near {brief.show.venue.name}, open before doors, with a drafted
            offer
          </CardDescription>
        </CardHeader>
        <CardContent>
          {brief.partnerDeals.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No matching places open before the show.
            </p>
          )}
          <ul className="flex flex-col gap-4 text-sm">
            {brief.partnerDeals.map((d) => (
              <li key={d.place.entityId} className="flex flex-col gap-1">
                <span className="inline-flex flex-wrap items-center gap-x-2 font-medium">
                  <StoreIcon className="size-3.5 text-muted-foreground" />
                  {d.place.name}
                  <span className="text-xs font-normal text-muted-foreground">
                    {Math.round(d.place.distanceM)} m away
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-normal text-muted-foreground">
                    <ClockIcon className="size-3" />
                    {d.place.hours}
                  </span>
                </span>
                <span>{d.offer}</span>
                <details className="text-muted-foreground">
                  <summary className="cursor-pointer text-xs">Outreach message</summary>
                  <p className="mt-1 whitespace-pre-line">{d.outreachMessage}</p>
                </details>
                <Badge variant="outline" className="self-start">
                  For {segName(d.segmentId)}
                </Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      {brief.streetTeam && brief.streetTeam.length > 0 && (
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Street team</CardTitle>
            <CardDescription>
              Walking routes from the venue past taste-matched places for posters and flyers
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            {brief.streetTeam.map((r) => (
              <div key={r.segmentId} className="flex flex-col gap-2 text-sm">
                <p className="font-medium">
                  {segName(r.segmentId)}
                  <span className="ml-2 inline-flex items-center gap-1 font-normal text-muted-foreground">
                    <FootprintsIcon className="size-3.5" />~{r.walkMinutes} min, {r.stops.length}{' '}
                    stops
                  </span>
                </p>
                <ol className="list-decimal pl-5 text-muted-foreground">
                  {r.stops.map((s) => (
                    <li key={s.entityId}>
                      {s.name} <span className="text-xs">({s.type})</span>
                    </li>
                  ))}
                </ol>
                <div className="flex flex-wrap gap-3 text-xs">
                  <a
                    className="inline-flex items-center gap-1 text-primary underline underline-offset-2"
                    href={walkingLink(brief.show.venue, r.stops)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MapIcon className="size-3" /> Open in Google Maps
                  </a>
                  <a
                    className="inline-flex items-center gap-1 text-primary underline underline-offset-2"
                    href={new URL(
                      `/runs/${runId}/street-team.gpx?segment=${r.segmentId}`,
                      API_BASE,
                    ).toString()}
                    download
                  >
                    <DownloadIcon className="size-3" /> GPX
                  </a>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
