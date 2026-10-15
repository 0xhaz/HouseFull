import { Module } from '@nestjs/common';
import { ShowsController } from './shows.controller.js';

@Module({ controllers: [ShowsController] })
export class ShowsModule {}
