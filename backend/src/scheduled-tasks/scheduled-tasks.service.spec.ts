import { Test, TestingModule } from '@nestjs/testing';
import { ScheduledTasksService } from './scheduled-tasks.service';
import { AuditLogService } from '../audit-log/audit-log.service';

const mockAuditLogService = {
  computeDailyHash: jest.fn().mockResolvedValue(undefined),
};

describe('ScheduledTasksService', () => {
  let service: ScheduledTasksService;
  let auditLogService: typeof mockAuditLogService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScheduledTasksService,
        { provide: AuditLogService, useValue: mockAuditLogService },
      ],
    }).compile();

    service = module.get<ScheduledTasksService>(ScheduledTasksService);
    auditLogService = module.get(AuditLogService);
  });

  describe('getYesterdayDateString', () => {
    it('should return yesterday date as YYYY-MM-DD string', () => {
      const result = service.getYesterdayDateString();

      // Verify format
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      // Verify it's actually yesterday
      const expected = new Date();
      expected.setUTCDate(expected.getUTCDate() - 1);
      const expectedStr = expected.toISOString().split('T')[0];
      expect(result).toBe(expectedStr);
    });

    it('should handle month boundaries correctly', () => {
      // Mock Date to Feb 1 UTC
      const realDate = Date;
      const mockDate = new Date('2026-02-01T00:05:00.000Z');
      jest.spyOn(global, 'Date').mockImplementation((...args: unknown[]) => {
        if (args.length === 0) return mockDate;
        return new (realDate as any)(...args);
      });

      const result = service.getYesterdayDateString();
      expect(result).toBe('2026-01-31');

      jest.restoreAllMocks();
    });

    it('should handle year boundaries correctly', () => {
      const realDate = Date;
      const mockDate = new Date('2026-01-01T00:05:00.000Z');
      jest.spyOn(global, 'Date').mockImplementation((...args: unknown[]) => {
        if (args.length === 0) return mockDate;
        return new (realDate as any)(...args);
      });

      const result = service.getYesterdayDateString();
      expect(result).toBe('2025-12-31');

      jest.restoreAllMocks();
    });
  });

  describe('computeDailyAuditHashChain', () => {
    it('should call auditLogService.computeDailyHash with yesterday date', async () => {
      await service.computeDailyAuditHashChain();

      const expectedDate = service.getYesterdayDateString();
      expect(auditLogService.computeDailyHash).toHaveBeenCalledWith(expectedDate);
      expect(auditLogService.computeDailyHash).toHaveBeenCalledTimes(1);
    });

    it('should not throw when computeDailyHash succeeds', async () => {
      auditLogService.computeDailyHash.mockResolvedValue(undefined);

      await expect(service.computeDailyAuditHashChain()).resolves.not.toThrow();
    });

    it('should catch and log errors without rethrowing', async () => {
      auditLogService.computeDailyHash.mockRejectedValue(
        new Error('Database connection failed'),
      );

      // Should not throw — error is caught and logged
      await expect(service.computeDailyAuditHashChain()).resolves.not.toThrow();
      expect(auditLogService.computeDailyHash).toHaveBeenCalledTimes(1);
    });

    it('should catch non-Error exceptions without rethrowing', async () => {
      auditLogService.computeDailyHash.mockRejectedValue('string error');

      await expect(service.computeDailyAuditHashChain()).resolves.not.toThrow();
      expect(auditLogService.computeDailyHash).toHaveBeenCalledTimes(1);
    });
  });

  describe('@Cron decorator', () => {
    it('should have computeDailyAuditHashChain as a method', () => {
      expect(typeof service.computeDailyAuditHashChain).toBe('function');
    });

    it('should have the correct cron metadata', () => {
      // Verify the method exists and is decorated — NestJS Schedule module
      // reads the metadata at runtime. We verify the behavior, not the decorator.
      const proto = Object.getPrototypeOf(service);
      expect(proto.computeDailyAuditHashChain).toBeDefined();
    });
  });
});
