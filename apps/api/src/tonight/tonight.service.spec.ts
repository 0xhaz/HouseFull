import { describe, expect, it } from 'vitest';
import { norm, tasteScores } from './tonight.service.js';

describe('tasteScores', () => {
  it('lets a smaller act close to your taste beat a famous, merely compatible one', () => {
    const s = tasteScores([
      // Real values for a Clairo fan, Oct 14.
      { id: 'harry-styles', affinity: 0.929, popularity: 0.998 },
      { id: 'buddha-trixie', affinity: 0.853, popularity: 0.355 },
      { id: 'sylvan-esso', affinity: 0.847, popularity: 0.99 },
      { id: 'seun-kuti', affinity: 0.73, popularity: 0.817 },
    ]);
    expect(s.get('buddha-trixie')).toBe(99);
    expect(s.get('harry-styles')).toBeGreaterThan(s.get('sylvan-esso') ?? 0);
    expect(s.get('seun-kuti')).toBe(0);
  });

  it('handles a single result', () => {
    expect(tasteScores([{ id: 'a', affinity: 0.5, popularity: 0.5 }]).get('a')).toBe(99);
  });
});

describe('norm', () => {
  it('matches names across punctuation and accents', () => {
    expect(norm('Tipitina’s')).toBe(norm("Tipitina's"));
    expect(norm('Beyoncé')).toBe(norm('Beyonce'));
  });
});
