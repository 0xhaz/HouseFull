import { Module } from '@nestjs/common';
import { CheckinsController } from './checkins.controller.js';
import { CheckinsService } from './checkins.service.js';
import { DbGeoStore } from './geo-store.js';
import { RunsController } from './runs.controller.js';
import { RunsService } from './runs.service.js';

@Module({
  controllers: [RunsController, CheckinsController],
  providers: [RunsService, CheckinsService, DbGeoStore],
  exports: [RunsService, CheckinsService, DbGeoStore],
})
export class RunsModule {}
