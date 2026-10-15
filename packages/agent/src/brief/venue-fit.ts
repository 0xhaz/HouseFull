import { access as accessScore, centroid, haversineKm, liftCells } from '@housefull/geo';
import type { Claim, RunResult } from '@housefull/shared';
import type { AgentDeps } from '../deps.js';

/** Weights for the 0–100 fit score (F3). Geography dominates: Qloo's location tags describe ambience, not music. */
export const FIT_WEIGHTS = { local: 0.5, access: 0.35, mood: 0.15 } as const;
const LOCAL_RADIUS_KM = 1.5;

export type VenueFit = { score: number; reasons: Claim[]; diagnosis: string };

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/**
 * Venue fit:
 *  - local: the artist's lift (vs typical nightlife) within 1.5 km of the venue;
 *  - access: how reachable each segment's top neighborhoods are;
 *  - mood: venue ambience tags (Qloo, by location) that match the artist's taste tags by name.
 */
export async function venueFit(result: RunResult, deps: AgentDeps): Promise<VenueFit> {
  const { show, artist } = result;
  const ctx = { runId: deps.runId, ipHash: deps.ipHash };
  const venue = { lat: show.venue.lat, lng: show.venue.lng };
  const [bbox, baseline] = await Promise.all([
    deps.geo.cityBbox(show.city),
    deps.geo.baseline(show.city),
  ]);
  const [heat, venueTags] = await Promise.all([
    deps.qloo.insights(
      {
        filterType: 'urn:heatmap',
        signal: { entities: [artist.entityId] },
        filter: { location: bbox },
      },
      ctx,
    ),
    deps.qloo.insights(
      { filterType: 'urn:tag', signal: { location: `POINT(${venue.lng} ${venue.lat})` }, take: 30 },
      ctx,
    ),
  ]);

  // Local interest around the venue, baseline-weighted.
  const cells = liftCells(
    (heat.data.results.heatmap ?? []).map((c) => ({
      geohash: c.location.geohash,
      affinity: c.query.affinity,
    })),
    baseline,
  );
  let num = 0;
  let den = 0;
  for (const c of cells) {
    const [lng, lat] = centroid(c.geohash);
    if (haversineKm(venue, { lat, lng }) > LOCAL_RADIUS_KM) continue;
    num += c.lift * c.baseline;
    den += c.baseline;
  }
  const localLift = den > 0 ? num / den : undefined;
  const local = localLift === undefined ? 0.5 : clamp01((localLift - 0.5) / 1);

  // Reachability of each segment's top three neighborhoods.
  const tops = result.segments.flatMap((s) => s.neighborhoods.slice(0, 3));
  const access = tops.length
    ? tops.reduce((s, n) => s + accessScore(n.accessMin, result.access.mode), 0) / tops.length
    : 0.5;
  const medianMin = tops.length
    ? [...tops].sort((a, b) => a.accessMin - b.accessMin)[Math.floor(tops.length / 2)]?.accessMin
    : undefined;

  // Mood: ambience words shared with the artist's taste tags ("Intimate", "Energetic"…).
  const ambience = (venueTags.data.results.tags ?? [])
    .filter((t) => ((t.tag_id ?? t.id) as string).includes(':ambience:'))
    .map((t) => t.name);
  const artistTags = new Set(result.core.tags.map((t) => t.name.toLowerCase()));
  const shared = ambience.filter((a) => artistTags.has(a.toLowerCase()));
  const mood = ambience.length ? clamp01(shared.length / Math.min(3, ambience.length)) : 0.5;

  const score = Math.round(
    100 * (FIT_WEIGHTS.local * local + FIT_WEIGHTS.access * access + FIT_WEIGHTS.mood * mood),
  );

  const reasons: Claim[] = [];
  if (localLift !== undefined)
    reasons.push({
      text: `Around the venue, interest in ${artist.name} runs at ${localLift.toFixed(2)}× typical nightlife`,
      sourceRef: heat.meta.callId,
    });
  const peak = result.segments[0]?.neighborhoods[0];
  if (peak && medianMin !== undefined)
    reasons.push({
      text: `The audience peaks in ${peak.name}, ${peak.accessMin} min from the venue; top areas are a median ${medianMin} min away`,
      sourceRef:
        result.segments[0]?.why.find((c) => c.text.includes(peak.name))?.sourceRef ??
        heat.meta.callId,
    });
  if (shared.length)
    reasons.push({
      text: `The venue's ambience (${shared.join(', ')}) matches the artist's taste profile`,
      sourceRef: venueTags.meta.callId,
    });

  const weakest = [
    ['local', local],
    ['access', access],
    ['mood', mood],
  ].sort((a, b) => (a[1] as number) - (b[1] as number))[0]?.[0];
  const diagnosis =
    score >= 70
      ? `Good fit: the audience is nearby and the room suits the artist.`
      : weakest === 'access' && peak
        ? `Reach is the risk: the audience peaks in ${peak.name}, ${peak.accessMin} min away, so lead with travel-easy messaging.`
        : weakest === 'local'
          ? `Interest right around the venue is below typical nightlife, so the campaign has to pull fans in from further out.`
          : `The room's vibe is a looser match for this artist; lean on the music in the creative.`;
  return { score, reasons, diagnosis };
}
