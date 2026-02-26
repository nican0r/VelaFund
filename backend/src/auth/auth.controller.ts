import { Controller, Post, Get, Put, Body, Req, Res, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { Public } from './decorators/public.decorator';
import { RequireAuth } from './decorators/require-auth.decorator';
import { CurrentUser, AuthenticatedUser } from './decorators/current-user.decorator';
import { maskIp } from '../common/utils/redact-pii';

@ApiTags('Auth')
@Controller('api/v1/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessionService: SessionService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ auth: { ttl: 60000, limit: 10 } })
  @ApiOperation({ summary: 'Login with Privy access token' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid Privy token' })
  @ApiResponse({ status: 429, description: 'Too many attempts — account locked' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || '';
    const requestId = (req.headers['x-request-id'] as string) || '';

    let user: AuthenticatedUser;
    let isNewUser: boolean;

    try {
      const result = await this.authService.login(dto.privyAccessToken, ipAddress);
      user = result.user;
      isNewUser = result.isNewUser;
    } catch (error) {
      // Log AUTH_LOGIN_FAILED for authentication failures (fire-and-forget)
      this.auditLogService
        .log({
          actorType: 'SYSTEM',
          action: 'AUTH_LOGIN_FAILED',
          resourceType: 'User',
          metadata: {
            source: 'api',
            ipAddress: maskIp(ipAddress),
            userAgent,
            requestId,
            reason: error instanceof Error ? error.message : 'Unknown',
          },
        })
        .catch(() => {
          /* audit log failure should not affect auth flow */
        });
      throw error;
    }

    // BUG-1 fix: Create a Redis-backed session instead of storing the raw Privy token.
    // Privy tokens expire in 1-6 hours, but our session needs to last 7 days.
    // The session ID in the cookie references a Redis entry with the userId,
    // so we no longer depend on Privy token validity for ongoing requests.
    const sessionId = await this.sessionService.createSession(user.id, {
      ipAddress,
      userAgent,
    });

    // If Redis is unavailable, fall back to storing the Privy token (legacy behavior)
    const cookieValue = sessionId || dto.privyAccessToken;

    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('navia-auth-token', cookieValue, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days (absolute session limit)
    });

    // Log AUTH_LOGIN_SUCCESS (fire-and-forget)
    this.auditLogService
      .log({
        actorId: user.id,
        actorType: 'USER',
        action: 'AUTH_LOGIN_SUCCESS',
        resourceType: 'User',
        resourceId: user.id,
        metadata: {
          source: 'api',
          ipAddress: maskIp(ipAddress),
          userAgent,
          requestId,
          loginMethod: 'privy',
          isNewUser,
        },
      })
      .catch(() => {
        /* audit log failure should not affect auth flow */
      });

    return {
      user,
      isNewUser,
    };
  }

  // BUG-14 fix: Make logout @Public() so users with expired cookies can still
  // clear them. The endpoint only clears a cookie — no security risk.
  // BUG-15 fix: Return messageKey instead of hardcoded English string.
  @Post('logout')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout and invalidate session' })
  @ApiResponse({ status: 200, description: 'Logout successful' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    // Read session to get userId for audit logging before destroying
    const sessionId = req.cookies?.['navia-auth-token'];
    let userId: string | undefined;

    if (sessionId) {
      const session = await this.sessionService.getSession(sessionId);
      userId = session?.userId;
      await this.sessionService.destroySession(sessionId);
    }

    res.clearCookie('navia-auth-token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });

    // Log AUTH_LOGOUT (fire-and-forget)
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    this.auditLogService
      .log({
        actorId: userId,
        actorType: userId ? 'USER' : 'SYSTEM',
        action: 'AUTH_LOGOUT',
        resourceType: 'User',
        resourceId: userId,
        metadata: {
          source: 'api',
          ipAddress: maskIp(ipAddress),
          userAgent: req.headers['user-agent'] || '',
          requestId: (req.headers['x-request-id'] as string) || '',
        },
      })
      .catch(() => {
        /* audit log failure should not affect logout flow */
      });

    return { messageKey: 'errors.auth.loggedOut' };
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ auth: { ttl: 60000, limit: 10 } })
  @ApiOperation({ summary: 'Refresh session with a fresh Privy access token' })
  @ApiResponse({ status: 200, description: 'Session refreshed' })
  @ApiResponse({ status: 401, description: 'Invalid or expired token' })
  async refresh(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || '';
    const requestId = (req.headers['x-request-id'] as string) || '';

    // Verify the fresh Privy token and get the user
    const user = await this.authService.refreshSession(dto.privyAccessToken);

    // Destroy the old session if one exists in the cookie
    const oldSessionId = req.cookies?.['navia-auth-token'];
    if (oldSessionId) {
      await this.sessionService.destroySession(oldSessionId);
    }

    // Create a new session
    const sessionId = await this.sessionService.createSession(user.id, {
      ipAddress,
      userAgent,
    });

    // If Redis is unavailable, fall back to storing the Privy token
    const cookieValue = sessionId || dto.privyAccessToken;

    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('navia-auth-token', cookieValue, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Calculate expiry for the response
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // Log AUTH_TOKEN_REFRESHED (fire-and-forget)
    this.auditLogService
      .log({
        actorId: user.id,
        actorType: 'USER',
        action: 'AUTH_TOKEN_REFRESHED',
        resourceType: 'User',
        resourceId: user.id,
        metadata: {
          source: 'api',
          ipAddress: maskIp(ipAddress),
          userAgent,
          requestId,
        },
      })
      .catch(() => {
        /* audit log failure should not affect refresh flow */
      });

    return {
      user,
      expiresAt,
    };
  }

  @Get('me')
  @RequireAuth()
  @Throttle({ read: { ttl: 60000, limit: 100 } })
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  @ApiResponse({ status: 200, description: 'User profile' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getProfile(user.id);
  }

  @Put('me')
  @RequireAuth()
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({ status: 200, description: 'Profile updated' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  async updateMe(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateProfileDto) {
    return this.authService.updateProfile(user.id, dto);
  }
}
