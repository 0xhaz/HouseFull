import type { RunSummary } from '@housefull/shared';

/** Pure dashboard maths, safe in server and client components. */

const DAY = 86_400_000;

/** Whole days from today (UTC) to the show; negative once it's played. */
export function daysUntil(isoDate: string, now = new Date()): number {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((Date.parse(`${isoDate}T00:00:00Z`) - today) / DAY);
}

/**
 * Due now: the latest countdown step whose day has come (steps are "N days out").
 * A step 14 days out is due from day 14 until the next step.
 */
export function dueNow(run: RunSummary, days: number) {
  return [...run.schedule]
    .filter((s) => s.daysOut >= days)
    .sort((a, b) => a.daysOut - b.daysOut)[0];
}

/**
 * Needs attention: close to the show and still well short of full, or nothing measured yet
 * once the campaign should be running.
 */
export function attention(run: RunSummary, days: number): string | undefined {
  if (days < 0 || run.status !== 'done') return undefined;
  const sold = run.show.soldPct;
  if (sold !== undefined && days <= 21 && sold < 60) return `${sold}% sold, ${days} days out`;
  if (run.checkins === 0 && days <= 28) return 'No results checked in yet';
  if (run.disruptions > 0) return 'Transit or city disruption on show night';
  return undefined;
}

/** Counts how often each value appears across runs, most common first. */
export function tally(values: string[]): Array<{ value: string; count: number }> {
  const m = new Map<string, number>();
  for (const v of values) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}
