import { Module } from '@nestjs/common';
import { RunsModule } from '../runs/runs.module.js';
import { OutreachController } from './outreach.controller.js';
import { OutreachService } from './outreach.service.js';

@Module({ imports: [RunsModule], controllers: [OutreachController], providers: [OutreachService] })
export class OutreachModule {}
