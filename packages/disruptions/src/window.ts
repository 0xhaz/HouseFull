/** UTC offset (e.g. "-05:00") of an IANA zone on a date, DST-aware. */
export function utcOffset(timeZone: string, isoDate: string): string {
  const part = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
    .formatToParts(new Date(`${isoDate}T12:00:00Z`))
    .find((p) => p.type === 'timeZoneName')?.value;
  const m = part?.match(/GMT([+-]\d{2}:\d{2})/);
  return m ? (m[1] as string) : '+00:00';
}

/** Doors (18:00) to 01:00 the next morning, local time, as instants. */
export function showWindow(
  isoDate: string,
  timeZone = 'America/New_York',
): { start: Date; end: Date } {
  const start = new Date(`${isoDate}T18:00:00${utcOffset(timeZone, isoDate)}`);
  return { start, end: new Date(start.getTime() + 7 * 60 * 60 * 1000) };
}

export const overlaps = (a: { start: Date; end: Date }, b: { start: Date; end: Date }) =>
  a.start < b.end && b.start < a.end;
