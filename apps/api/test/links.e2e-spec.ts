import { createDb, linkClicks, runs } from '@housefull/db';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';

// Needs a migrated database: `pnpm db:start && pnpm db:migrate`.
const DATABASE_URL = process.env.DATABASE_URL;

describe.skipIf(!DATABASE_URL)('tracking links (F9a, needs DB)', () => {
  let app: INestApplication;
  let db: ReturnType<typeof createDb>;
  let runId: string;

  beforeAll(async () => {
    db = createDb(DATABASE_URL, { max: 2 });
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    const [run] = await db
      .insert(runs)
      .values({ input: { test: true }, status: 'done' })
      .returning();
    runId = run?.id as string;
  });

  afterAll(async () => {
    await db.delete(runs).where(eq(runs.id, runId)); // cascades to links and clicks
    await app.close();
    await db.$client.end();
  });

  it('creates links, redirects, and logs a click without the IP', async () => {
    const created = await request(app.getHttpServer())
      .post(`/runs/${runId}/links`)
      .send({
        links: [
          {
            segmentId: 's1',
            channel: 'instagram',
            destination: 'tickets',
            targetUrl: 'https://tickets.example.com/show',
          },
        ],
      })
      .expect(201);
    const code = created.body[0].code as string;
    expect(code).toMatch(/^hf-/);

    const res = await request(app.getHttpServer())
      .get(`/r/${code}`)
      .set('User-Agent', 'e2e-agent')
      .set('X-Forwarded-For', '198.51.100.23')
      .expect(302);
    expect(res.headers.location).toBe('https://tickets.example.com/show');
    expect(res.headers['cache-control']).toBe('no-store');

    const clicks = await db.select().from(linkClicks).where(eq(linkClicks.code, code));
    expect(clicks).toHaveLength(1);
    expect(JSON.stringify(clicks)).not.toContain('198.51.100.23');
    expect(clicks[0]?.dedupeHash).toHaveLength(32);
  });

  it('rejects unsafe targets and unknown runs or codes', async () => {
    await request(app.getHttpServer())
      .post(`/runs/${runId}/links`)
      .send({
        links: [
          {
            segmentId: 's1',
            channel: 'x',
            destination: 'tickets',
            targetUrl: 'javascript:alert(1)',
          },
        ],
      })
      .expect(400);
    await request(app.getHttpServer())
      .post('/runs/00000000-0000-4000-8000-000000000000/links')
      .send({
        links: [
          { segmentId: 's1', channel: 'x', destination: 'tickets', targetUrl: 'https://a.example' },
        ],
      })
      .expect(404);
    await request(app.getHttpServer()).get('/r/hf-zzzz').expect(404);
    await request(app.getHttpServer()).get('/r/not-a-code').expect(404);
  });
});
