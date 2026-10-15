/**
 * Places NYC permit locations with NYC Planning's GeoSearch (free, no key).
 * Permit text is messy: "5511 QUEENS BOULEVARD", "Athens Square: Stage Area",
 * or "W 24 ST between 7 AV and 6 AV". GeoSearch handles addresses and named
 * places; street segments need NYC Geoclient, so they return null rather than a guess.
 */
export function candidates(location: string, borough?: string): string[] {
  const out: string[] = [];
  const b = borough ? `, ${borough}` : '';
  for (const raw of location.split(',')) {
    const part = raw.replace(/\s+/g, ' ').trim();
    if (!part) continue;
    if (/^\d+[A-Z-]*\s+\S/i.test(part) && !/\bbetween\b/i.test(part)) out.push(`${part}${b}`);
    const place = part.split(':')[0]?.trim();
    if (place && part.includes(':') && !/\bbetween\b/i.test(place)) out.push(`${place}${b}`);
  }
  return [...new Set(out)].slice(0, 3);
}

type Feature = {
  properties: { label?: string; confidence?: number };
  geometry: { coordinates: [number, number] };
};

export async function geocode(
  location: string,
  borough: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<{ lng: number; lat: number; label: string } | null> {
  for (const text of candidates(location, borough)) {
    const url = `https://geosearch.planninglabs.nyc/v2/search?size=1&text=${encodeURIComponent(text)}`;
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(6000) }).catch(() => null);
    if (!res?.ok) continue;
    const f = ((await res.json()) as { features?: Feature[] }).features?.[0];
    if (f && (f.properties.confidence ?? 1) >= 0.6) {
      const [lng, lat] = f.geometry.coordinates;
      return { lng, lat, label: f.properties.label ?? text };
    }
  }
  return null;
}
