// Mock @privy-io/node to avoid ESM import issues in tests
jest.mock('@privy-io/node', () => ({
  PrivyClient: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: {
    login: jest.Mock;
    getProfile: jest.Mock;
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
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('login', () => {
    it('should login and set auth cookie', async () => {
      authService.login.mockResolvedValue({
        user: mockAuthenticatedUser,
        isNewUser: false,
      });

      const mockReq = {
        ip: '192.168.1.1',
        socket: { remoteAddress: '192.168.1.1' },
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
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'navia-auth-token',
        'test-token',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'strict',
          path: '/',
        }),
      );
    });

    it('should set cookie with 7-day maxAge', async () => {
      authService.login.mockResolvedValue({
        user: mockAuthenticatedUser,
        isNewUser: true,
      });

      const mockReq = { ip: '10.0.0.1', socket: { remoteAddress: '10.0.0.1' } };
      const mockRes = { cookie: jest.fn() };

      await controller.login(
        { privyAccessToken: 'token' },
        mockReq as any,
        mockRes as any,
      );

      expect(mockRes.cookie).toHaveBeenCalledWith(
        'navia-auth-token',
        'token',
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

      const mockReq = { ip: undefined, socket: { remoteAddress: '172.16.0.1' } };
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
    it('should clear auth cookie', async () => {
      const mockRes = { clearCookie: jest.fn() };

      const result = await controller.logout(mockRes as any);

      expect(result).toEqual({ message: 'Logged out successfully' });
      expect(mockRes.clearCookie).toHaveBeenCalledWith(
        'navia-auth-token',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'strict',
          path: '/',
        }),
      );
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
});
