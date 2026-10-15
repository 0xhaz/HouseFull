import postgres from 'postgres';

export const connect = () =>
  postgres(process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54522/postgres', {
    max: 1,
    onnotice: () => {},
  });

/** RFC 4180 CSV (GTFS): quoted fields, escaped quotes, CRLF. Returns objects keyed by header. */
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

/** Pages through a Socrata SODA endpoint ($limit/$offset, stable $order). */
export async function* socrata(
  dataset: string,
  params: Record<string, string>,
  pageSize = 50_000,
): AsyncGenerator<Record<string, string>[]> {
  const token = process.env.SOCRATA_APP_TOKEN;
  for (let offset = 0; ; offset += pageSize) {
    const url = new URL(`https://data.cityofnewyork.us/resource/${dataset}.json`);
    for (const [k, v] of Object.entries({
      ...params,
      $limit: String(pageSize),
      $offset: String(offset),
    }))
      url.searchParams.set(k, v);
    const res = await fetch(url, { headers: token ? { 'X-App-Token': token } : {} });
    if (!res.ok) throw new Error(`${dataset}: ${res.status} ${await res.text()}`);
    const page = (await res.json()) as Record<string, string>[];
    if (page.length) yield page;
    if (page.length < pageSize) return;
  }
}
