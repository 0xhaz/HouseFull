import { type ClerkClient, createClerkClient } from '@clerk/backend';
import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Request } from 'express';

/** The signed-in user behind a request, with their active Clerk organization (if any). */
export type Caller = {
  userId: string;
  orgId?: string;
  orgSlug?: string;
  /** e.g. `org:admin`, `org:member` */
  orgRole?: string;
};

type WithCaller = Request & { caller?: Caller | null };

/**
 * Verifies the Clerk session token the web app sends as `Authorization: Bearer`.
 * Without CLERK_SECRET_KEY every request is anonymous: demo workspaces still work.
 */
@Injectable()
export class ClerkAuth {
  private readonly logger = new Logger(ClerkAuth.name);
  readonly client: ClerkClient | undefined = process.env.CLERK_SECRET_KEY
    ? createClerkClient({
        secretKey: process.env.CLERK_SECRET_KEY,
        publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
      })
    : undefined;
  private readonly parties = (process.env.WEB_PUBLIC_URL || 'http://localhost:3100')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  async caller(req: Request): Promise<Caller | null> {
    const header = req.headers.authorization;
    if (!this.client || !header?.startsWith('Bearer ')) return null;
    // Only the bearer token: no cookies, so no handshake redirects on an API.
    const request = new Request(`http://api.local${req.originalUrl}`, {
      headers: { authorization: header },
    });
    try {
      const state = await this.client.authenticateRequest(request, {
        authorizedParties: this.parties,
      });
      if (!state.isAuthenticated) return null;
      const a = state.toAuth();
      if (!a.userId) return null;
      return {
        userId: a.userId,
        orgId: a.orgId ?? undefined,
        orgSlug: a.orgSlug ?? undefined,
        orgRole: a.orgRole ?? undefined,
      };
    } catch (e) {
      this.logger.warn(`token rejected: ${(e as Error).message}`);
      return null;
    }
  }
}

/** Optional auth: resolves the caller (or null) onto the request; never rejects by itself. */
@Injectable()
export class ClerkAuthGuard implements CanActivate {
  constructor(private readonly auth: ClerkAuth) {}

  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest<WithCaller>();
    req.caller = await this.auth.caller(req);
    return true;
  }
}

/** The caller resolved by ClerkAuthGuard, or null when signed out. */
export const CallerAuth = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): Caller | null =>
    ctx.switchToHttp().getRequest<WithCaller>().caller ?? null,
);
