import { describe, expect, it } from 'vitest';
import { parseMetaAdsCsv, scoreSegments } from './checkins.js';

describe('parseMetaAdsCsv', () => {
  it('maps hf-<segment> ad sets and sums rows', () => {
    const csv = [
      '﻿Reporting starts,Ad set name,Amount spent (USD),Link clicks,Purchases',
      '2026-10-20,"hf-s1 · Bedroom Pop, NYC",120.50,300,4',
      '2026-10-21,hf-s1 retarget,"1,000.00",50,1',
      '2026-10-20,hf-s2 Dream Pop,80,90,',
      '2026-10-20,Brand awareness,40,10,0',
      ',Total,,,',
    ].join('\r\n');
    const { results, unmatched } = parseMetaAdsCsv(csv);
    expect(results).toEqual([
      { segmentId: 's1', clicks: 350, sales: 5, spendUsd: 1120.5 },
      { segmentId: 's2', clicks: 90, sales: 0, spendUsd: 80 },
    ]);
    expect(unmatched).toEqual(['Brand awareness']);
  });

  it('fails clearly without an ad set column', () => {
    expect(() => parseMetaAdsCsv('Campaign,Spend\nx,1')).toThrow(/Ad set name/);
  });
});

describe('scoreSegments', () => {
  const at = (d: string) => new Date(d);

  it('is not ready on thin data', () => {
    const s = scoreSegments(
      ['s1', 's2'],
      [
        {
          source: 'links',
          at: at('2026-10-20'),
          bySegment: [
            { segmentId: 's1', clicks: 60 },
            { segmentId: 's2', clicks: 10 },
          ],
        },
      ],
    );
    expect(s.ready).toBe(false);
    expect(s.reason).toContain('fewest clicks 10');
  });

  it('ranks by clicks per $ as an early signal, combining sources without double counting', () => {
    const s = scoreSegments(
      ['s1', 's2'],
      [
        {
          source: 'links',
          at: at('2026-10-20'),
          bySegment: [
            { segmentId: 's1', clicks: 70 },
            { segmentId: 's2', clicks: 200 },
          ],
        },
        {
          source: 'meta_csv',
          at: at('2026-10-21'),
          bySegment: [
            { segmentId: 's1', clicks: 80, spendUsd: 100 },
            { segmentId: 's2', clicks: 150, spendUsd: 100 },
          ],
        },
      ],
    );
    expect(s).toMatchObject({ ready: true, earlySignal: true });
    expect(s.segments.map((x) => [x.segmentId, x.clicks, x.metricLabel])).toEqual([
      ['s2', 200, 'clicks per $'],
      ['s1', 80, 'clicks per $'],
    ]);
  });

  it('switches to cost per sale with 5+ sales and keeps the latest entry per source', () => {
    const s = scoreSegments(
      ['s1', 's2'],
      [
        {
          source: 'manual',
          at: at('2026-10-20'),
          bySegment: [{ segmentId: 's1', sales: 1, spendUsd: 100 }],
        },
        {
          source: 'manual',
          at: at('2026-10-22'),
          bySegment: [
            { segmentId: 's1', sales: 2, spendUsd: 100 },
            { segmentId: 's2', sales: 4, spendUsd: 100 },
          ],
        },
      ],
    );
    expect(s).toMatchObject({ ready: true, earlySignal: false });
    expect(s.segments.map((x) => [x.segmentId, x.metric])).toEqual([
      ['s2', 25],
      ['s1', 50],
    ]);
  });

  it('leaves segments without results out of the ranking', () => {
    const s = scoreSegments(
      ['s1', 's2', 's3'],
      [
        {
          source: 'manual',
          at: at('2026-10-22'),
          bySegment: [
            { segmentId: 's1', sales: 2, spendUsd: 100 },
            { segmentId: 's2', sales: 4, spendUsd: 100 },
          ],
        },
      ],
    );
    expect(s.missing).toEqual(['s3']);
    expect(s.segments.map((x) => x.segmentId)).toEqual(['s2', 's1']);
    expect(s.segments[0]?.metricLabel).toBe('cost per sale');
  });

  it('ranks spend without sales last with a finite metric', () => {
    const s = scoreSegments(
      ['s1', 's2'],
      [
        {
          source: 'manual',
          at: at('2026-10-22'),
          bySegment: [
            { segmentId: 's1', sales: 0, spendUsd: 110 },
            { segmentId: 's2', sales: 6, spendUsd: 120 },
          ],
        },
      ],
    );
    expect(s.segments.map((x) => x.segmentId)).toEqual(['s2', 's1']);
    expect(Number.isFinite(s.segments[1]?.metric)).toBe(true);
  });
});
