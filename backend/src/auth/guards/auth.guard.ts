import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthService } from '../auth.service';
import { UnauthorizedException } from '../../common/filters/app-exception';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('errors.auth.invalidToken');
    }

    try {
      const user = await this.authService.verifyTokenAndGetUser(token);
      (request as any).user = user;
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.warn(`Auth verification failed: ${error instanceof Error ? error.message : 'Unknown'}`);
      throw new UnauthorizedException('errors.auth.invalidToken');
    }
  }

  private extractToken(request: Request): string | null {
    // Try Authorization header first
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }

    // Fall back to HTTP-only cookie
    const cookieToken = request.cookies?.['navia-auth-token'];
    if (cookieToken) {
      return cookieToken;
    }

    return null;
  }
}
