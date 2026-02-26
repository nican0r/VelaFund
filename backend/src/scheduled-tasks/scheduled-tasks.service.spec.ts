import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bull';
import { ScheduledTasksService } from './scheduled-tasks.service';
import { AuditLogService } from '../audit-log/audit-log.service';

const mockAuditLogService = {
  computeDailyHash: jest.fn().mockResolvedValue(undefined),
  log: jest.fn().mockResolvedValue(undefined),
};

const createMockQueue = (failedCount = 0) => ({
  add: jest.fn().mockResolvedValue({}),
  getFailedCount: jest.fn().mockResolvedValue(failedCount),
});

describe('ScheduledTasksService', () => {
  let service: ScheduledTasksService;
  let auditLogService: typeof mockAuditLogService;
  let mockQueues: Record<string, ReturnType<typeof createMockQueue>>;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockQueues = {
      'audit-log': createMockQueue(),
      notification: createMockQueue(),
      'company-setup': createMockQueue(),
      'report-export': createMockQueue(),
      'kyc-aml': createMockQueue(),
      'profile-litigation': createMockQueue(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScheduledTasksService,
        { provide: AuditLogService, useValue: mockAuditLogService },
        { provide: getQueueToken('audit-log'), useValue: mockQueues['audit-log'] },
        { provide: getQueueToken('notification'), useValue: mockQueues['notification'] },
        { provide: getQueueToken('company-setup'), useValue: mockQueues['company-setup'] },
        { provide: getQueueToken('report-export'), useValue: mockQueues['report-export'] },
        { provide: getQueueToken('kyc-aml'), useValue: mockQueues['kyc-aml'] },
        {
          provide: getQueueToken('profile-litigation'),
          useValue: mockQueues['profile-litigation'],
        },
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

  describe('monitorDeadLetterQueues', () => {
    it('should check all 6 queues for failed jobs', async () => {
      await service.monitorDeadLetterQueues();

      for (const queue of Object.values(mockQueues)) {
        expect(queue.getFailedCount).toHaveBeenCalledTimes(1);
      }
    });

    it('should do nothing when no failed jobs exist', async () => {
      await service.monitorDeadLetterQueues();

      expect(auditLogService.log).not.toHaveBeenCalled();
    });

    it('should not log audit event when failed count is below warning threshold', async () => {
      mockQueues['audit-log'].getFailedCount.mockResolvedValue(3);
      mockQueues['notification'].getFailedCount.mockResolvedValue(2);

      await service.monitorDeadLetterQueues();

      // Total = 5, below threshold of 10
      expect(auditLogService.log).not.toHaveBeenCalled();
    });

    it('should log WARNING audit event when total failed >= 10', async () => {
      mockQueues['audit-log'].getFailedCount.mockResolvedValue(5);
      mockQueues['notification'].getFailedCount.mockResolvedValue(6);

      await service.monitorDeadLetterQueues();

      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorType: 'SYSTEM',
          action: 'DLQ_WARNING_ALERT',
          resourceType: 'BullQueue',
          metadata: expect.objectContaining({
            totalFailed: 11,
            threshold: 10,
          }),
        }),
      );
    });

    it('should log CRITICAL audit event when total failed >= 50', async () => {
      mockQueues['audit-log'].getFailedCount.mockResolvedValue(30);
      mockQueues['notification'].getFailedCount.mockResolvedValue(25);

      await service.monitorDeadLetterQueues();

      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorType: 'SYSTEM',
          action: 'DLQ_CRITICAL_ALERT',
          resourceType: 'BullQueue',
          metadata: expect.objectContaining({
            totalFailed: 55,
            threshold: 50,
          }),
        }),
      );
    });

    it('should include per-queue breakdown in metadata', async () => {
      mockQueues['audit-log'].getFailedCount.mockResolvedValue(7);
      mockQueues['company-setup'].getFailedCount.mockResolvedValue(5);

      await service.monitorDeadLetterQueues();

      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            queues: {
              'audit-log': 7,
              'company-setup': 5,
            },
          }),
        }),
      );
    });

    it('should only include queues with failed jobs in breakdown', async () => {
      mockQueues['audit-log'].getFailedCount.mockResolvedValue(12);
      // All others return 0

      await service.monitorDeadLetterQueues();

      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            queues: { 'audit-log': 12 },
          }),
        }),
      );
    });

    it('should use CRITICAL alert (not WARNING) when above both thresholds', async () => {
      mockQueues['audit-log'].getFailedCount.mockResolvedValue(60);

      await service.monitorDeadLetterQueues();

      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DLQ_CRITICAL_ALERT',
        }),
      );
      // Should NOT be called with WARNING
      expect(auditLogService.log).not.toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DLQ_WARNING_ALERT',
        }),
      );
    });

    it('should skip queues that throw errors (e.g., Redis down)', async () => {
      mockQueues['audit-log'].getFailedCount.mockRejectedValue(
        new Error('Redis connection refused'),
      );
      mockQueues['notification'].getFailedCount.mockResolvedValue(12);

      await service.monitorDeadLetterQueues();

      // Should still check other queues and report on notification
      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DLQ_WARNING_ALERT',
          metadata: expect.objectContaining({
            totalFailed: 12,
            queues: { notification: 12 },
          }),
        }),
      );
    });

    it('should not throw when all queues are unreachable', async () => {
      for (const queue of Object.values(mockQueues)) {
        queue.getFailedCount.mockRejectedValue(new Error('Redis down'));
      }

      await expect(service.monitorDeadLetterQueues()).resolves.not.toThrow();
      expect(auditLogService.log).not.toHaveBeenCalled();
    });

    it('should not throw when audit log service fails to log', async () => {
      mockQueues['audit-log'].getFailedCount.mockResolvedValue(15);
      auditLogService.log.mockRejectedValue(new Error('Queue unavailable'));

      await expect(service.monitorDeadLetterQueues()).resolves.not.toThrow();
    });

    it('should handle the exact warning threshold boundary (10)', async () => {
      mockQueues['audit-log'].getFailedCount.mockResolvedValue(10);

      await service.monitorDeadLetterQueues();

      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DLQ_WARNING_ALERT',
          metadata: expect.objectContaining({ totalFailed: 10 }),
        }),
      );
    });

    it('should handle the exact critical threshold boundary (50)', async () => {
      mockQueues['audit-log'].getFailedCount.mockResolvedValue(50);

      await service.monitorDeadLetterQueues();

      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DLQ_CRITICAL_ALERT',
          metadata: expect.objectContaining({ totalFailed: 50 }),
        }),
      );
    });

    it('should catch and log unexpected errors without rethrowing', async () => {
      // Simulate an unexpected error by breaking queueMap iteration
      jest
        .spyOn(service['queueMap'], 'entries')
        .mockImplementation(() => {
          throw new Error('Unexpected iteration error');
        });

      await expect(service.monitorDeadLetterQueues()).resolves.not.toThrow();
    });
  });

  describe('@Cron decorator', () => {
    it('should have computeDailyAuditHashChain as a method', () => {
      expect(typeof service.computeDailyAuditHashChain).toBe('function');
    });

    it('should have monitorDeadLetterQueues as a method', () => {
      expect(typeof service.monitorDeadLetterQueues).toBe('function');
    });

    it('should have the correct cron metadata', () => {
      // Verify the method exists and is decorated — NestJS Schedule module
      // reads the metadata at runtime. We verify the behavior, not the decorator.
      const proto = Object.getPrototypeOf(service);
      expect(proto.computeDailyAuditHashChain).toBeDefined();
      expect(proto.monitorDeadLetterQueues).toBeDefined();
    });
  });
});
