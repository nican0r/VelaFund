import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthService } from '../auth.service';
import { SessionService } from '../session.service';
import { UnauthorizedException } from '../../common/filters/app-exception';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
    private readonly sessionService: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();

    // Path 1: Session-based auth from cookie (primary when Redis available)
    const cookieValue = request.cookies?.['navia-auth-token'];
    if (cookieValue && this.sessionService.isAvailable()) {
      const session = await this.sessionService.getSession(cookieValue);
      if (session) {
        // Valid session found — check inactivity timeout (2 hours)
        if (this.sessionService.isInactive(session)) {
          await this.sessionService.destroySession(cookieValue);
          throw new UnauthorizedException('errors.auth.sessionExpired');
        }
        // Update last activity (throttled to reduce Redis writes)
        await this.sessionService.touchSession(cookieValue, session);
        // Load user from database by session's userId
        const user = await this.authService.getUserById(session.userId);
        (request as any).user = user;
        return true;
      }
      // Session not found in Redis. This could mean:
      // 1. Session expired (normal) → user needs to re-login
      // 2. Old Privy token cookie from before session migration
      // Fall through to Path 2 to handle both cases gracefully
    }

    // Path 2: Privy token verification (Bearer header preferred, cookie fallback)
    // Handles: Bearer header for API clients, old cookies with Privy tokens, Redis-unavailable mode
    const token = this.extractBearerToken(request) || cookieValue;
    if (token) {
      try {
        const user = await this.authService.verifyTokenAndGetUser(token);
        (request as any).user = user;
        return true;
      } catch (error) {
        if (error instanceof UnauthorizedException) {
          throw error;
        }
        this.logger.warn(
          `Auth verification failed: ${error instanceof Error ? error.message : 'Unknown'}`,
        );
        throw new UnauthorizedException('errors.auth.invalidToken');
      }
    }

    throw new UnauthorizedException('errors.auth.invalidToken');
  }

  private extractBearerToken(request: Request): string | null {
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }
    return null;
  }
}
