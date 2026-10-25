import type { Db } from '@housefull/db';
import { describe, expect, it, vi } from 'vitest';
import { RunEventLog } from './run-events.js';

/** A db whose inserts fail like a run deleted mid-flight (foreign key violation). */
function failingDb() {
  const values = vi.fn(() => Promise.reject(new Error('violates foreign key constraint')));
  return { db: { insert: () => ({ values }) } as unknown as Db, values };
}

describe('RunEventLog', () => {
  it('never rejects when the run disappears mid-flight, and stops writing for it', async () => {
    const { db, values } = failingDb();
    const log = new RunEventLog(db);
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    log.open('r1');
    log.append('r1', { type: 'warning', message: 'a' });
    log.append('r1', { type: 'warning', message: 'b' });
    log.append('r1', { type: 'done', status: 'done' });
    await expect(log.close('r1')).resolves.toBeUndefined();
    await new Promise((r) => setTimeout(r, 10));
    process.off('unhandledRejection', unhandled);
    expect(unhandled).not.toHaveBeenCalled();
    expect(values).toHaveBeenCalledTimes(1);
  });
});
