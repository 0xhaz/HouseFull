import { describe, expect, it } from 'vitest';
import {
  CODE_PATTERN,
  chooseDestination,
  clickDedupeHash,
  generateCode,
  isSafeTargetUrl,
} from './links.js';

describe('generateCode', () => {
  it('produces readable hf- codes', () => {
    for (let i = 0; i < 200; i++) expect(generateCode()).toMatch(CODE_PATTERN);
    expect(generateCode(4, () => new Uint8Array([0, 1, 2, 30]))).toBe('hf-234z');
  });
});

describe('clickDedupeHash', () => {
  const base = { ip: '203.0.113.7', userAgent: 'Mozilla/5.0', day: '2026-10-20', salt: 's3cret' };

  it('is stable within a day and changes across days and salts', () => {
    expect(clickDedupeHash(base)).toBe(clickDedupeHash({ ...base }));
    expect(clickDedupeHash(base)).not.toBe(clickDedupeHash({ ...base, day: '2026-10-21' }));
    expect(clickDedupeHash(base)).not.toBe(clickDedupeHash({ ...base, salt: 'other' }));
  });

  it('never contains the raw IP', () => {
    expect(clickDedupeHash(base)).not.toContain('203');
    expect(clickDedupeHash(base)).toHaveLength(32);
  });
});

describe('chooseDestination (decision #23)', () => {
  it('uses sign-up more than 21 days out', () => {
    expect(chooseDestination({ daysOut: 30, hasSignupPage: true })).toBe('signup');
    expect(chooseDestination({ daysOut: 21, hasSignupPage: true })).toBe('tickets');
  });

  it('uses sign-up for segments converting below the median', () => {
    expect(
      chooseDestination({
        daysOut: 10,
        segmentConversion: 0.01,
        medianConversion: 0.03,
        hasSignupPage: true,
      }),
    ).toBe('signup');
    expect(
      chooseDestination({
        daysOut: 10,
        segmentConversion: 0.05,
        medianConversion: 0.03,
        hasSignupPage: true,
      }),
    ).toBe('tickets');
  });

  it('always uses tickets when the promoter has no sign-up page', () => {
    expect(chooseDestination({ daysOut: 60, hasSignupPage: false })).toBe('tickets');
  });
});

describe('isSafeTargetUrl', () => {
  it('allows http(s) only', () => {
    expect(isSafeTargetUrl('https://www.ticketmaster.com/event/123')).toBe(true);
    expect(isSafeTargetUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeTargetUrl('data:text/html,hi')).toBe(false);
    expect(isSafeTargetUrl('/relative')).toBe(false);
  });
});
