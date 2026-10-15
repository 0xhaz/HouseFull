import type { QlooEntity } from '@housefull/qloo-client';

/** Tag families that describe taste; instruments, influences and places are too specific to cluster on. */
const CLUSTER_TAG_TYPES = new Set([
  'urn:tag:genre:music',
  'urn:tag:genre:qloo',
  'urn:tag:music:qloo',
  'urn:tag:style:qloo',
  'urn:tag:audience:qloo',
]);
/** Families used to name a segment. */
const LABEL_TAG_TYPES = new Set(['urn:tag:genre:music', 'urn:tag:genre:qloo']);

type Tag = { id: string; name: string; type: string };

/** Spelling variants Qloo uses across tag families. */
const SYNONYMS: Record<string, string> = {
  'r & b': 'R&B',
  'rhythm & blues': 'R&B',
  rnb: 'R&B',
  'hip - hop': 'Hip-Hop',
  'hip hop': 'Hip-Hop',
  'lo fi': 'Lo-Fi',
};

/** Trims, fixes spacing, maps spelling variants and capitalizes lowercase names. */
export function cleanTagName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, ' ');
  const syn = SYNONYMS[name.toLowerCase()];
  if (syn) return syn;
  return name === name.toLowerCase() ? name.replace(/\b\w/g, (c) => c.toUpperCase()) : name;
}

/** Up to `n` names, skipping duplicates and names contained in one already picked ("Jazz" after "Jazz Fusion"). */
export function distinctNames(names: string[], n: number): string[] {
  const out: string[] = [];
  for (const raw of names) {
    const name = cleanTagName(raw);
    const lower = name.toLowerCase();
    if (out.some((o) => o.toLowerCase().includes(lower) || lower.includes(o.toLowerCase())))
      continue;
    out.push(name);
    if (out.length === n) break;
  }
  return out;
}

export function tagsOf(e: QlooEntity): Tag[] {
  return (e.tags ?? []).flatMap((t) => {
    const raw = t as Record<string, unknown>;
    const id = (raw.id ?? raw.tag_id) as string | undefined;
    const type = raw.type as string | undefined;
    return id && type && typeof raw.name === 'string' ? [{ id, name: raw.name, type }] : [];
  });
}

const features = (e: QlooEntity) =>
  new Set(
    tagsOf(e)
      .filter((t) => CLUSTER_TAG_TYPES.has(t.type))
      .map((t) => t.id),
  );

export function jaccardDistance(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  return 1 - inter / (a.size + b.size - inter);
}

export type Cluster = {
  members: QlooEntity[];
  /** Most distinctive genre names: frequent here, rarer across the whole ring. */
  label: string[];
  /** Distinctive taste tags, used for ad-interest suggestions and "why" claims. */
  distinctiveTags: Tag[];
};

/**
 * Groups next-ring artists into 2–3 taste segments with k-medoids on tag
 * Jaccard distance. Deterministic: farthest-first seeding from the
 * highest-affinity artist, so the same Qloo response gives the same segments.
 */
export function clusterRing(entities: QlooEntity[], maxK = 3): Cluster[] {
  const items = entities.map((e) => ({ e, f: features(e) }));
  const rich = items.filter((i) => i.f.size >= 5);
  const k = Math.max(1, Math.min(maxK, Math.floor(rich.length / 4)));
  if (rich.length === 0) return [{ members: entities, label: [], distinctiveTags: [] }];

  const dist = (a: Set<string>, b: Set<string>) => jaccardDistance(a, b);
  const byAffinity = [...rich].sort(
    (a, b) => (b.e.query?.affinity ?? 0) - (a.e.query?.affinity ?? 0),
  );
  const medoids = [byAffinity[0] as (typeof rich)[number]];
  while (medoids.length < k) {
    let best = rich[0] as (typeof rich)[number];
    let bestD = -1;
    for (const i of rich) {
      const d = Math.min(...medoids.map((m) => dist(i.f, m.f)));
      if (d > bestD) {
        bestD = d;
        best = i;
      }
    }
    medoids.push(best);
  }

  let groups: (typeof rich)[] = [];
  for (let iter = 0; iter < 10; iter++) {
    groups = medoids.map(() => []);
    for (const i of rich) {
      let gi = 0;
      for (let m = 1; m < medoids.length; m++)
        if (
          dist(i.f, (medoids[m] as (typeof rich)[number]).f) <
          dist(i.f, (medoids[gi] as (typeof rich)[number]).f)
        )
          gi = m;
      groups[gi]?.push(i);
    }
    let changed = false;
    groups.forEach((g, gi) => {
      if (g.length === 0) return;
      const cost = (c: (typeof rich)[number]) => g.reduce((s, o) => s + dist(c.f, o.f), 0);
      const next = g.reduce((best, c) => (cost(c) < cost(best) ? c : best));
      if (next !== medoids[gi]) {
        medoids[gi] = next;
        changed = true;
      }
    });
    if (!changed) break;
  }

  // Thin artists (few tags) join the nearest group instead of skewing medoids.
  for (const i of items.filter((x) => x.f.size < 5)) {
    let gi = 0;
    for (let m = 1; m < medoids.length; m++)
      if (
        dist(i.f, (medoids[m] as (typeof rich)[number]).f) <
        dist(i.f, (medoids[gi] as (typeof rich)[number]).f)
      )
        gi = m;
    groups[gi]?.push(i);
  }

  const overall = tagFrequency(entities);
  return groups
    .filter((g) => g.length > 0)
    .map((g) => {
      const members = g
        .map((i) => i.e)
        .sort((a, b) => (b.query?.affinity ?? 0) - (a.query?.affinity ?? 0));
      const freq = tagFrequency(members);
      const distinct = [...freq.values()]
        .map((t) => ({
          ...t,
          score: t.count / members.length - (overall.get(t.id)?.count ?? 0) / entities.length,
        }))
        .filter((t) => t.count >= Math.min(2, members.length))
        .sort((a, b) => b.score - a.score || b.count - a.count);
      const label = distinctNames(
        distinct.filter((t) => LABEL_TAG_TYPES.has(t.type)).map((t) => t.name),
        2,
      );
      return {
        members,
        label: label.length
          ? label
          : distinctNames(
              distinct.map((t) => t.name),
              2,
            ),
        distinctiveTags: distinct
          .slice(0, 12)
          .map(({ id, name, type }) => ({ id, name: cleanTagName(name), type })),
      };
    })
    .sort((a, b) => b.members.length - a.members.length);
}

function tagFrequency(entities: QlooEntity[]) {
  const m = new Map<string, Tag & { count: number }>();
  for (const e of entities)
    for (const t of tagsOf(e)) {
      if (!CLUSTER_TAG_TYPES.has(t.type)) continue;
      const cur = m.get(t.id);
      if (cur) cur.count += 1;
      else m.set(t.id, { ...t, count: 1 });
    }
  return m;
}
