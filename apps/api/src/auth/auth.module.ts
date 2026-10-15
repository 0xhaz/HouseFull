import { Global, Module } from '@nestjs/common';
import { ClerkAuth, ClerkAuthGuard } from './clerk-auth.js';

@Global()
@Module({ providers: [ClerkAuth, ClerkAuthGuard], exports: [ClerkAuth, ClerkAuthGuard] })
export class AuthModule {}
