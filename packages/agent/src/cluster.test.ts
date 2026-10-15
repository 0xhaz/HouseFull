import { describe, expect, it } from 'vitest';
import { clusterRing, jaccardDistance } from './cluster.js';
import { syntheticRing } from './testkit.js';

describe('jaccardDistance', () => {
  it('is 0 for equal sets and 1 for disjoint ones', () => {
    expect(jaccardDistance(new Set(['a', 'b']), new Set(['a', 'b']))).toBe(0);
    expect(jaccardDistance(new Set(['a']), new Set(['b']))).toBe(1);
  });
});

describe('clusterRing', () => {
  it('separates two taste groups and labels them by distinctive genres', () => {
    const clusters = clusterRing(syntheticRing());
    expect(clusters.length).toBeGreaterThanOrEqual(2);
    const jazz = clusters.find((c) => c.members.some((m) => m.entity_id === 'SYN-Jazz-0'));
    const psych = clusters.find((c) => c.members.some((m) => m.entity_id === 'SYN-Psych-0'));
    expect(jazz).not.toBe(psych);
    expect(jazz?.members.every((m) => !m.entity_id.startsWith('SYN-Psych'))).toBe(true);
    expect(jazz?.label.join(' ')).toMatch(/Jazz|Soul|Funk/);
    expect(psych?.label.join(' ')).toMatch(/Psychedelic|Garage|Surf/);
    // Shared tags aren't distinctive, so they never become labels.
    for (const c of clusters) expect(c.label).not.toContain('Instrumental');
  });

  it('puts thin artists in the nearest group and is deterministic', () => {
    const a = clusterRing(syntheticRing());
    const b = clusterRing(syntheticRing());
    expect(a.map((c) => c.members.map((m) => m.entity_id))).toEqual(
      b.map((c) => c.members.map((m) => m.entity_id)),
    );
    const thinHome = a.find((c) => c.members.some((m) => m.entity_id === 'SYN-THIN'));
    expect(thinHome?.members.some((m) => m.entity_id === 'SYN-Jazz-0')).toBe(true);
  });
});

describe('label cleanup', () => {
  it('maps spelling variants and skips contained names', async () => {
    const { cleanTagName, distinctNames } = await import('./cluster.js');
    expect(cleanTagName(' psychedelic  rock')).toBe('Psychedelic Rock');
    expect(cleanTagName('Rhythm & Blues')).toBe('R&B');
    expect(distinctNames(['Jazz Fusion', 'Jazz', 'R & B', 'Rhythm & Blues', 'Soul'], 3)).toEqual([
      'Jazz Fusion',
      'R&B',
      'Soul',
    ]);
  });
});
