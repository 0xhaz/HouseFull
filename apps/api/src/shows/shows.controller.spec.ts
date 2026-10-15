import { PresetShowSchema } from '@housefull/shared';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { QLOO } from '../qloo/qloo.module.js';
import { ShowsController } from './shows.controller.js';

describe('ShowsController', () => {
  it('serves valid presets, one per launch city', async () => {
    const mod = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 10 }])],
      controllers: [ShowsController],
      providers: [{ provide: QLOO, useValue: {} }],
    }).compile();
    const presets = mod.get(ShowsController).presets();
    for (const p of presets) expect(PresetShowSchema.safeParse(p).success).toBe(true);
    expect(new Set(presets.map((p) => p.show.city))).toEqual(new Set(['nyc', 'nola', 'la']));
  });
});
