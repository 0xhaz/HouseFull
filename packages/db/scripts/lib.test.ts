import { describe, expect, it } from 'vitest';
import { parseCsv } from './lib.ts';

describe('parseCsv', () => {
  it('handles BOM, quotes, escaped quotes, commas and CRLF', () => {
    const text =
      '﻿stop_id,stop_name,parent_station\r\n101,"Van Cortlandt Park-242 St",\r\n"R01","Astoria-Ditmars ""Blvd"", Queens",R\r\n';
    expect(parseCsv(text)).toEqual([
      { stop_id: '101', stop_name: 'Van Cortlandt Park-242 St', parent_station: '' },
      { stop_id: 'R01', stop_name: 'Astoria-Ditmars "Blvd", Queens', parent_station: 'R' },
    ]);
  });

  it('keeps a last line without a trailing newline', () => {
    expect(parseCsv('a,b\n1,2')).toEqual([{ a: '1', b: '2' }]);
  });
});
