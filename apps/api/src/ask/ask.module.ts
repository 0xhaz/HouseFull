import { Module } from '@nestjs/common';
import { RunsModule } from '../runs/runs.module.js';
import { AskController } from './ask.controller.js';
import { AskService } from './ask.service.js';

@Module({ imports: [RunsModule], controllers: [AskController], providers: [AskService] })
export class AskModule {}
