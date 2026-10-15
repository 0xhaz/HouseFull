import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AskModule } from './ask/ask.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CitiesModule } from './cities/cities.module.js';
import { DbModule } from './db/db.module.js';
import { HealthModule } from './health/health.module.js';
import { LinksModule } from './links/links.module.js';
import { McpModule } from './mcp/mcp.module.js';
import { OutreachModule } from './outreach/outreach.module.js';
import { QlooModule } from './qloo/qloo.module.js';
import { RunsModule } from './runs/runs.module.js';
import { ShowsModule } from './shows/shows.module.js';
import { TonightModule } from './tonight/tonight.module.js';
import { WorkspacesModule } from './workspaces/workspaces.module.js';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'warn'),
        // Never log query strings with codes, cookies or auth headers; IPs stay out of logs too.
        redact: [
          'req.headers.cookie',
          'req.headers.authorization',
          'req.headers["x-api-key"]',
          'req.remoteAddress',
        ],
        serializers: {
          req: (req: { method: string; url: string }) => ({
            method: req.method,
            url: req.url.split('?')[0],
          }),
        },
      },
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    DbModule,
    QlooModule,
    AuthModule,
    WorkspacesModule,
    HealthModule,
    ShowsModule,
    LinksModule,
    RunsModule,
    CitiesModule,
    McpModule,
    AskModule,
    TonightModule,
    OutreachModule,
  ],
})
export class AppModule {}
