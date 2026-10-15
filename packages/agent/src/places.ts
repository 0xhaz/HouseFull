import type { QlooEntity } from '@housefull/qloo-client';

/** Ordered: the first match wins, so "cocktail bar" is a bar, not a restaurant. */
const KINDS: Array<[kind: string, pattern: RegExp]> = [
  // Other venues first: a concert hall with a bar is a competitor, not a partner.
  ['venue', /concert_hall|event_venue|performing_arts|theater|theatre|arena|nightclub/],
  ['record store', /record|vinyl|music_store/],
  ['bar', /\bbar\b|:bar\b|cocktail|brewery|brewpub|pub\b|wine_bar|beer|lounge|speakeasy/],
  ['cafe', /cafe|coffee|bakery|tea_house/],
  ['restaurant', /restaurant|pizza|taco|ramen|bistro|diner|eatery/],
];

/** Coarse kind from Qloo place tags (ids look like urn:tag:genre:place:restaurant:bar). */
export function placeKind(e: QlooEntity): string {
  const haystack = (e.tags ?? [])
    .map(
      (t) =>
        `${(t as Record<string, unknown>).id ?? (t as Record<string, unknown>).tag_id ?? ''} ${t.name ?? ''}`,
    )
    .join(' ')
    .toLowerCase();
  // Some venues carry only bar tags; their names give them away ("Warsaw Concerts", "Music Hall").
  if (
    /\b(concerts?|music hall|ballroom|arena|theat(er|re)|amphitheat(er|re)|auditorium)\b/i.test(
      e.name,
    )
  )
    return 'venue';
  for (const [kind, re] of KINDS) if (re.test(haystack)) return kind;
  return 'other';
}

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

type Slot = { opens?: string; closes?: string; closed?: boolean };

/** Opening hours on the show's weekday from Qloo's `properties.hours`, e.g. "17:00–02:00". */
export function hoursOn(e: QlooEntity, isoDate: string): string | undefined {
  const day = WEEKDAYS[new Date(`${isoDate}T12:00:00Z`).getUTCDay()] as string;
  const slots = (e.properties?.hours as Record<string, Slot[]> | undefined)?.[day];
  if (!slots?.length) return undefined;
  if (slots.every((s) => s.closed)) return 'closed';
  const t = (x?: string) => (x ?? '').replace(/^T/, '').slice(0, 5);
  return slots
    .filter((s) => !s.closed)
    .map((s) => `${t(s.opens)}–${t(s.closes)}`)
    .join(', ');
}

/** True when a place is open at `time` (HH:MM, local) per an hours string; undefined if unknown. */
export function openAt(hours: string | undefined, time: string): boolean | undefined {
  if (!hours) return undefined;
  if (hours === 'closed') return false;
  const m = (x: string) => {
    const [h, min] = x.split(':').map(Number);
    return (h as number) * 60 + (min as number);
  };
  const at = m(time);
  return hours.split(', ').some((range) => {
    const [a, b] = range.split('–') as [string, string];
    const open = m(a);
    let close = m(b);
    if (close <= open) close += 24 * 60; // past midnight
    return (at >= open && at < close) || (at + 24 * 60 >= open && at + 24 * 60 < close);
  });
}
