import type { CampaignBrief } from '@housefull/shared';
import { describe, expect, it } from 'vitest';
import type { LlmAdapter } from './llm.js';
import {
  contactDetails,
  contactsFromBriefs,
  type DraftFacts,
  draftOutreach,
  emailLayout,
} from './outreach.js';

const ref = (entityId: string, name: string, type = 'urn:entity:artist') => ({
  entityId,
  name,
  type,
  sourceRef: 'call-1',
});

const brief = (date: string): CampaignBrief =>
  ({
    show: {
      artist: 'Men I Trust',
      venue: { name: 'Brooklyn Steel', lat: 40.7, lng: -73.9 },
      city: 'nyc',
      date,
      soldPct: 41,
      artistEntityId: 'a0',
    },
    segments: [
      {
        id: 's1',
        name: 'Bedroom Pop',
        seeds: [ref('a1', 'Clairo'), ref('a2', 'TV Girl')],
        channels: {
          podcasts: [ref('p1', 'Song Exploder', 'urn:entity:podcast')],
          partnerPlaces: [
            {
              ...ref('pl1', 'Pete’s Candy Store', 'urn:entity:place'),
              distanceM: 640,
              kind: 'bar',
            },
            { ...ref('pl2', 'Ink Tattoo', 'urn:entity:place'), distanceM: 300, kind: 'other' },
          ],
        },
      },
    ],
    openers: [
      { artist: ref('o1', 'Night Tapes'), bringsSegments: ['s1'], openerScore: 1, why: [] },
    ],
    partnerDeals: [
      {
        place: { ...ref('pl1', 'Pete’s Candy Store', 'urn:entity:place'), distanceM: 640 },
        segmentId: 's1',
        offer: 'a drink deal for ticket holders',
        outreachMessage: '',
      },
    ],
  }) as unknown as CampaignBrief;

describe('contactsFromBriefs', () => {
  it('collects places, acts and media once each, with reasons from every show', () => {
    const c = contactsFromBriefs([
      { runId: 'r1', brief: brief('2026-11-20') },
      { runId: 'r2', brief: brief('2026-10-16') },
    ]);
    expect(c.map((x) => [x.kind, x.name])).toEqual([
      ['place', 'Pete’s Candy Store'],
      ['act', 'Night Tapes'],
      ['media', 'Song Exploder'],
    ]);
    const bar = c[0];
    expect(bar?.shows.map((s) => s.runId)).toEqual(['r1', 'r2']);
    expect(bar?.reasons[0]).toContain('640 m from Brooklyn Steel');
    expect(bar?.suggestedOffer).toBe('a drink deal for ticket holders');
  });
});

describe('contactDetails', () => {
  it('maps Qloo properties to contact fields and a Google Maps link', () => {
    expect(
      contactDetails({
        address: '709 Lorimer St Brooklyn, NY 11211',
        phone: '+17183023770',
        website: 'http://www.petescandystore.com/',
        external: { google_place: { place_id: 'ChIJ5' }, instagram: { id: 'petes' } },
      }),
    ).toMatchObject({
      phone: '+17183023770',
      website: 'http://www.petescandystore.com/',
      instagram: 'https://www.instagram.com/petes',
      mapsUrl: 'https://www.google.com/maps/place/?q=place_id:ChIJ5',
    });
  });
});

const facts: DraftFacts = {
  sender: { workspace: 'Night Shift Presents', persona: 'promoter', profile: {} },
  show: { artist: 'Men I Trust', venue: 'Brooklyn Steel', city: 'nyc', date: '2026-11-20' },
  contact: { name: 'Pete’s Candy Store', kind: 'place', subtype: 'bar', reasons: ['640 m away'] },
  purpose: { id: 'cross-promo', label: 'Cross-promotion', brief: 'Swap promotion.' },
};
const llm = (out: unknown): LlmAdapter => ({
  name: 'fake',
  object: async () => out as never,
  text: async () => '',
});

describe('draftOutreach', () => {
  it('uses the model’s draft when it is clean', async () => {
    const d = await draftOutreach(
      facts,
      llm({ subject: ' Hello ', body: 'Hi there. [Your name]' }),
    );
    expect(d).toEqual({ subject: 'Hello', body: 'Hi there. [Your name]' });
  });

  it('never leaks sales numbers: falls back to the template', async () => {
    const d = await draftOutreach(
      facts,
      llm({ subject: 'Help', body: 'We are only 41% sold, please help.' }),
    );
    expect(d.body).not.toMatch(/41|sold/);
    expect(d.body).toContain('[Your name]');
    expect(d.subject).toContain('Cross-promotion');
  });

  it('works without a model', async () => {
    const d = await draftOutreach(facts, undefined);
    expect(d.body).toContain('Pete’s Candy Store');
    expect(d.body).toContain('Night Shift Presents');
  });
});

describe('emailLayout', () => {
  it('splits a one-block email into greeting, paragraphs and sign-off', () => {
    const out = emailLayout(
      'Hi Land to Sea team, I am reaching out from Brooklyn Steel. We share an audience. We would love to partner. Could we talk this week? Best, [Your name], Brooklyn Steel',
    );
    expect(out.split('\n\n')[0]).toBe('Hi Land to Sea team,');
    expect(out.endsWith('Best,\n[Your name]\nBrooklyn Steel')).toBe(true);
    expect(out.split('\n\n').length).toBeGreaterThanOrEqual(4);
  });

  it('leaves formatted emails alone', () => {
    expect(emailLayout('Hi,\n\nHello.')).toBe('Hi,\n\nHello.');
  });
});
