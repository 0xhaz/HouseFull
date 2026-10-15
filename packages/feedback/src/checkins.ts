/** One segment's results from one source. */
export type SegmentResult = {
  segmentId: string;
  clicks?: number;
  sales?: number;
  spendUsd?: number;
};
export type CheckinSource = 'manual' | 'meta_csv' | 'links' | 'sample';

/** RFC 4180 CSV → rows keyed by header (BOM, quotes, CRLF). */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...body] = rows;
  if (!header) return [];
  const keys = header.map((h) => h.replace(/^﻿/, '').trim());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, r[i] ?? ''])));
}

const num = (v: string | undefined) => {
  if (v === undefined || v.trim() === '') return undefined;
  const n = Number(v.replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? n : undefined;
};

/** Meta's export headings vary by report; first match wins. */
const COLUMNS = {
  adSet: [/^ad set name$/i, /^ad set$/i, /^campaign name$/i],
  spend: [/^amount spent/i, /^spend/i, /^cost/i],
  clicks: [/^link clicks$/i, /^clicks \(all\)$/i, /^clicks$/i],
  sales: [/^purchases$/i, /^website purchases$/i, /^results$/i, /^conversions$/i],
};

/**
 * Meta Ads Manager CSV → per-segment totals. Ad sets are named `hf-<segmentId>…`
 * by the ad export (F6), so results map back without the promoter doing anything.
 */
export function parseMetaAdsCsv(text: string): { results: SegmentResult[]; unmatched: string[] } {
  const rows = parseCsv(text);
  const headers = Object.keys(rows[0] ?? {});
  const col = (patterns: RegExp[]) => headers.find((h) => patterns.some((p) => p.test(h)));
  const adSet = col(COLUMNS.adSet);
  if (!adSet) throw new Error('No "Ad set name" column found in the CSV');
  const spend = col(COLUMNS.spend);
  const clicks = col(COLUMNS.clicks);
  const sales = col(COLUMNS.sales);

  const totals = new Map<string, Required<SegmentResult>>();
  const unmatched: string[] = [];
  for (const r of rows) {
    const name = r[adSet] ?? '';
    const m = name.match(/\bhf-(s\d+)\b/i);
    if (!m) {
      if (name && !/^total/i.test(name)) unmatched.push(name);
      continue;
    }
    const id = (m[1] as string).toLowerCase();
    const t = totals.get(id) ?? { segmentId: id, clicks: 0, sales: 0, spendUsd: 0 };
    t.clicks += num(clicks && r[clicks]) ?? 0;
    t.sales += num(sales && r[sales]) ?? 0;
    t.spendUsd += num(spend && r[spend]) ?? 0;
    totals.set(id, t);
  }
  return { results: [...totals.values()], unmatched };
}

export type ScoredSegment = {
  segmentId: string;
  clicks: number;
  sales: number;
  spendUsd: number;
  /** Lower is better for cost per sale; higher is better for the others. */
  metric: number;
  metricLabel: 'cost per sale' | 'sales per click' | 'clicks per $' | 'clicks';
};

export type Scoreboard = {
  /** Ranked best first; only segments with some results. */
  segments: ScoredSegment[];
  /** Segments with no results yet: not ranked, never treated as losers. */
  missing: string[];
  /** Decision #19: re-plan after ≥ 50 clicks per segment or ≥ 5 total sales. */
  ready: boolean;
  earlySignal: boolean;
  reason: string;
};

export const MIN_CLICKS_PER_SEGMENT = 50;
export const MIN_TOTAL_SALES = 5;
/** Spend with no sales ranks below any real cost per sale, but stays finite (JSON has no Infinity). */
export const NO_SALES_PENALTY = 1_000_000;

/**
 * Combines check-ins: per segment and source the latest entry wins; clicks take the
 * highest source (tracking links and Meta both count the same people), sales and
 * spend come from manual/Meta entries. Sorted best first.
 */
export function scoreSegments(
  segmentIds: string[],
  checkins: Array<{ source: CheckinSource; at: Date; bySegment: SegmentResult[] }>,
): Scoreboard {
  const latest = new Map<string, SegmentResult & { at: number }>();
  for (const c of checkins)
    for (const r of c.bySegment) {
      const key = `${r.segmentId}|${c.source}`;
      const prev = latest.get(key);
      if (!prev || c.at.getTime() >= prev.at) latest.set(key, { ...r, at: c.at.getTime() });
    }
  const totals = segmentIds.map((id) => {
    const rows = [...latest.entries()].filter(([k]) => k.startsWith(`${id}|`)).map(([, v]) => v);
    return {
      segmentId: id,
      clicks: Math.max(0, ...rows.map((r) => r.clicks ?? 0)),
      sales: rows.reduce((s, r) => s + (r.sales ?? 0), 0),
      spendUsd: rows.reduce((s, r) => s + (r.spendUsd ?? 0), 0),
    };
  });
  const withData = totals.filter((t) => t.clicks > 0 || t.sales > 0 || t.spendUsd > 0);
  const missing = totals.filter((t) => !withData.includes(t)).map((t) => t.segmentId);
  const totalSales = withData.reduce((s, t) => s + t.sales, 0);
  const salesMode = totalSales >= MIN_TOTAL_SALES;
  const haveSpend = withData.length > 0 && withData.every((t) => t.spendUsd > 0);
  const scored: ScoredSegment[] = withData.map((t) => {
    if (salesMode && haveSpend)
      return {
        ...t,
        metric: t.sales ? t.spendUsd / t.sales : NO_SALES_PENALTY + t.spendUsd,
        metricLabel: 'cost per sale',
      };
    if (salesMode)
      return { ...t, metric: t.clicks ? t.sales / t.clicks : 0, metricLabel: 'sales per click' };
    if (haveSpend) return { ...t, metric: t.clicks / t.spendUsd, metricLabel: 'clicks per $' };
    return { ...t, metric: t.clicks, metricLabel: 'clicks' };
  });
  const lowerBetter = scored[0]?.metricLabel === 'cost per sale';
  scored.sort((a, b) => (lowerBetter ? a.metric - b.metric : b.metric - a.metric));
  const clicksReady = totals.length > 0 && totals.every((t) => t.clicks >= MIN_CLICKS_PER_SEGMENT);
  const ready = salesMode || clicksReady;
  return {
    segments: scored,
    missing,
    ready,
    earlySignal: !salesMode,
    reason: ready
      ? salesMode
        ? `${totalSales} sales recorded`
        : `every segment has ${MIN_CLICKS_PER_SEGMENT}+ clicks (early signal: no sales yet)`
      : `Need ${MIN_CLICKS_PER_SEGMENT}+ clicks per segment or ${MIN_TOTAL_SALES}+ total sales (have ${totalSales} sales; fewest clicks ${totals.length ? Math.min(...totals.map((t) => t.clicks)) : 0})`,
  };
}
