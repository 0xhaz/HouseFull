import { overlaps } from './window.js';

const FEED = 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/camsys%2Fsubway-alerts.json';
const CACHE_MS = 15 * 60 * 1000;

export type MtaAlert = {
  id: string;
  type: string;
  header: string;
  routes: string[];
  periods: Array<{ start: Date; end: Date }>;
};

type Raw = {
  entity?: Array<{
    id: string;
    alert?: {
      active_period?: Array<{ start?: number; end?: number }>;
      informed_entity?: Array<{ route_id?: string }>;
      header_text?: { translation?: Array<{ text: string; language?: string }> };
      'transit_realtime.mercury_alert'?: { alert_type?: string };
    };
  }>;
};

let cache: { at: number; alerts: MtaAlert[] } | undefined;

/** MTA subway alerts (GTFS-RT, JSON). Fetched server-side and cached, per the MTA's terms. */
export async function subwayAlerts(
  fetchImpl: typeof fetch = fetch,
  now = Date.now(),
): Promise<MtaAlert[]> {
  if (cache && now - cache.at < CACHE_MS) return cache.alerts;
  const res = await fetchImpl(FEED, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`MTA alerts feed returned ${res.status}`);
  const alerts = parseAlerts((await res.json()) as Raw);
  cache = { at: now, alerts };
  return alerts;
}

export function parseAlerts(raw: Raw): MtaAlert[] {
  return (raw.entity ?? []).flatMap((e) => {
    const a = e.alert;
    if (!a) return [];
    const routes = [
      ...new Set((a.informed_entity ?? []).flatMap((i) => (i.route_id ? [i.route_id] : []))),
    ];
    if (routes.length === 0) return [];
    const header =
      a.header_text?.translation?.find((t) => !t.language || t.language === 'en')?.text ?? '';
    const periods = (a.active_period ?? []).map((p) => ({
      start: new Date((p.start ?? 0) * 1000),
      end: new Date((p.end ?? 4_102_444_800) * 1000), // open-ended → far future
    }));
    return [
      {
        id: e.id,
        type: a['transit_realtime.mercury_alert']?.alert_type ?? 'Alert',
        header,
        routes,
        periods,
      },
    ];
  });
}

/** Alerts active during the window on any of the given routes. */
export function alertsFor(
  alerts: MtaAlert[],
  routes: Set<string>,
  window: { start: Date; end: Date },
) {
  return alerts.filter(
    (a) => a.routes.some((r) => routes.has(r)) && a.periods.some((p) => overlaps(p, window)),
  );
}

export const isSuspension = (type: string) => /suspend/i.test(type);
export const isPlanned = (type: string) => /^planned/i.test(type);

/** Test hook. */
export function resetMtaCache() {
  cache = undefined;
}
