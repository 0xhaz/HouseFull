import { describe, expect, it } from 'vitest';
import { type SurveyRow, summarizeSurvey, surveyOptions } from './survey.js';

const segments = [
  {
    id: 's1',
    name: 'Bedroom Pop',
    seeds: [
      { entityId: 'a', name: 'Clairo' },
      { entityId: 'b', name: 'TV Girl' },
    ],
  },
  {
    id: 's2',
    name: 'Dream Pop',
    seeds: [
      { entityId: 'c', name: 'Crumb' },
      { entityId: 'a', name: 'Clairo' },
    ],
  },
];

const row = (r: Partial<SurveyRow>): SurveyRow => ({
  rating: 5,
  wouldReturn: true,
  heardVia: null,
  alsoLikes: [],
  tags: [],
  comment: null,
  sample: false,
  ...r,
});

describe('surveyOptions', () => {
  it('interleaves audiences and never repeats an artist', () => {
    expect(surveyOptions(segments).map((o) => `${o.segmentId}:${o.name}`)).toEqual([
      's1:Clairo',
      's2:Crumb',
      's1:TV Girl',
    ]);
  });
});

describe('summarizeSurvey', () => {
  const options = surveyOptions(segments);

  it('attributes respondents to audiences by the artists they tick', () => {
    const s = summarizeSurvey(options, segments, [
      row({ rating: 5, alsoLikes: ['a'] }),
      row({ rating: 4, alsoLikes: ['a', 'c'], wouldReturn: false }),
      row({ rating: 3, alsoLikes: ['c'] }),
      row({ rating: 2, alsoLikes: [] }),
      row({ rating: 4, alsoLikes: ['c'], heardVia: 'I was already a fan' }),
    ]);
    expect(s.responses).toBe(5);
    expect(s.enough).toBe(false);
    const by = Object.fromEntries(s.bySegment.map((x) => [x.segmentId, x]));
    expect(by.s1).toMatchObject({ responses: 2, avgRating: 4.5, wouldReturnPct: 50 });
    expect(by.s2).toMatchObject({ responses: 2, avgRating: 3.5 });
    // Ticked nothing, or already a fan → core.
    expect(s.coreFans).toMatchObject({ responses: 2, avgRating: 3 });
    // Best-rated audience first.
    expect(s.bySegment[0]?.segmentId).toBe('s1');
  });

  it('summarizes channels, tags, comments and sample data', () => {
    const s = summarizeSurvey(options, segments, [
      row({ heardVia: 'A podcast', tags: ['Great sound'], comment: ' Loved it ' }),
      row({ heardVia: 'A podcast', tags: ['Great sound', 'Great crowd'], sample: true }),
      row({ heardVia: 'TikTok' }),
    ]);
    expect(s.heardVia[0]).toEqual({ channel: 'A podcast', share: 0.67 });
    expect(s.tags[0]).toEqual({ tag: 'Great sound', count: 2 });
    expect(s.comments).toEqual(['Loved it']);
    expect(s.sample).toBe(true);
  });

  it('handles no responses', () => {
    const s = summarizeSurvey(options, segments, []);
    expect(s.overall).toEqual({ responses: 0, avgRating: null, wouldReturnPct: null });
  });
});
