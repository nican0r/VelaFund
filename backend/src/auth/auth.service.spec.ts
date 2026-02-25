import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpStatus } from '@nestjs/common';
import { AuthService, AccountLockedException, PrivyUnavailableException } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { UnauthorizedException, AppException } from '../common/filters/app-exception';
import { REDIS_CLIENT } from '../redis/redis.constants';

// Mock the PrivyClient from @privy-io/node
const mockVerifyAccessToken = jest.fn();
const mockGetUser = jest.fn();

jest.mock('@privy-io/node', () => ({
  PrivyClient: jest.fn().mockImplementation(() => ({
    utils: () => ({
      auth: () => ({
        verifyAccessToken: mockVerifyAccessToken,
      }),
    }),
    users: () => ({
      _get: mockGetUser,
    }),
  })),
}));

/**
 * Creates a stateful Redis mock that simulates real Redis GET/INCR/EXPIRE/DEL behavior.
 * This is more reliable than sequencing mockResolvedValueOnce calls.
 */
function createStatefulRedisMock() {
  const store: Record<string, string> = {};

  return {
    get: jest.fn(async (key: string) => store[key] ?? null),
    incr: jest.fn(async (key: string) => {
      const current = parseInt(store[key] ?? '0', 10);
      const next = current + 1;
      store[key] = String(next);
      return next;
    }),
    expire: jest.fn(async () => 1),
    del: jest.fn(async (key: string) => {
      const existed = key in store ? 1 : 0;
      delete store[key];
      return existed;
    }),
    _store: store, // Expose for assertions
  };
}

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let mockRedis: ReturnType<typeof createStatefulRedisMock>;

  const mockDbUser = {
    id: 'user-uuid-1',
    privyUserId: 'did:privy:abc123',
    email: 'test@example.com',
    walletAddress: '0x1234567890abcdef',
    firstName: 'Test',
    lastName: 'User',
    kycStatus: 'NOT_STARTED',
    locale: 'pt-BR',
    profilePictureUrl: null,
    lastLoginAt: new Date(),
    createdAt: new Date(),
    deletedAt: null,
  };

  const mockPrivyUser = {
    id: 'did:privy:abc123',
    created_at: Date.now(),
    has_accepted_terms: true,
    is_guest: false,
    linked_accounts: [
      { type: 'email' as const, address: 'test@example.com', verified_at: Date.now(), first_verified_at: null, latest_verified_at: null },
      { type: 'wallet' as const, address: '0x1234567890abcdef', chain_type: 'ethereum' as const, wallet_client_type: 'privy', wallet_client: 'privy' as const, connector_type: 'embedded' as const, delegated: false, imported: false, recovery_method: 'privy' as const, verified_at: Date.now(), first_verified_at: null, latest_verified_at: null, wallet_index: 0, chain_id: '1', id: null },
    ],
    mfa_methods: [],
  };

  const configServiceMock = {
    get: jest.fn((key: string, defaultValue?: string) => {
      const config: Record<string, string> = {
        PRIVY_APP_ID: 'test-app-id',
        PRIVY_APP_SECRET: 'test-app-secret',
      };
      return config[key] || defaultValue || '';
    }),
  };

  /**
   * Helper to create a test module with optional Redis client.
   * Pass null for Redis to test in-memory fallback mode.
   */
  async function createTestModule(redisClient: unknown) {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation((fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: configServiceMock },
        { provide: REDIS_CLIENT, useValue: redisClient },
      ],
    }).compile();

    return module.get<AuthService>(AuthService);
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    mockRedis = createStatefulRedisMock();
    service = await createTestModule(mockRedis);
  });

  describe('verifyTokenAndGetUser', () => {
    it('should verify token and return authenticated user', async () => {
      mockVerifyAccessToken.mockResolvedValue({
        user_id: 'did:privy:abc123',
        app_id: 'test-app-id',
        issuer: 'privy.io',
        issued_at: Date.now() / 1000,
        expiration: Date.now() / 1000 + 3600,
        session_id: 'session-1',
      });
      prisma.user.findUnique.mockResolvedValue(mockDbUser);

      const result = await service.verifyTokenAndGetUser('valid-token');

      expect(result).toEqual({
        id: 'user-uuid-1',
        privyUserId: 'did:privy:abc123',
        email: 'test@example.com',
        walletAddress: '0x1234567890abcdef',
        firstName: 'Test',
        lastName: 'User',
        kycStatus: 'NOT_STARTED',
        locale: 'pt-BR',
      });
      expect(mockVerifyAccessToken).toHaveBeenCalledWith('valid-token');
    });

    it('should throw UnauthorizedException when token verification fails', async () => {
      mockVerifyAccessToken.mockRejectedValue(new Error('Invalid token'));

      await expect(service.verifyTokenAndGetUser('invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when user not found in database', async () => {
      mockVerifyAccessToken.mockResolvedValue({
        user_id: 'did:privy:nonexistent',
      });
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.verifyTokenAndGetUser('valid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when user is soft-deleted', async () => {
      mockVerifyAccessToken.mockResolvedValue({
        user_id: 'did:privy:abc123',
      });
      prisma.user.findUnique.mockResolvedValue({
        ...mockDbUser,
        deletedAt: new Date(),
      });

      await expect(service.verifyTokenAndGetUser('valid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('login', () => {
    it('should login existing user and update lastLoginAt', async () => {
      mockVerifyAccessToken.mockResolvedValue({
        user_id: 'did:privy:abc123',
      });
      mockGetUser.mockResolvedValue(mockPrivyUser);
      prisma.user.findUnique.mockResolvedValue(mockDbUser);
      prisma.user.update.mockResolvedValue({
        ...mockDbUser,
        lastLoginAt: new Date(),
      });

      const result = await service.login('valid-token', '192.168.1.1');

      expect(result.isNewUser).toBe(false);
      expect(result.user.id).toBe('user-uuid-1');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-uuid-1' },
        data: expect.objectContaining({
          lastLoginAt: expect.any(Date),
        }),
      });
    });

    it('should create new user on first login', async () => {
      mockVerifyAccessToken.mockResolvedValue({
        user_id: 'did:privy:new123',
      });
      mockGetUser.mockResolvedValue({
        ...mockPrivyUser,
        id: 'did:privy:new123',
        linked_accounts: [
          { type: 'email' as const, address: 'new@example.com', verified_at: Date.now(), first_verified_at: null, latest_verified_at: null },
          {
            type: 'google_oauth' as const,
            email: 'new@example.com',
            name: 'New User',
            subject: 'google-sub',
            verified_at: Date.now(),
            first_verified_at: null,
            latest_verified_at: null,
          },
        ],
      });

      // No user by privyUserId
      prisma.user.findUnique.mockResolvedValueOnce(null);
      // No user by email either
      prisma.user.findUnique.mockResolvedValueOnce(null);

      const newUser = {
        ...mockDbUser,
        id: 'new-user-uuid',
        privyUserId: 'did:privy:new123',
        email: 'new@example.com',
        firstName: 'New',
        lastName: 'User',
      };
      prisma.user.create.mockResolvedValue(newUser);

      const result = await service.login('valid-token', '192.168.1.1');

      expect(result.isNewUser).toBe(true);
      expect(result.user.email).toBe('new@example.com');
      expect(result.user.firstName).toBe('New');
      expect(result.user.lastName).toBe('User');
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          privyUserId: 'did:privy:new123',
          email: 'new@example.com',
          firstName: 'New',
          lastName: 'User',
        }),
      });
    });

    it('should throw conflict when email exists with different Privy ID', async () => {
      mockVerifyAccessToken.mockResolvedValue({
        user_id: 'did:privy:new123',
      });
      mockGetUser.mockResolvedValue({
        ...mockPrivyUser,
        id: 'did:privy:new123',
      });

      // No user by privyUserId
      prisma.user.findUnique.mockResolvedValueOnce(null);
      // Email exists with different Privy ID
      prisma.user.findUnique.mockResolvedValueOnce({
        ...mockDbUser,
        privyUserId: 'did:privy:different',
      });

      try {
        await service.login('valid-token', '192.168.1.1');
        fail('Expected AppException to be thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(AppException);
        expect((e as AppException).code).toBe('AUTH_DUPLICATE_EMAIL');
        expect((e as AppException).statusCode).toBe(HttpStatus.CONFLICT);
      }
    });

    it('should throw UnauthorizedException when Privy user has no email', async () => {
      mockVerifyAccessToken.mockResolvedValue({
        user_id: 'did:privy:noemail',
      });
      mockGetUser.mockResolvedValue({
        ...mockPrivyUser,
        id: 'did:privy:noemail',
        linked_accounts: [
          { type: 'wallet' as const, address: '0xabc', chain_type: 'ethereum' as const, wallet_client: 'unknown' as const, verified_at: Date.now(), first_verified_at: null, latest_verified_at: null },
        ],
      });

      await expect(service.login('valid-token', '192.168.1.1')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw PrivyUnavailableException when Privy user fetch fails', async () => {
      mockVerifyAccessToken.mockResolvedValue({
        user_id: 'did:privy:abc123',
      });
      mockGetUser.mockRejectedValue(new Error('Service unavailable'));

      await expect(service.login('valid-token', '192.168.1.1')).rejects.toThrow(
        PrivyUnavailableException,
      );
    });

    it('should sync wallet address if changed in Privy', async () => {
      mockVerifyAccessToken.mockResolvedValue({
        user_id: 'did:privy:abc123',
      });
      mockGetUser.mockResolvedValue({
        ...mockPrivyUser,
        linked_accounts: [
          { type: 'email' as const, address: 'test@example.com', verified_at: Date.now(), first_verified_at: null, latest_verified_at: null },
          { type: 'wallet' as const, address: '0xNEWWALLET', chain_type: 'ethereum' as const, wallet_client_type: 'privy', wallet_client: 'privy' as const, connector_type: 'embedded' as const, delegated: false, imported: false, recovery_method: 'privy' as const, verified_at: Date.now(), first_verified_at: null, latest_verified_at: null, wallet_index: 0, chain_id: '1', id: null },
        ],
      });

      prisma.user.findUnique.mockResolvedValue(mockDbUser);
      prisma.user.update.mockResolvedValue({
        ...mockDbUser,
        walletAddress: '0xNEWWALLET',
      });

      await service.login('valid-token', '192.168.1.1');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-uuid-1' },
        data: expect.objectContaining({
          walletAddress: '0xNEWWALLET',
        }),
      });
    });
  });

  describe('lockout (Redis-backed)', () => {
    it('should record failed attempts in Redis using INCR', async () => {
      mockVerifyAccessToken.mockRejectedValue(new Error('Invalid token'));
      const ip = '10.0.0.1';

      await expect(service.login('bad-token', ip)).rejects.toThrow(UnauthorizedException);

      expect(mockRedis.incr).toHaveBeenCalledWith('lockout:10.0.0.1');
      expect(mockRedis.expire).toHaveBeenCalledWith('lockout:10.0.0.1', AuthService.LOCKOUT_DURATION_S);
    });

    it('should set TTL only on first failure and at lockout threshold', async () => {
      mockVerifyAccessToken.mockRejectedValue(new Error('Invalid token'));
      const ip = '10.0.0.50';

      // First failure: EXPIRE called (count === 1)
      await expect(service.login('bad', ip)).rejects.toThrow(UnauthorizedException);
      expect(mockRedis.expire).toHaveBeenCalledTimes(1);

      // 2nd, 3rd, 4th failures: EXPIRE not called again
      for (let i = 0; i < 3; i++) {
        await expect(service.login('bad', ip)).rejects.toThrow(UnauthorizedException);
      }
      // expire was called once on first, not on 2,3,4
      expect(mockRedis.expire).toHaveBeenCalledTimes(1);

      // 5th failure: EXPIRE called again (count === MAX_FAILED_ATTEMPTS)
      await expect(service.login('bad', ip)).rejects.toThrow(UnauthorizedException);
      expect(mockRedis.expire).toHaveBeenCalledTimes(2);
    });

    it('should lock out after 5 failed attempts via Redis', async () => {
      mockVerifyAccessToken.mockRejectedValue(new Error('Invalid token'));
      const ip = '10.0.0.2';

      // First 5 attempts: UnauthorizedException (each increments counter)
      for (let i = 0; i < 5; i++) {
        await expect(service.login('bad-token', ip)).rejects.toThrow(UnauthorizedException);
      }

      // 6th attempt: checkLockout reads count=5 from Redis → AccountLockedException
      await expect(service.login('any-token', ip)).rejects.toThrow(AccountLockedException);
    });

    it('should clear failed attempts in Redis on successful login', async () => {
      mockVerifyAccessToken.mockRejectedValue(new Error('Invalid token'));
      const ip = '10.0.0.3';

      // Record 3 failed attempts
      for (let i = 0; i < 3; i++) {
        await expect(service.login('bad-token', ip)).rejects.toThrow(UnauthorizedException);
      }
      expect(mockRedis._store['lockout:10.0.0.3']).toBe('3');

      // Successful login clears the counter
      mockVerifyAccessToken.mockResolvedValue({ user_id: 'did:privy:abc123' });
      mockGetUser.mockResolvedValue(mockPrivyUser);
      prisma.user.findUnique.mockResolvedValue(mockDbUser);
      prisma.user.update.mockResolvedValue(mockDbUser);

      const result = await service.login('valid-token', ip);
      expect(result.user.id).toBe('user-uuid-1');

      // Redis DEL was called
      expect(mockRedis.del).toHaveBeenCalledWith('lockout:10.0.0.3');
      // Counter is cleared
      expect(mockRedis._store['lockout:10.0.0.3']).toBeUndefined();

      // After clearing, 5 more failures needed to lock
      mockVerifyAccessToken.mockRejectedValue(new Error('Invalid token'));
      for (let i = 0; i < 5; i++) {
        await expect(service.login('bad-token', ip)).rejects.toThrow(UnauthorizedException);
      }
      // Now locked
      await expect(service.login('any-token', ip)).rejects.toThrow(AccountLockedException);
    });

    it('should not lock different IPs independently', async () => {
      mockVerifyAccessToken.mockRejectedValue(new Error('Invalid token'));

      // Lock IP A
      for (let i = 0; i < 5; i++) {
        await expect(service.login('bad', '10.0.0.10')).rejects.toThrow(UnauthorizedException);
      }
      await expect(service.login('any', '10.0.0.10')).rejects.toThrow(AccountLockedException);

      // IP B is not locked — still gets UnauthorizedException (not AccountLocked)
      await expect(service.login('bad', '10.0.0.11')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('lockout (in-memory fallback when Redis is null)', () => {
    let fallbackService: AuthService;

    beforeEach(async () => {
      jest.clearAllMocks();
      fallbackService = await createTestModule(null);
    });

    it('should record failed attempts and lock out using in-memory Map', async () => {
      mockVerifyAccessToken.mockRejectedValue(new Error('Invalid token'));
      const ip = '10.0.0.20';

      // First 5 attempts should throw UnauthorizedException
      for (let i = 0; i < 5; i++) {
        await expect(fallbackService.login('bad-token', ip)).rejects.toThrow(
          UnauthorizedException,
        );
      }

      // 6th attempt should throw AccountLockedException
      await expect(fallbackService.login('any-token', ip)).rejects.toThrow(
        AccountLockedException,
      );
    });

    it('should clear failed attempts on successful login in in-memory mode', async () => {
      mockVerifyAccessToken.mockRejectedValue(new Error('Invalid token'));
      const ip = '10.0.0.21';

      // Record 3 failed attempts
      for (let i = 0; i < 3; i++) {
        await expect(fallbackService.login('bad-token', ip)).rejects.toThrow(
          UnauthorizedException,
        );
      }

      // Successful login clears
      mockVerifyAccessToken.mockResolvedValue({ user_id: 'did:privy:abc123' });
      mockGetUser.mockResolvedValue(mockPrivyUser);
      prisma.user.findUnique.mockResolvedValue(mockDbUser);
      prisma.user.update.mockResolvedValue(mockDbUser);

      const result = await fallbackService.login('valid-token', ip);
      expect(result.user.id).toBe('user-uuid-1');

      // After clearing, 5 more failures needed to lock
      mockVerifyAccessToken.mockRejectedValue(new Error('Invalid token'));
      for (let i = 0; i < 4; i++) {
        await expect(fallbackService.login('bad-token', ip)).rejects.toThrow(
          UnauthorizedException,
        );
      }
      // Still not locked (only 4 after clear)
      await expect(fallbackService.login('bad-token', ip)).rejects.toThrow(
        UnauthorizedException,
      );

      // Now locked after 5th
      await expect(fallbackService.login('any-token', ip)).rejects.toThrow(
        AccountLockedException,
      );
    });

    it('should not use Redis when REDIS_CLIENT is null', async () => {
      mockVerifyAccessToken.mockRejectedValue(new Error('Invalid token'));
      await expect(fallbackService.login('bad', '10.0.0.22')).rejects.toThrow(UnauthorizedException);

      // mockRedis should not have been called (it's a fresh one from beforeEach above,
      // but fallbackService was created with null Redis)
      expect(mockRedis.get).not.toHaveBeenCalled();
      expect(mockRedis.incr).not.toHaveBeenCalled();
    });
  });

  describe('lockout (Redis error fallback)', () => {
    let errorService: AuthService;
    let errorRedis: { get: jest.Mock; incr: jest.Mock; expire: jest.Mock; del: jest.Mock };

    beforeEach(async () => {
      jest.clearAllMocks();
      errorRedis = {
        get: jest.fn().mockRejectedValue(new Error('Redis connection refused')),
        incr: jest.fn().mockRejectedValue(new Error('Redis connection refused')),
        expire: jest.fn().mockRejectedValue(new Error('Redis connection refused')),
        del: jest.fn().mockRejectedValue(new Error('Redis connection refused')),
      };
      errorService = await createTestModule(errorRedis);
    });

    it('should fall back to in-memory when Redis GET fails', async () => {
      mockVerifyAccessToken.mockRejectedValue(new Error('Invalid token'));
      const ip = '10.0.0.30';

      // Redis fails, but in-memory fallback works
      for (let i = 0; i < 5; i++) {
        await expect(errorService.login('bad-token', ip)).rejects.toThrow(
          UnauthorizedException,
        );
      }

      // 6th attempt locks via in-memory fallback
      await expect(errorService.login('any-token', ip)).rejects.toThrow(
        AccountLockedException,
      );
    });

    it('should attempt Redis first then fall back on every call', async () => {
      mockVerifyAccessToken.mockRejectedValue(new Error('Invalid token'));
      await expect(errorService.login('bad', '10.0.0.31')).rejects.toThrow(UnauthorizedException);

      // Redis was attempted for both checkLockout (GET) and recordFailedAttempt (INCR)
      expect(errorRedis.get).toHaveBeenCalledWith('lockout:10.0.0.31');
      expect(errorRedis.incr).toHaveBeenCalledWith('lockout:10.0.0.31');
    });
  });

  describe('getUserById', () => {
    it('should return authenticated user by database ID', async () => {
      prisma.user.findUnique.mockResolvedValue(mockDbUser);

      const result = await service.getUserById('user-uuid-1');

      expect(result).toEqual({
        id: 'user-uuid-1',
        privyUserId: 'did:privy:abc123',
        email: 'test@example.com',
        walletAddress: '0x1234567890abcdef',
        firstName: 'Test',
        lastName: 'User',
        kycStatus: 'NOT_STARTED',
        locale: 'pt-BR',
      });
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-uuid-1' },
      });
    });

    it('should throw UnauthorizedException when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getUserById('nonexistent')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when user is soft-deleted', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...mockDbUser,
        deletedAt: new Date(),
      });

      await expect(service.getUserById('user-uuid-1')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('getProfile', () => {
    it('should return user profile', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-uuid-1',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        walletAddress: '0x1234567890abcdef',
        profilePictureUrl: null,
        kycStatus: 'NOT_STARTED',
        locale: 'pt-BR',
        lastLoginAt: new Date(),
        createdAt: new Date(),
      });

      const result = await service.getProfile('user-uuid-1');

      expect(result.id).toBe('user-uuid-1');
      expect(result.email).toBe('test@example.com');
    });

    it('should throw UnauthorizedException when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getProfile('nonexistent')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('updateProfile', () => {
    it('should update firstName and lastName', async () => {
      const updatedUser = {
        ...mockDbUser,
        firstName: 'João',
        lastName: 'Silva',
      };
      prisma.user.update.mockResolvedValue(updatedUser);

      const result = await service.updateProfile('user-uuid-1', {
        firstName: 'João',
        lastName: 'Silva',
      });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-uuid-1' },
        data: { firstName: 'João', lastName: 'Silva' },
        select: expect.objectContaining({
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        }),
      });
      expect(result.firstName).toBe('João');
      expect(result.lastName).toBe('Silva');
    });

    it('should update email when not duplicate', async () => {
      prisma.user.findUnique.mockResolvedValue(null); // No existing user with this email
      const updatedUser = {
        ...mockDbUser,
        email: 'new@example.com',
      };
      prisma.user.update.mockResolvedValue(updatedUser);

      const result = await service.updateProfile('user-uuid-1', {
        email: 'new@example.com',
      });

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'new@example.com' },
      });
      expect(result.email).toBe('new@example.com');
    });

    it('should allow updating email to own email', async () => {
      // User trying to update email to their own current email
      prisma.user.findUnique.mockResolvedValue({
        ...mockDbUser,
        id: 'user-uuid-1', // Same user ID
      });
      prisma.user.update.mockResolvedValue(mockDbUser);

      await expect(
        service.updateProfile('user-uuid-1', { email: 'test@example.com' }),
      ).resolves.toBeDefined();
    });

    it('should throw ConflictException for duplicate email', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...mockDbUser,
        id: 'different-user-id', // Different user owns this email
      });

      await expect(
        service.updateProfile('user-uuid-1', {
          email: 'taken@example.com',
        }),
      ).rejects.toThrow(AppException);

      await expect(
        service.updateProfile('user-uuid-1', {
          email: 'taken@example.com',
        }),
      ).rejects.toMatchObject({
        code: 'AUTH_DUPLICATE_EMAIL',
      });
    });

    it('should skip email uniqueness check when email not provided', async () => {
      prisma.user.update.mockResolvedValue(mockDbUser);

      await service.updateProfile('user-uuid-1', {
        firstName: 'Updated',
      });

      // findUnique should not be called for email check
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('should handle partial updates', async () => {
      prisma.user.update.mockResolvedValue({
        ...mockDbUser,
        firstName: 'OnlyFirst',
      });

      await service.updateProfile('user-uuid-1', {
        firstName: 'OnlyFirst',
      });

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { firstName: 'OnlyFirst' },
        }),
      );
    });
  });

  describe('AccountLockedException', () => {
    it('should have correct code and status', () => {
      const ex = new AccountLockedException();
      expect(ex.code).toBe('AUTH_ACCOUNT_LOCKED');
      expect(ex.statusCode).toBe(HttpStatus.TOO_MANY_REQUESTS);
    });
  });

  describe('PrivyUnavailableException', () => {
    it('should have correct code and status', () => {
      const ex = new PrivyUnavailableException();
      expect(ex.code).toBe('AUTH_PRIVY_UNAVAILABLE');
      expect(ex.statusCode).toBe(HttpStatus.BAD_GATEWAY);
    });
  });
});
