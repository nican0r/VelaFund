// Mock @privy-io/node to avoid ESM import issues in tests
jest.mock('@privy-io/node', () => ({
  PrivyClient: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { AuthService } from '../auth.service';
import { SessionService, SessionData } from '../session.service';
import { UnauthorizedException } from '../../common/filters/app-exception';

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let authService: {
    verifyTokenAndGetUser: jest.Mock;
    getUserById: jest.Mock;
  };
  let sessionService: {
    isAvailable: jest.Mock;
    getSession: jest.Mock;
    isInactive: jest.Mock;
    touchSession: jest.Mock;
    destroySession: jest.Mock;
  };
  let reflector: Reflector;

  const mockAuthenticatedUser = {
    id: 'user-uuid-1',
    privyUserId: 'did:privy:abc123',
    email: 'test@example.com',
    walletAddress: '0x123',
    firstName: 'Test',
    lastName: 'User',
    kycStatus: 'NOT_STARTED',
    locale: 'pt-BR',
  };

  const mockSession: SessionData = {
    userId: 'user-uuid-1',
    createdAt: Date.now() - 60_000,
    lastActivityAt: Date.now() - 60_000,
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0',
  };

  function createMockExecutionContext(overrides: {
    headers?: Record<string, string>;
    cookies?: Record<string, string>;
  }): ExecutionContext & { _request: any } {
    const request = {
      headers: overrides.headers || {},
      cookies: overrides.cookies || {},
    };

    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
      _request: request,
    } as unknown as ExecutionContext & { _request: any };
  }

  beforeEach(async () => {
    authService = {
      verifyTokenAndGetUser: jest.fn(),
      getUserById: jest.fn(),
    };

    sessionService = {
      isAvailable: jest.fn().mockReturnValue(true),
      getSession: jest.fn(),
      isInactive: jest.fn().mockReturnValue(false),
      touchSession: jest.fn().mockResolvedValue(undefined),
      destroySession: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthGuard,
        { provide: AuthService, useValue: authService },
        { provide: SessionService, useValue: sessionService },
        Reflector,
      ],
    }).compile();

    guard = module.get<AuthGuard>(AuthGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow access to public routes', async () => {
    const ctx = createMockExecutionContext({});
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(sessionService.getSession).not.toHaveBeenCalled();
    expect(authService.verifyTokenAndGetUser).not.toHaveBeenCalled();
  });

  // --- Session-based auth (Path 1: Cookie with session ID) ---

  describe('session-based auth (cookie)', () => {
    it('should authenticate via Redis session from cookie', async () => {
      const ctx = createMockExecutionContext({
        cookies: { 'navia-auth-token': 'valid-session-id' },
      });
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      sessionService.getSession.mockResolvedValue(mockSession);
      authService.getUserById.mockResolvedValue(mockAuthenticatedUser);

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(sessionService.isAvailable).toHaveBeenCalled();
      expect(sessionService.getSession).toHaveBeenCalledWith('valid-session-id');
      expect(sessionService.isInactive).toHaveBeenCalledWith(mockSession);
      expect(sessionService.touchSession).toHaveBeenCalledWith('valid-session-id', mockSession);
      expect(authService.getUserById).toHaveBeenCalledWith('user-uuid-1');
      expect(ctx._request.user).toEqual(mockAuthenticatedUser);
    });

    it('should throw sessionExpired when session is inactive', async () => {
      const ctx = createMockExecutionContext({
        cookies: { 'navia-auth-token': 'inactive-session-id' },
      });
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      sessionService.getSession.mockResolvedValue(mockSession);
      sessionService.isInactive.mockReturnValue(true);

      await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);

      expect(sessionService.destroySession).toHaveBeenCalledWith('inactive-session-id');
      // Verify it throws with sessionExpired message
      try {
        await guard.canActivate(ctx);
      } catch (e) {
        expect((e as UnauthorizedException).messageKey).toBe('errors.auth.sessionExpired');
      }
    });

    it('should fall through to Privy verification when session not found in Redis', async () => {
      const ctx = createMockExecutionContext({
        cookies: { 'navia-auth-token': 'old-privy-token' },
      });
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      sessionService.getSession.mockResolvedValue(null);
      authService.verifyTokenAndGetUser.mockResolvedValue(mockAuthenticatedUser);

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      // Privy verification used as fallback with the cookie value
      expect(authService.verifyTokenAndGetUser).toHaveBeenCalledWith('old-privy-token');
      expect(ctx._request.user).toEqual(mockAuthenticatedUser);
    });
  });

  // --- Privy token auth (Path 2: Bearer header) ---

  describe('Privy token auth (Bearer header)', () => {
    it('should extract token from Authorization header', async () => {
      const ctx = createMockExecutionContext({
        headers: { authorization: 'Bearer valid-token-123' },
      });
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      authService.verifyTokenAndGetUser.mockResolvedValue(mockAuthenticatedUser);

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(authService.verifyTokenAndGetUser).toHaveBeenCalledWith('valid-token-123');
    });

    it('should prefer session from cookie over Bearer header when Redis available', async () => {
      const ctx = createMockExecutionContext({
        headers: { authorization: 'Bearer header-token' },
        cookies: { 'navia-auth-token': 'session-id' },
      });
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      sessionService.getSession.mockResolvedValue(mockSession);
      authService.getUserById.mockResolvedValue(mockAuthenticatedUser);

      await guard.canActivate(ctx);

      // Should use session, not Bearer
      expect(sessionService.getSession).toHaveBeenCalledWith('session-id');
      expect(authService.getUserById).toHaveBeenCalledWith('user-uuid-1');
      expect(authService.verifyTokenAndGetUser).not.toHaveBeenCalled();
    });

    it('should prefer Bearer header when session not found and both present', async () => {
      const ctx = createMockExecutionContext({
        headers: { authorization: 'Bearer header-token' },
        cookies: { 'navia-auth-token': 'expired-session' },
      });
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      sessionService.getSession.mockResolvedValue(null); // Session expired
      authService.verifyTokenAndGetUser.mockResolvedValue(mockAuthenticatedUser);

      await guard.canActivate(ctx);

      // Should fall through to Bearer token
      expect(authService.verifyTokenAndGetUser).toHaveBeenCalledWith('header-token');
    });
  });

  // --- Redis unavailable fallback ---

  describe('Redis unavailable fallback', () => {
    it('should fall back to Privy verification when Redis is not available', async () => {
      const ctx = createMockExecutionContext({
        cookies: { 'navia-auth-token': 'privy-token' },
      });
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      sessionService.isAvailable.mockReturnValue(false);
      authService.verifyTokenAndGetUser.mockResolvedValue(mockAuthenticatedUser);

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(sessionService.getSession).not.toHaveBeenCalled();
      expect(authService.verifyTokenAndGetUser).toHaveBeenCalledWith('privy-token');
    });
  });

  // --- Error cases ---

  describe('error cases', () => {
    it('should throw UnauthorizedException when no token provided', async () => {
      const ctx = createMockExecutionContext({});
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when Privy verification fails', async () => {
      const ctx = createMockExecutionContext({
        headers: { authorization: 'Bearer bad-token' },
      });
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      authService.verifyTokenAndGetUser.mockRejectedValue(
        new UnauthorizedException('errors.auth.invalidToken'),
      );

      await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    });

    it('should not extract token from malformed Authorization header', async () => {
      const ctx = createMockExecutionContext({
        headers: { authorization: 'Basic sometoken' },
      });
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    });

    it('should wrap non-UnauthorizedException errors from Privy', async () => {
      const ctx = createMockExecutionContext({
        headers: { authorization: 'Bearer valid-token' },
      });
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      authService.verifyTokenAndGetUser.mockRejectedValue(new Error('Unexpected DB error'));

      await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when session user not found in DB', async () => {
      const ctx = createMockExecutionContext({
        cookies: { 'navia-auth-token': 'valid-session' },
      });
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      sessionService.getSession.mockResolvedValue(mockSession);
      authService.getUserById.mockRejectedValue(
        new UnauthorizedException('errors.auth.invalidToken'),
      );

      await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    });
  });
});
