import {
  clusterRing,
  type GeoStore,
  segmentReach,
  showNightDisruptions,
  toRef,
} from '@housefull/agent';
import type { Ticketmaster } from '@housefull/events';
import type { QlooClient } from '@housefull/qloo-client';
import { CITY_META, type City, CitySchema, type ShowInput } from '@housefull/shared';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { CheckinsService } from '../runs/checkins.service.js';
import type { RunsService } from '../runs/runs.service.js';

export type ToolDeps = {
  qloo: QlooClient;
  geo: GeoStore;
  ticketmaster: Ticketmaster;
  runs: RunsService;
  checkins: CheckinsService;
  ipHash: string;
  webUrl: string;
};

const text = (data: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
});
const fail = (message: string) => ({
  content: [{ type: 'text' as const, text: message }],
  isError: true,
});
const city = CitySchema.describe('Launch city: nyc, nola or la');
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .describe('Show date, YYYY-MM-DD');

/**
 * HouseFull's tools over MCP. The Qloo key stays on this server; every result
 * carries the Qloo call ids it came from (`sourceRef`), like the web brief.
 */
export function buildMcpServer(d: ToolDeps): McpServer {
  const server = new McpServer({ name: 'housefull', version: '0.1.0' });
  const ctx = { ipHash: d.ipHash };

  const resolve = async (name: string) => {
    const r = await d.qloo.search({ query: name, types: ['urn:entity:artist'], take: 5 }, ctx);
    const hit =
      r.data.results.find((e) => e.name.toLowerCase() === name.trim().toLowerCase()) ??
      r.data.results[0];
    return hit ? toRef(hit, r.meta.callId) : undefined;
  };
  const resolveMany = async (names: string[]) =>
    (await Promise.all(names.slice(0, 6).map(resolve))).filter((x) => x !== undefined);

  server.registerTool(
    'resolve_artist',
    {
      title: 'Resolve artist',
      description: 'Find an artist in Qloo by name. Returns the Qloo entity id other tools accept.',
      inputSchema: { name: z.string().min(1) },
      annotations: { readOnlyHint: true },
    },
    async ({ name }) => {
      const a = await resolve(name);
      return a ? text(a) : fail(`Qloo has no artist matching "${name}"`);
    },
  );

  server.registerTool(
    'next_ring_audiences',
    {
      title: 'Next-ring audiences',
      description:
        "People who like similar things but don't follow this artist yet, grouped into 2-3 taste segments with seed artists.",
      inputSchema: { artist: z.string().min(1).describe('Artist name') },
      annotations: { readOnlyHint: true },
    },
    async ({ artist }) => {
      const a = await resolve(artist);
      if (!a) return fail(`Qloo has no artist matching "${artist}"`);
      const ring = await d.qloo.insights(
        {
          filterType: 'urn:entity:artist',
          signal: { entities: [a.entityId] },
          filter: { excludeEntities: [a.entityId] },
          take: 30,
        },
        ctx,
      );
      const segments = clusterRing(ring.data.results.entities ?? []).map((c, i) => ({
        id: `s${i + 1}`,
        name: c.label.join(' & ') || `Segment ${i + 1}`,
        seedArtists: c.members.slice(0, 4).map((m) => m.name),
        tasteTags: c.distinctiveTags.slice(0, 6).map((t) => t.name),
        sourceRef: ring.meta.callId,
      }));
      return text({ artist: a.name, segments });
    },
  );

  /** A segment's reach without a full run: city-center travel times unless a venue is given. */
  const reach = async (
    artists: string[],
    c: City,
    venue?: { lat: number; lng: number; name?: string },
  ) => {
    const seeds = await resolveMany(artists);
    if (seeds.length === 0) throw new Error('None of those artists were found in Qloo');
    const [lng, lat] = venue ? [venue.lng, venue.lat] : CITY_META[c].center;
    const show: ShowInput = {
      artist: seeds[0]?.name ?? 'artist',
      venue: { name: venue?.name ?? `${CITY_META[c].name} center`, lat, lng },
      city: c,
      date: new Date().toISOString().slice(0, 10),
    };
    const [bbox, baseline, access] = await Promise.all([
      d.geo.cityBbox(c),
      d.geo.baseline(c),
      d.geo.access(c, lng, lat),
    ]);
    const warnings: string[] = [];
    const step = async <T>(_: unknown, fn: () => Promise<{ value: T; summary: string }>) =>
      (await fn()).value;
    const deps = {
      runId: 'mcp',
      qloo: d.qloo,
      geo: d.geo,
      ticketmaster: d.ticketmaster,
      ipHash: d.ipHash,
      emit: () => {},
    };
    const r = await segmentReach(
      'mcp',
      seeds.map((s) => s.entityId),
      { show, bbox, baseline, access, deps, step, warn: (w) => warnings.push(w) },
    );
    return { seeds: seeds.map((s) => s.name), reach: r, warnings, from: show.venue.name };
  };

  server.registerTool(
    'audience_geography',
    {
      title: 'Audience geography',
      description:
        'Neighborhoods where fans of these artists over-index versus normal nightlife (lift), with travel minutes to the venue or city center.',
      inputSchema: {
        artists: z
          .array(z.string())
          .min(1)
          .max(6)
          .describe('Seed artist names (e.g. from next_ring_audiences)'),
        city,
        venue_lat: z.number().optional(),
        venue_lng: z.number().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ artists, city: c, venue_lat, venue_lng }) => {
      const venue =
        venue_lat !== undefined && venue_lng !== undefined
          ? { lat: venue_lat, lng: venue_lng, name: 'the venue' }
          : undefined;
      const r = await reach(artists, c, venue);
      return text({
        seeds: r.seeds,
        travelFrom: r.from,
        neighborhoods: r.reach.neighborhoods,
        sourceCities: r.reach.sourceCities,
        claims: r.reach.claims,
        warnings: r.warnings,
      });
    },
  );

  server.registerTool(
    'audience_channels',
    {
      title: 'Audience channels',
      description:
        'Podcasts, TV shows, brands and nearby places that fans of these artists over-index on.',
      inputSchema: { artists: z.array(z.string()).min(1).max(6), city },
      annotations: { readOnlyHint: true },
    },
    async ({ artists, city: c }) => {
      const r = await reach(artists, c);
      const names = (xs: Array<{ name: string; sourceRef: string }>) =>
        xs.map((x) => ({ name: x.name, sourceRef: x.sourceRef }));
      return text({
        seeds: r.seeds,
        podcasts: names(r.reach.channels.podcasts),
        tvShows: names(r.reach.channels.tvShows),
        brands: names(r.reach.channels.brands),
      });
    },
  );

  server.registerTool(
    'same_night_conflicts',
    {
      title: 'Same-night conflicts',
      description:
        'Other evening music events near the venue that night (Ticketmaster), nearest first.',
      inputSchema: { venue_lat: z.number(), venue_lng: z.number(), date: isoDate },
      annotations: { readOnlyHint: true },
    },
    async ({ venue_lat, venue_lng, date }) => {
      const r = await d.ticketmaster.conflicts({ lat: venue_lat, lng: venue_lng, date });
      return r.available ? text({ events: r.events, source: r.source }) : fail(r.reason);
    },
  );

  server.registerTool(
    'show_night_disruptions',
    {
      title: 'Show-night disruptions (NYC)',
      description:
        'Subway alerts on lines serving the venue and permitted street events within 1 km, doors to 1am.',
      inputSchema: {
        venue_name: z.string(),
        venue_lat: z.number(),
        venue_lng: z.number(),
        date: isoDate,
      },
      annotations: { readOnlyHint: true },
    },
    async ({ venue_name, venue_lat, venue_lng, date }) => {
      const show: ShowInput = {
        artist: '-',
        venue: { name: venue_name, lat: venue_lat, lng: venue_lng },
        city: 'nyc',
        date,
      };
      const deps = {
        runId: 'mcp',
        qloo: d.qloo,
        geo: d.geo,
        ticketmaster: d.ticketmaster,
        emit: () => {},
      };
      const r = await showNightDisruptions({ show, segments: [] } as never, deps);
      return text(r);
    },
  );

  server.registerTool(
    'plan_campaign',
    {
      title: 'Plan a campaign',
      description:
        'Run the full HouseFull agent for a booked show: next-ring audiences, neighborhoods, channels, openers, partners, ' +
        'ad copy and a schedule, with every claim sourced. Takes 30-60 seconds for a new show; presets return instantly.',
      inputSchema: {
        preset_id: z
          .string()
          .optional()
          .describe('One of the demo presets, e.g. nyc-brooklyn-steel'),
        artist: z.string().optional(),
        venue_name: z.string().optional(),
        venue_lat: z.number().optional(),
        venue_lng: z.number().optional(),
        city: city.optional(),
        date: isoDate.optional(),
        sold_pct: z.number().min(0).max(100).optional(),
      },
    },
    async (a) => {
      let input: ShowInput;
      try {
        input = a.preset_id
          ? d.runs.resolveInput({ presetId: a.preset_id })
          : d.runs.resolveInput({
              show: {
                artist: a.artist ?? '',
                venue: {
                  name: a.venue_name ?? '',
                  lat: a.venue_lat ?? Number.NaN,
                  lng: a.venue_lng ?? Number.NaN,
                },
                city: a.city ?? 'nyc',
                date: a.date ?? '',
                ...(a.sold_pct !== undefined ? { soldPct: a.sold_pct } : {}),
              },
            });
      } catch {
        return fail('Pass preset_id, or artist + venue_name + venue_lat + venue_lng + city + date');
      }
      const { runId } = await d.runs.create(input, d.ipHash, { preset: Boolean(a.preset_id) });
      const run = await d.runs.runToCompletion(runId);
      const b = run.result as import('@housefull/shared').CampaignBrief | null;
      if (run.status !== 'done' || !b) return fail(`Run ${runId} ended ${run.status}`);
      return text({
        runId,
        briefUrl: `${d.webUrl}/runs/${runId}/brief`,
        summary: b.summary,
        venueFit: b.venueFit.score,
        segments: b.segments.map((s) => ({
          id: s.id,
          name: s.name,
          fansOf: s.seeds.map((x) => x.name),
          neighborhoods: s.neighborhoods.slice(0, 3),
          podcasts: s.channels.podcasts.slice(0, 3).map((p) => p.name),
          sampleCopy: s.copy[0],
        })),
        openers: b.openers.map((o) => o.artist.name),
        partners: b.partnerDeals.map((p) => ({ place: p.place.name, offer: p.offer })),
        conflicts: b.conflicts,
        critic: { passed: b.critic.passed, claimsChecked: true },
      });
    },
  );

  server.registerTool(
    'campaign_checkin',
    {
      title: 'Campaign check-in',
      description:
        'Report results per segment (clicks, sales, spend) for a plan, get the scoreboard, and optionally re-plan into a new brief version.',
      inputSchema: {
        run_id: z.string().uuid(),
        results: z
          .array(
            z.object({
              segment_id: z.string().regex(/^s\d+$/),
              clicks: z.number().int().nonnegative().optional(),
              sales: z.number().int().nonnegative().optional(),
              spend_usd: z.number().nonnegative().optional(),
            }),
          )
          .min(1),
        replan: z.boolean().optional(),
      },
    },
    async ({ run_id, results, replan }) => {
      const r = await d.checkins.add(run_id, {
        bySegment: results.map((x) => ({
          segmentId: x.segment_id,
          clicks: x.clicks,
          sales: x.sales,
          spendUsd: x.spend_usd,
        })),
      });
      if (!replan) return text({ scoreboard: r.scoreboard, unmatched: r.unmatched });
      try {
        const re = await d.checkins.replan(run_id, false);
        return text({
          version: re.version,
          changes: re.result.changes,
          summary: re.result.summary,
          briefUrl: `${d.webUrl}/runs/${run_id}/brief?v=${re.version}`,
        });
      } catch (e) {
        return text({
          scoreboard: r.scoreboard,
          replan: `Not re-planned: ${(e as Error).message}`,
        });
      }
    },
  );

  return server;
}
