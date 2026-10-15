import { createDb, type Db } from '@housefull/db';
import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';

export const DB = Symbol('DB');
export const InjectDb = () => Inject(DB);

@Global()
@Module({
  providers: [
    {
      provide: DB,
      // postgres.js connects lazily, so the API still boots (e.g. /health) without a database.
      useFactory: (): Db =>
        createDb(
          process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54522/postgres',
        ),
    },
  ],
  exports: [DB],
})
export class DbModule implements OnApplicationShutdown {
  constructor(@InjectDb() private readonly db: Db) {}

  async onApplicationShutdown() {
    await this.db.$client.end({ timeout: 5 });
  }
}
