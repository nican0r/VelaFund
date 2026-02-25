import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.constants';
import { S3Service } from '../aws/s3.service';

describe('HealthController', () => {
  let controller: HealthController;
  let prisma: { $queryRaw: jest.Mock };
  let mockRedis: { ping: jest.Mock };
  let mockS3Service: { isAvailable: jest.Mock };

  beforeEach(async () => {
    prisma = { $queryRaw: jest.fn() };
    mockRedis = { ping: jest.fn() };
    mockS3Service = { isAvailable: jest.fn().mockReturnValue(true) };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: REDIS_CLIENT, useValue: mockRedis },
        { provide: S3Service, useValue: mockS3Service },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('check', () => {
    it('should return healthy when all services are up', async () => {
      prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockRedis.ping.mockResolvedValue('PONG');

      const result = await controller.check();

      expect(result.status).toBe('healthy');
      expect(result.services.database).toBe('up');
      expect(result.services.redis).toBe('up');
      expect(result.services.s3).toBe('configured');
      expect(result.timestamp).toBeDefined();
    });

    it('should return degraded when database is down', async () => {
      prisma.$queryRaw.mockRejectedValue(new Error('Connection refused'));
      mockRedis.ping.mockResolvedValue('PONG');

      const result = await controller.check();

      expect(result.status).toBe('degraded');
      expect(result.services.database).toBe('down');
      expect(result.services.redis).toBe('up');
    });

    it('should return degraded when redis is down', async () => {
      prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockRedis.ping.mockRejectedValue(new Error('Redis connection refused'));

      const result = await controller.check();

      expect(result.status).toBe('degraded');
      expect(result.services.database).toBe('up');
      expect(result.services.redis).toBe('down');
    });

    it('should return degraded when both services are down', async () => {
      prisma.$queryRaw.mockRejectedValue(new Error('DB connection refused'));
      mockRedis.ping.mockRejectedValue(new Error('Redis connection refused'));

      const result = await controller.check();

      expect(result.status).toBe('degraded');
      expect(result.services.database).toBe('down');
      expect(result.services.redis).toBe('down');
    });

    it('should return ISO timestamp', async () => {
      prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockRedis.ping.mockResolvedValue('PONG');

      const result = await controller.check();

      expect(result.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
      );
    });

    it('should report S3 as configured when available', async () => {
      prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockRedis.ping.mockResolvedValue('PONG');

      const result = await controller.check();

      expect(result.services.s3).toBe('configured');
    });

    it('should report S3 as unconfigured when unavailable', async () => {
      prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockRedis.ping.mockResolvedValue('PONG');
      mockS3Service.isAvailable.mockReturnValue(false);

      const result = await controller.check();

      expect(result.services.s3).toBe('unconfigured');
    });
  });
});

describe('HealthController (Redis unconfigured)', () => {
  let controller: HealthController;
  let prisma: { $queryRaw: jest.Mock };

  beforeEach(async () => {
    prisma = { $queryRaw: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: REDIS_CLIENT, useValue: null },
        { provide: S3Service, useValue: { isAvailable: () => false } },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should report redis as unconfigured when REDIS_CLIENT is null', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const result = await controller.check();

    expect(result.status).toBe('degraded');
    expect(result.services.database).toBe('up');
    expect(result.services.redis).toBe('unconfigured');
  });

  it('should report degraded when db down and redis unconfigured', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('DB down'));

    const result = await controller.check();

    expect(result.status).toBe('degraded');
    expect(result.services.database).toBe('down');
    expect(result.services.redis).toBe('unconfigured');
  });
});
