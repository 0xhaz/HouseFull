import { adExportCsv, adSetName, buildAdExport } from './ads.js';

const brief = {
  show: { city: 'nyc' },
  segments: [
    {
      id: 's1',
      name: 'Bedroom Pop & Lo-Fi',
      neighborhoods: [{ name: 'Greenpoint', lift: 1.2, accessMin: 20 }],
      channels: { adTargeting: { interests: ['Bedroom Pop', 'Lo-Fi'] } },
      copy: [
        {
          headline: 'Into "Clairo"?',
          body: 'See them, live, at Brooklyn Steel.',
          cta: 'Get tickets',
        },
      ],
    },
  ],
} as never;

describe('ad export', () => {
  it('names ad sets hf-<segment> so Meta results map back', () => {
    expect(adSetName('s1', 'Bedroom Pop & Lo-Fi', 'meta')).toBe('hf-s1-bedroom-pop-lo-fi-meta');
    expect(adSetName('s1', 'x', 'meta')).toMatch(/\bhf-(s\d+)\b/);
  });

  it('builds pins and an escaped CSV', () => {
    const ex = buildAdExport(
      brief,
      'meta',
      new Map([['Greenpoint', { lng: -73.951234567, lat: 40.73012345 }]]),
    );
    expect(ex[0]?.pins).toEqual([
      { name: 'Greenpoint', lat: 40.73012, lng: -73.95123, radiusKm: 1.6 },
    ]);
    const csv = adExportCsv(brief, ex);
    const [header, row] = csv.split('\r\n');
    expect(header).toContain('Suggested interests');
    expect(row).toContain('hf-s1-bedroom-pop-lo-fi-meta');
    expect(row).toContain('"Into ""Clairo""?"');
    expect(row).toContain('"See them, live, at Brooklyn Steel."');
  });
});
