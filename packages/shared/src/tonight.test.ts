import { describe, expect, it } from 'vitest';
import { isTheatre, sceneOf, tonightWindow, venueTypeOf } from './tonight.js';

// 2026-10-14 is a Wednesday.
const at = (iso: string) => new Date(iso);

describe('tonightWindow', () => {
  it('uses the city’s local date', () => {
    // 03:30 UTC Thursday is still Wednesday evening in Los Angeles.
    expect(tonightWindow('la', 'tonight', at('2026-10-15T03:30:00Z'))).toEqual({
      from: '2026-10-14',
      to: '2026-10-14',
    });
  });

  it('keeps last night’s late shows in “tonight” before 5 am', () => {
    // 02:00 in New York on Thursday.
    expect(tonightWindow('nyc', 'tonight', at('2026-10-15T06:00:00Z'))).toEqual({
      from: '2026-10-14',
      to: '2026-10-15',
    });
  });

  it('finds the weekend from midweek, and the current one from Saturday', () => {
    expect(tonightWindow('nyc', 'weekend', at('2026-10-14T16:00:00Z'))).toEqual({
      from: '2026-10-16',
      to: '2026-10-18',
    });
    expect(tonightWindow('nyc', 'weekend', at('2026-10-17T16:00:00Z'))).toEqual({
      from: '2026-10-17',
      to: '2026-10-18',
    });
  });

  it('covers tomorrow and the next seven days', () => {
    const now = at('2026-10-14T16:00:00Z');
    expect(tonightWindow('nola', 'tomorrow', now)).toEqual({
      from: '2026-10-15',
      to: '2026-10-15',
    });
    expect(tonightWindow('nola', 'week', now)).toEqual({ from: '2026-10-14', to: '2026-10-20' });
  });
});

describe('scenes, rooms and theatre', () => {
  it('maps Ticketmaster genres to scenes', () => {
    expect(sceneOf(['Jazz'])).toBe('jazz');
    expect(sceneOf(['Pop', 'Electro Pop'])).toBe('pop');
    expect(sceneOf(['Alternative', 'Indie Rock'])).toBe('indie');
    expect(sceneOf(['Hip-Hop/Rap'])).toBe('hiphop');
    expect(sceneOf(['Folk', 'Americana'])).toBe('folk');
    expect(sceneOf([])).toBe('other');
  });

  it('reads the room from the venue name', () => {
    expect(venueTypeOf('Birdland Theater')).toBe('jazz');
    expect(venueTypeOf("Lucinda's")).toBe('venue');
    expect(venueTypeOf('Bowery Ballroom')).toBe('hall');
    expect(venueTypeOf('Madison Square Garden')).toBe('arena');
    expect(venueTypeOf('Pete’s Candy Store Bar')).toBe('bar');
    expect(venueTypeOf('Zone One at Elsewhere')).toBe('club');
    expect(venueTypeOf('Brooklyn Bowl')).toBe('club');
    expect(venueTypeOf('Barclays Center')).toBe('arena');
    expect(venueTypeOf('Lehman Center for the Performing Arts')).toBe('hall');
  });

  it('drops theatre and musicals, keeps concerts in theatres', () => {
    expect(isTheatre({ name: 'Lost Boys Musical', genres: [] })).toBe(true);
    expect(isTheatre({ name: 'Hamilton', genres: ['Theatre'] })).toBe(true);
    expect(isTheatre({ name: 'MAMMA MIA! Bottomless Brunch', genres: [] })).toBe(true);
    expect(isTheatre({ name: 'Sylvan Esso', genres: ['Electronic'] })).toBe(false);
  });
});
