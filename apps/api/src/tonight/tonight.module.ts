import { Module } from '@nestjs/common';
import { RunsModule } from '../runs/runs.module.js';
import { TonightController } from './tonight.controller.js';
import { TonightService } from './tonight.service.js';

@Module({ imports: [RunsModule], controllers: [TonightController], providers: [TonightService] })
export class TonightModule {}
