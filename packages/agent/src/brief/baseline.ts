import type { ShowInput } from '@housefull/shared';
import type { AgentDeps } from '../deps.js';

/**
 * The "Without Qloo" panel: the same request to the same model with no Qloo data
 * and no tools, so judges can compare it with the sourced brief.
 */
export async function withoutQloo(show: ShowInput, deps: AgentDeps): Promise<string | undefined> {
  if (!deps.llm) return undefined;
  return deps.llm.text({
    tier: 'fast',
    system:
      'You are a marketing assistant for concert promoters. Answer in under 250 words, as a short list.',
    prompt:
      `Ticket sales are slow for ${show.artist} at ${show.venue.name} on ${show.date}` +
      `${show.soldPct !== undefined ? ` (${show.soldPct}% sold)` : ''}. ` +
      'Who should we target to find new buyers, which neighborhoods, and which channels?',
  });
}
