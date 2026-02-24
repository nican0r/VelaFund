import { Test, TestingModule } from '@nestjs/testing';
import { SessionService, SessionData } from './session.service';
import { REDIS_CLIENT } from '../redis/redis.constants';

describe('SessionService', () => {
  let service: SessionService;
  let mockRedis: {
    get: jest.Mock;
    set: jest.Mock;
    del: jest.Mock;
    sadd: jest.Mock;
    srem: jest.Mock;
    smembers: jest.Mock;
    expire: jest.Mock;
    ttl: jest.Mock;
  };

  beforeEach(async () => {
    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      sadd: jest.fn(),
      srem: jest.fn(),
      smembers: jest.fn(),
      expire: jest.fn(),
      ttl: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        { provide: REDIS_CLIENT, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<SessionService>(SessionService);
  });

  describe('createSession', () => {
    it('should create a session in Redis and return session ID', async () => {
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.sadd.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      const sessionId = await service.createSession('user-1', {
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      });

      expect(sessionId).toBeDefined();
      expect(sessionId).toHaveLength(64); // 32 bytes hex
      expect(mockRedis.set).toHaveBeenCalledWith(
        `session:${sessionId}`,
        expect.any(String),
        'EX',
        SessionService.ABSOLUTE_TIMEOUT_S,
      );

      // Verify session data was stored
      const storedData = JSON.parse(mockRedis.set.mock.calls[0][1]);
      expect(storedData.userId).toBe('user-1');
      expect(storedData.ipAddress).toBe('192.168.1.1');
      expect(storedData.userAgent).toBe('Mozilla/5.0');
      expect(storedData.createdAt).toBeGreaterThan(0);
      expect(storedData.lastActivityAt).toBe(storedData.createdAt);

      // Verify user-sessions tracking
      expect(mockRedis.sadd).toHaveBeenCalledWith(
        'user-sessions:user-1',
        sessionId,
      );
      expect(mockRedis.expire).toHaveBeenCalledWith(
        'user-sessions:user-1',
        SessionService.ABSOLUTE_TIMEOUT_S + 3600,
      );
    });

    it('should return null when Redis is not available', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SessionService,
          { provide: REDIS_CLIENT, useValue: null },
        ],
      }).compile();

      const nullRedisService = module.get<SessionService>(SessionService);
      const result = await nullRedisService.createSession('user-1', {
        ipAddress: '1.2.3.4',
        userAgent: 'test',
      });

      expect(result).toBeNull();
    });

    it('should return null when Redis throws an error', async () => {
      mockRedis.set.mockRejectedValue(new Error('Connection refused'));

      const result = await service.createSession('user-1', {
        ipAddress: '1.2.3.4',
        userAgent: 'test',
      });

      expect(result).toBeNull();
    });
  });

  describe('getSession', () => {
    const mockSession: SessionData = {
      userId: 'user-1',
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
    };

    it('should return session data when found', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify(mockSession));

      const result = await service.getSession('abc123');

      expect(result).toEqual(mockSession);
      expect(mockRedis.get).toHaveBeenCalledWith('session:abc123');
    });

    it('should return null when session not found', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await service.getSession('nonexistent');

      expect(result).toBeNull();
    });

    it('should return null when Redis is not available', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SessionService,
          { provide: REDIS_CLIENT, useValue: null },
        ],
      }).compile();

      const nullRedisService = module.get<SessionService>(SessionService);
      const result = await nullRedisService.getSession('abc123');

      expect(result).toBeNull();
    });

    it('should return null when session data is corrupted', async () => {
      mockRedis.get.mockResolvedValue('not-valid-json{{{');

      const result = await service.getSession('corrupted');

      expect(result).toBeNull();
    });

    it('should return null when Redis throws an error', async () => {
      mockRedis.get.mockRejectedValue(new Error('Connection refused'));

      const result = await service.getSession('abc123');

      expect(result).toBeNull();
    });
  });

  describe('isInactive', () => {
    it('should return false for a recently active session', () => {
      const session: SessionData = {
        userId: 'user-1',
        createdAt: Date.now() - 60_000,
        lastActivityAt: Date.now() - 60_000, // 1 minute ago
        ipAddress: '1.2.3.4',
        userAgent: 'test',
      };

      expect(service.isInactive(session)).toBe(false);
    });

    it('should return true for a session inactive for over 2 hours', () => {
      const session: SessionData = {
        userId: 'user-1',
        createdAt: Date.now() - 3 * 60 * 60 * 1000,
        lastActivityAt: Date.now() - 2 * 60 * 60 * 1000 - 1, // 2h + 1ms ago
        ipAddress: '1.2.3.4',
        userAgent: 'test',
      };

      expect(service.isInactive(session)).toBe(true);
    });

    it('should return false for a session at exactly the inactivity threshold', () => {
      const session: SessionData = {
        userId: 'user-1',
        createdAt: Date.now() - 3 * 60 * 60 * 1000,
        lastActivityAt: Date.now() - SessionService.INACTIVITY_TIMEOUT_MS, // Exactly at threshold
        ipAddress: '1.2.3.4',
        userAgent: 'test',
      };

      // At exactly the threshold, Date.now() - lastActivityAt === INACTIVITY_TIMEOUT_MS
      // The check is > (not >=), so exactly at threshold is NOT inactive
      expect(service.isInactive(session)).toBe(false);
    });
  });

  describe('touchSession', () => {
    it('should update lastActivityAt in Redis preserving TTL', async () => {
      mockRedis.ttl.mockResolvedValue(600000); // 600000 seconds remaining
      mockRedis.set.mockResolvedValue('OK');

      const session: SessionData = {
        userId: 'user-1',
        createdAt: Date.now() - 120_000,
        lastActivityAt: Date.now() - 120_000, // 2 minutes ago (over threshold)
        ipAddress: '1.2.3.4',
        userAgent: 'test',
      };

      await service.touchSession('session-id', session);

      expect(mockRedis.ttl).toHaveBeenCalledWith('session:session-id');
      expect(mockRedis.set).toHaveBeenCalledWith(
        'session:session-id',
        expect.any(String),
        'EX',
        600000,
      );

      // Verify lastActivityAt was updated
      const updatedData = JSON.parse(mockRedis.set.mock.calls[0][1]);
      expect(updatedData.lastActivityAt).toBeGreaterThan(session.createdAt);
    });

    it('should skip update when last activity was within 60 seconds', async () => {
      const session: SessionData = {
        userId: 'user-1',
        createdAt: Date.now() - 30_000,
        lastActivityAt: Date.now() - 30_000, // 30 seconds ago (under threshold)
        ipAddress: '1.2.3.4',
        userAgent: 'test',
      };

      await service.touchSession('session-id', session);

      expect(mockRedis.ttl).not.toHaveBeenCalled();
      expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it('should not update when TTL is zero or negative', async () => {
      mockRedis.ttl.mockResolvedValue(0);

      const session: SessionData = {
        userId: 'user-1',
        createdAt: Date.now() - 120_000,
        lastActivityAt: Date.now() - 120_000,
        ipAddress: '1.2.3.4',
        userAgent: 'test',
      };

      await service.touchSession('session-id', session);

      expect(mockRedis.ttl).toHaveBeenCalled();
      expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.ttl.mockRejectedValue(new Error('Connection error'));

      const session: SessionData = {
        userId: 'user-1',
        createdAt: Date.now() - 120_000,
        lastActivityAt: Date.now() - 120_000,
        ipAddress: '1.2.3.4',
        userAgent: 'test',
      };

      // Should not throw
      await expect(
        service.touchSession('session-id', session),
      ).resolves.not.toThrow();
    });

    it('should be a no-op when Redis is not available', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SessionService,
          { provide: REDIS_CLIENT, useValue: null },
        ],
      }).compile();

      const nullRedisService = module.get<SessionService>(SessionService);
      const session: SessionData = {
        userId: 'user-1',
        createdAt: Date.now() - 120_000,
        lastActivityAt: Date.now() - 120_000,
        ipAddress: '1.2.3.4',
        userAgent: 'test',
      };

      await expect(
        nullRedisService.touchSession('session-id', session),
      ).resolves.not.toThrow();
    });
  });

  describe('destroySession', () => {
    it('should delete session and remove from user sessions set', async () => {
      const session: SessionData = {
        userId: 'user-1',
        createdAt: Date.now(),
        lastActivityAt: Date.now(),
        ipAddress: '1.2.3.4',
        userAgent: 'test',
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(session));
      mockRedis.srem.mockResolvedValue(1);
      mockRedis.del.mockResolvedValue(1);

      await service.destroySession('session-id');

      expect(mockRedis.get).toHaveBeenCalledWith('session:session-id');
      expect(mockRedis.srem).toHaveBeenCalledWith(
        'user-sessions:user-1',
        'session-id',
      );
      expect(mockRedis.del).toHaveBeenCalledWith('session:session-id');
    });

    it('should handle session not found gracefully', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.del.mockResolvedValue(0);

      await expect(service.destroySession('nonexistent')).resolves.not.toThrow();
      expect(mockRedis.del).toHaveBeenCalledWith('session:nonexistent');
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.get.mockRejectedValue(new Error('Connection error'));

      await expect(
        service.destroySession('session-id'),
      ).resolves.not.toThrow();
    });

    it('should be a no-op when Redis is not available', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SessionService,
          { provide: REDIS_CLIENT, useValue: null },
        ],
      }).compile();

      const nullRedisService = module.get<SessionService>(SessionService);
      await expect(
        nullRedisService.destroySession('session-id'),
      ).resolves.not.toThrow();
    });
  });

  describe('destroyAllUserSessions', () => {
    it('should destroy all sessions for a user', async () => {
      mockRedis.smembers.mockResolvedValue(['sess-1', 'sess-2', 'sess-3']);
      mockRedis.del.mockResolvedValue(3);

      await service.destroyAllUserSessions('user-1');

      expect(mockRedis.smembers).toHaveBeenCalledWith('user-sessions:user-1');
      // First del: session keys
      expect(mockRedis.del).toHaveBeenCalledWith(
        'session:sess-1',
        'session:sess-2',
        'session:sess-3',
      );
      // Second del: user sessions set
      expect(mockRedis.del).toHaveBeenCalledWith('user-sessions:user-1');
    });

    it('should handle user with no sessions', async () => {
      mockRedis.smembers.mockResolvedValue([]);
      mockRedis.del.mockResolvedValue(0);

      await service.destroyAllUserSessions('user-1');

      // Should only delete the user sessions set
      expect(mockRedis.del).toHaveBeenCalledTimes(1);
      expect(mockRedis.del).toHaveBeenCalledWith('user-sessions:user-1');
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.smembers.mockRejectedValue(new Error('Connection error'));

      await expect(
        service.destroyAllUserSessions('user-1'),
      ).resolves.not.toThrow();
    });

    it('should be a no-op when Redis is not available', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SessionService,
          { provide: REDIS_CLIENT, useValue: null },
        ],
      }).compile();

      const nullRedisService = module.get<SessionService>(SessionService);
      await expect(
        nullRedisService.destroyAllUserSessions('user-1'),
      ).resolves.not.toThrow();
    });
  });

  describe('isAvailable', () => {
    it('should return true when Redis client is provided', () => {
      expect(service.isAvailable()).toBe(true);
    });

    it('should return false when Redis client is null', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SessionService,
          { provide: REDIS_CLIENT, useValue: null },
        ],
      }).compile();

      const nullRedisService = module.get<SessionService>(SessionService);
      expect(nullRedisService.isAvailable()).toBe(false);
    });
  });

  describe('timeout constants', () => {
    it('should have 7-day absolute timeout', () => {
      expect(SessionService.ABSOLUTE_TIMEOUT_S).toBe(7 * 24 * 60 * 60);
    });

    it('should have 2-hour inactivity timeout', () => {
      expect(SessionService.INACTIVITY_TIMEOUT_MS).toBe(2 * 60 * 60 * 1000);
    });
  });
});
