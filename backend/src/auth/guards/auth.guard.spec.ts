// Mock @privy-io/node to avoid ESM import issues in tests
jest.mock('@privy-io/node', () => ({
  PrivyClient: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { AuthService } from '../auth.service';
import { UnauthorizedException } from '../../common/filters/app-exception';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let authService: { verifyTokenAndGetUser: jest.Mock };
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

  function createMockExecutionContext(overrides: {
    headers?: Record<string, string>;
    cookies?: Record<string, string>;
    isPublic?: boolean;
  }): ExecutionContext {
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
      // Expose request for assertions
      _request: request,
    } as unknown as ExecutionContext & { _request: any };
  }

  beforeEach(async () => {
    authService = {
      verifyTokenAndGetUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthGuard,
        { provide: AuthService, useValue: authService },
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
    expect(authService.verifyTokenAndGetUser).not.toHaveBeenCalled();
  });

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

  it('should extract token from cookie when no Authorization header', async () => {
    const ctx = createMockExecutionContext({
      cookies: { 'navia-auth-token': 'cookie-token-456' },
    });
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    authService.verifyTokenAndGetUser.mockResolvedValue(mockAuthenticatedUser);

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(authService.verifyTokenAndGetUser).toHaveBeenCalledWith('cookie-token-456');
  });

  it('should prefer Authorization header over cookie', async () => {
    const ctx = createMockExecutionContext({
      headers: { authorization: 'Bearer header-token' },
      cookies: { 'navia-auth-token': 'cookie-token' },
    });
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    authService.verifyTokenAndGetUser.mockResolvedValue(mockAuthenticatedUser);

    await guard.canActivate(ctx);

    expect(authService.verifyTokenAndGetUser).toHaveBeenCalledWith('header-token');
  });

  it('should throw UnauthorizedException when no token provided', async () => {
    const ctx = createMockExecutionContext({});
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    expect(authService.verifyTokenAndGetUser).not.toHaveBeenCalled();
  });

  it('should throw UnauthorizedException when token verification fails', async () => {
    const ctx = createMockExecutionContext({
      headers: { authorization: 'Bearer bad-token' },
    });
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    authService.verifyTokenAndGetUser.mockRejectedValue(
      new UnauthorizedException('errors.auth.invalidToken'),
    );

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('should attach user to request on successful verification', async () => {
    const ctx = createMockExecutionContext({
      headers: { authorization: 'Bearer valid-token' },
    }) as ExecutionContext & { _request: any };
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    authService.verifyTokenAndGetUser.mockResolvedValue(mockAuthenticatedUser);

    await guard.canActivate(ctx);

    const request = ctx._request;
    expect(request.user).toEqual(mockAuthenticatedUser);
  });

  it('should not extract token from malformed Authorization header', async () => {
    const ctx = createMockExecutionContext({
      headers: { authorization: 'Basic sometoken' },
    });
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('should wrap non-UnauthorizedException errors', async () => {
    const ctx = createMockExecutionContext({
      headers: { authorization: 'Bearer valid-token' },
    });
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    authService.verifyTokenAndGetUser.mockRejectedValue(new Error('Unexpected DB error'));

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });
});
