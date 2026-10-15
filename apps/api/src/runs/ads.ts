import type { AdExport, CampaignBrief } from '@housefull/shared';

/** Meta's smallest drop-pin radius is 1 mile; use it so pins stay neighborhood-sized. */
const PIN_RADIUS_KM = 1.6;

export const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);

/** Ad set name: `hf-<segment>` first, so a Meta results export maps back to the segment (F9b). */
export const adSetName = (segmentId: string, segmentName: string, platform: string) =>
  `hf-${segmentId}-${slug(segmentName)}-${platform}`;

export function buildAdExport(
  brief: CampaignBrief,
  platform: 'meta' | 'tiktok',
  points: Map<string, { lng: number; lat: number }>,
): AdExport[] {
  return brief.segments.map((s) => ({
    segmentId: s.id,
    platform,
    interests: s.channels.adTargeting.interests,
    zipCodes: [],
    pins: s.neighborhoods.flatMap((n) => {
      const p = points.get(n.name);
      return p
        ? [
            {
              name: n.name,
              lat: Math.round(p.lat * 1e5) / 1e5,
              lng: Math.round(p.lng * 1e5) / 1e5,
              radiusKm: PIN_RADIUS_KM,
            },
          ]
        : [];
    }),
    variants: s.copy,
  }));
}

const cell = (v: string | number) => {
  const t = String(v);
  return /[",\n]/.test(t) ? `"${t.replaceAll('"', '""')}"` : t;
};

/** One row per segment × ad variant: ready to paste into Ads Manager bulk import or hand to a media buyer. */
export function adExportCsv(brief: CampaignBrief, exports: AdExport[]): string {
  const header = [
    'Ad set name',
    'Platform',
    'Segment',
    'Suggested interests (verify in Ads Manager)',
    'Locations (lat,lng,radius km)',
    'Variant',
    'Headline',
    'Primary text',
    'Call to action',
  ];
  const rows = exports.flatMap((e) => {
    const seg = brief.segments.find((s) => s.id === e.segmentId);
    const locations = (e.pins ?? [])
      .map((p) => `${p.name} (${p.lat},${p.lng},${p.radiusKm})`)
      .join('; ');
    return e.variants.map((v, i) => [
      adSetName(e.segmentId, seg?.name ?? e.segmentId, e.platform),
      e.platform,
      seg?.name ?? e.segmentId,
      e.interests.join('; '),
      locations,
      String.fromCharCode(65 + i),
      v.headline,
      v.body,
      v.cta,
    ]);
  });
  return [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
}
