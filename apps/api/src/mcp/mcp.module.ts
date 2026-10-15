import { Module } from '@nestjs/common';
import { RunsModule } from '../runs/runs.module.js';
import { McpController } from './mcp.controller.js';

@Module({ imports: [RunsModule], controllers: [McpController] })
export class McpModule {}
