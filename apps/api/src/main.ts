import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  // Cloud Run sits behind one proxy hop; trust it so req.ip is the client, not the load balancer.
  app.set('trust proxy', 1);
  // Meta Ads CSV exports arrive as JSON strings.
  app.useBodyParser('json', { limit: '1mb' });
  app.enableShutdownHooks();
  app.enableCors({
    origin: (process.env.WEB_PUBLIC_URL || 'http://localhost:3100').split(','),
  });
  await app.listen(process.env.PORT || 4100);
}
await bootstrap();
