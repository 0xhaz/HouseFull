import type { Persona, WorkspaceProfile } from '@housefull/shared';
import { PRESETS } from '../shows/presets.js';

const nyc = PRESETS.find((p) => p.id === 'nyc-brooklyn-steel')?.show;

/**
 * Public, no-sign-in workspaces for judges. Each sees the finished demo runs that match its
 * profile (the presets, a venue, an artist) plus anything planned inside it.
 */
export const DEMO_WORKSPACES: Array<{
  slug: string;
  name: string;
  persona: Persona;
  profile: WorkspaceProfile;
}> = [
  {
    slug: 'demo-promoter',
    name: 'Night Shift Presents (demo)',
    persona: 'promoter',
    profile: { cities: ['nyc', 'nola', 'la'] },
  },
  {
    slug: 'demo-venue',
    name: 'Brooklyn Steel (demo)',
    persona: 'venue',
    profile: nyc ? { venue: { ...nyc.venue, city: 'nyc' } } : {},
  },
  {
    slug: 'demo-artist',
    name: 'Men I Trust tour team (demo)',
    persona: 'artist',
    profile: { artist: 'Men I Trust' },
  },
];
