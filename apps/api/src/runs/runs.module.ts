import { Module } from '@nestjs/common';
import { CheckinsController } from './checkins.controller.js';
import { CheckinsService } from './checkins.service.js';
import { DbGeoStore } from './geo-store.js';
import { RunsController } from './runs.controller.js';
import { RunsService } from './runs.service.js';
import { SurveysController } from './surveys.controller.js';
import { SurveysService } from './surveys.service.js';

@Module({
  controllers: [RunsController, CheckinsController, SurveysController],
  providers: [RunsService, CheckinsService, DbGeoStore, SurveysService],
  exports: [RunsService, CheckinsService, DbGeoStore, SurveysService],
})
export class RunsModule {}
