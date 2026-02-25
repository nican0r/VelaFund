// Mock @privy-io/node to avoid ESM import issues in tests
jest.mock('@privy-io/node', () => ({
  PrivyClient: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: {
    login: jest.Mock;
    getProfile: jest.Mock;
    updateProfile: jest.Mock;
  };
  let sessionService: {
    createSession: jest.Mock;
    destroySession: jest.Mock;
  };

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

  const mockProfile = {
    id: 'user-uuid-1',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    walletAddress: '0x123',
    profilePictureUrl: null,
    kycStatus: 'NOT_STARTED',
    locale: 'pt-BR',
    lastLoginAt: new Date('2026-02-23T10:00:00Z'),
    createdAt: new Date('2026-01-01T00:00:00Z'),
  };

  beforeEach(async () => {
    authService = {
      login: jest.fn(),
      getProfile: jest.fn(),
      updateProfile: jest.fn(),
    };

    sessionService = {
      createSession: jest.fn(),
      destroySession: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: SessionService, useValue: sessionService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('login', () => {
    it('should login and set session ID cookie (Redis available)', async () => {
      authService.login.mockResolvedValue({
        user: mockAuthenticatedUser,
        isNewUser: false,
      });
      sessionService.createSession.mockResolvedValue('session-id-abc123');

      const mockReq = {
        ip: '192.168.1.1',
        socket: { remoteAddress: '192.168.1.1' },
        headers: { 'user-agent': 'Mozilla/5.0' },
      };
      const mockRes = {
        cookie: jest.fn(),
      };

      const result = await controller.login(
        { privyAccessToken: 'test-token' },
        mockReq as any,
        mockRes as any,
      );

      expect(result.user).toEqual(mockAuthenticatedUser);
      expect(result.isNewUser).toBe(false);
      expect(authService.login).toHaveBeenCalledWith('test-token', '192.168.1.1');

      // Session created with user ID and metadata
      expect(sessionService.createSession).toHaveBeenCalledWith('user-uuid-1', {
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      });

      // Cookie stores session ID (not Privy token)
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'navia-auth-token',
        'session-id-abc123', // Session ID, not 'test-token'
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'strict',
          path: '/',
        }),
      );
    });

    it('should fall back to Privy token cookie when Redis unavailable', async () => {
      authService.login.mockResolvedValue({
        user: mockAuthenticatedUser,
        isNewUser: true,
      });
      sessionService.createSession.mockResolvedValue(null); // Redis unavailable

      const mockReq = {
        ip: '10.0.0.1',
        socket: { remoteAddress: '10.0.0.1' },
        headers: { 'user-agent': 'test-agent' },
      };
      const mockRes = { cookie: jest.fn() };

      await controller.login(
        { privyAccessToken: 'privy-token-fallback' },
        mockReq as any,
        mockRes as any,
      );

      // Cookie stores Privy token as fallback
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'navia-auth-token',
        'privy-token-fallback', // Privy token, not session ID
        expect.objectContaining({
          maxAge: 7 * 24 * 60 * 60 * 1000,
        }),
      );
    });

    it('should set cookie with 7-day maxAge', async () => {
      authService.login.mockResolvedValue({
        user: mockAuthenticatedUser,
        isNewUser: true,
      });
      sessionService.createSession.mockResolvedValue('session-123');

      const mockReq = {
        ip: '10.0.0.1',
        socket: { remoteAddress: '10.0.0.1' },
        headers: {},
      };
      const mockRes = { cookie: jest.fn() };

      await controller.login(
        { privyAccessToken: 'token' },
        mockReq as any,
        mockRes as any,
      );

      expect(mockRes.cookie).toHaveBeenCalledWith(
        'navia-auth-token',
        expect.any(String),
        expect.objectContaining({
          maxAge: 7 * 24 * 60 * 60 * 1000,
        }),
      );
    });

    it('should pass IP address from request', async () => {
      authService.login.mockResolvedValue({
        user: mockAuthenticatedUser,
        isNewUser: false,
      });
      sessionService.createSession.mockResolvedValue('session-123');

      const mockReq = {
        ip: undefined,
        socket: { remoteAddress: '172.16.0.1' },
        headers: {},
      };
      const mockRes = { cookie: jest.fn() };

      await controller.login(
        { privyAccessToken: 'token' },
        mockReq as any,
        mockRes as any,
      );

      expect(authService.login).toHaveBeenCalledWith('token', '172.16.0.1');
    });
  });

  describe('logout', () => {
    it('should destroy session and clear auth cookie', async () => {
      const mockReq = {
        cookies: { 'navia-auth-token': 'session-to-destroy' },
      };
      const mockRes = { clearCookie: jest.fn() };

      const result = await controller.logout(mockReq as any, mockRes as any);

      expect(result).toEqual({ messageKey: 'errors.auth.loggedOut' });
      expect(sessionService.destroySession).toHaveBeenCalledWith(
        'session-to-destroy',
      );
      expect(mockRes.clearCookie).toHaveBeenCalledWith(
        'navia-auth-token',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'strict',
          path: '/',
        }),
      );
    });

    it('should handle logout when no cookie present', async () => {
      const mockReq = {
        cookies: {},
      };
      const mockRes = { clearCookie: jest.fn() };

      const result = await controller.logout(mockReq as any, mockRes as any);

      expect(result).toEqual({ messageKey: 'errors.auth.loggedOut' });
      expect(sessionService.destroySession).not.toHaveBeenCalled();
      expect(mockRes.clearCookie).toHaveBeenCalled();
    });
  });

  describe('me', () => {
    it('should return current user profile', async () => {
      authService.getProfile.mockResolvedValue(mockProfile);

      const result = await controller.me(mockAuthenticatedUser);

      expect(result).toEqual(mockProfile);
      expect(authService.getProfile).toHaveBeenCalledWith('user-uuid-1');
    });
  });

  describe('updateMe', () => {
    it('should update user profile with firstName and lastName', async () => {
      const updatedProfile = {
        ...mockProfile,
        firstName: 'João',
        lastName: 'Silva',
      };
      authService.updateProfile.mockResolvedValue(updatedProfile);

      const result = await controller.updateMe(mockAuthenticatedUser, {
        firstName: 'João',
        lastName: 'Silva',
      });

      expect(result).toEqual(updatedProfile);
      expect(authService.updateProfile).toHaveBeenCalledWith('user-uuid-1', {
        firstName: 'João',
        lastName: 'Silva',
      });
    });

    it('should update email', async () => {
      const updatedProfile = {
        ...mockProfile,
        email: 'new@example.com',
      };
      authService.updateProfile.mockResolvedValue(updatedProfile);

      const result = await controller.updateMe(mockAuthenticatedUser, {
        email: 'new@example.com',
      });

      expect(result).toEqual(updatedProfile);
      expect(authService.updateProfile).toHaveBeenCalledWith('user-uuid-1', {
        email: 'new@example.com',
      });
    });

    it('should update all profile fields at once', async () => {
      const updatedProfile = {
        ...mockProfile,
        firstName: 'Maria',
        lastName: 'Santos',
        email: 'maria@example.com',
      };
      authService.updateProfile.mockResolvedValue(updatedProfile);

      const result = await controller.updateMe(mockAuthenticatedUser, {
        firstName: 'Maria',
        lastName: 'Santos',
        email: 'maria@example.com',
      });

      expect(result).toEqual(updatedProfile);
      expect(authService.updateProfile).toHaveBeenCalledWith('user-uuid-1', {
        firstName: 'Maria',
        lastName: 'Santos',
        email: 'maria@example.com',
      });
    });
  });
});
