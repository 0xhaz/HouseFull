import type { QlooClient } from '@housefull/qloo-client';
import { Controller, Get } from '@nestjs/common';
import { InjectQloo } from '../qloo/qloo.module.js';

@Controller('health')
export class HealthController {
  constructor(@InjectQloo() private readonly qloo: QlooClient) {}

  @Get()
  async health() {
    return {
      ok: true,
      demoMode: process.env.DEMO_MODE === 'true' || !process.env.QLOO_API_KEY,
      qlooBudgetRemaining: await this.qloo.remainingBudget(),
    };
  }
}
