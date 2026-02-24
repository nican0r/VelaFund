import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from './redis.module';
import { REDIS_CLIENT } from './redis.constants';

// Mock ioredis to avoid real connections in tests
const mockOn = jest.fn().mockReturnThis();
const mockQuit = jest.fn().mockResolvedValue('OK');

jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    on: mockOn,
    quit: mockQuit,
  })),
}));

describe('RedisModule', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('when REDIS_URL is configured', () => {
    let module: TestingModule;

    beforeEach(async () => {
      module = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            isGlobal: true,
            ignoreEnvFile: true,
            load: [() => ({ REDIS_URL: 'redis://localhost:6379' })],
          }),
          RedisModule,
        ],
      }).compile();
    });

    afterEach(async () => {
      await module.close();
    });

    it('should provide a Redis client', () => {
      const redis = module.get(REDIS_CLIENT);
      expect(redis).toBeDefined();
      expect(redis).not.toBeNull();
    });

    it('should create Redis with correct URL and options', () => {
      const Redis = require('ioredis').default;
      expect(Redis).toHaveBeenCalledWith('redis://localhost:6379', {
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        retryStrategy: expect.any(Function),
      });
    });

    it('should register error and connect event handlers', () => {
      expect(mockOn).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith('connect', expect.any(Function));
    });

    it('should disconnect on module destroy', async () => {
      const redisModule = module.get(RedisModule);
      await redisModule.onModuleDestroy();
      expect(mockQuit).toHaveBeenCalled();
    });
  });

  describe('when REDIS_URL is not configured', () => {
    let module: TestingModule;

    beforeEach(async () => {
      module = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            isGlobal: true,
            ignoreEnvFile: true,
            load: [() => ({})],
          }),
          RedisModule,
        ],
      }).compile();
    });

    afterEach(async () => {
      await module.close();
    });

    it('should provide null when REDIS_URL is not set', () => {
      const redis = module.get(REDIS_CLIENT);
      expect(redis).toBeNull();
    });

    it('should not crash on module destroy when redis is null', async () => {
      const redisModule = module.get(RedisModule);
      await expect(redisModule.onModuleDestroy()).resolves.not.toThrow();
    });
  });

  describe('retryStrategy', () => {
    it('should increase delay with each attempt up to 3s and stop after 10', async () => {
      const module = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            isGlobal: true,
            ignoreEnvFile: true,
            load: [() => ({ REDIS_URL: 'redis://test:6379' })],
          }),
          RedisModule,
        ],
      }).compile();

      const Redis = require('ioredis').default;
      const lastCall = Redis.mock.calls[Redis.mock.calls.length - 1];
      const retryStrategy = lastCall[1]?.retryStrategy;

      expect(retryStrategy).toBeDefined();
      expect(retryStrategy(1)).toBe(200);   // min(200, 3000)
      expect(retryStrategy(5)).toBe(1000);  // min(1000, 3000)
      expect(retryStrategy(10)).toBe(2000); // min(2000, 3000), last valid attempt
      expect(retryStrategy(11)).toBeNull(); // times > 10 → stop retrying
      expect(retryStrategy(15)).toBeNull(); // also stopped

      await module.close();
    });
  });
});
