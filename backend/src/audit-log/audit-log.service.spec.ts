import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bull';
import { AuditLogService } from './audit-log.service';
import { PrismaService } from '../prisma/prisma.service';

const mockQueue = {
  add: jest.fn().mockResolvedValue({ id: 'job-1' }),
};

const mockAuditLog = {
  id: 'audit-uuid-1',
  timestamp: new Date('2026-02-20T14:30:00.000Z'),
  actorId: 'user-uuid-1',
  actorType: 'USER',
  action: 'SHAREHOLDER_CREATED',
  resourceType: 'Shareholder',
  resourceId: 'shareholder-uuid-1',
  companyId: 'company-uuid-1',
  changes: {
    before: null,
    after: { name: 'João Silva', type: 'INDIVIDUAL' },
  },
  metadata: {
    ipAddress: '192.168.1.0/24',
    requestId: 'req-uuid-1',
    source: 'api',
  },
  actor: {
    id: 'user-uuid-1',
    firstName: 'Nelson',
    lastName: 'Pereira',
    email: 'nelson@example.com',
  },
};

const mockPrisma = {
  auditLog: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
  },
  auditHashChain: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    upsert: jest.fn(),
  },
};

describe('AuditLogService', () => {
  let service: AuditLogService;
  let queue: typeof mockQueue;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: getQueueToken('audit-log'), useValue: mockQueue },
      ],
    }).compile();

    service = module.get<AuditLogService>(AuditLogService);
    queue = module.get(getQueueToken('audit-log'));
  });

  describe('log', () => {
    it('should queue an audit event with correct payload', async () => {
      await service.log({
        actorId: 'user-uuid-1',
        actorType: 'USER',
        action: 'SHAREHOLDER_CREATED',
        resourceType: 'Shareholder',
        resourceId: 'shareholder-uuid-1',
        companyId: 'company-uuid-1',
        changes: {
          before: null,
          after: { name: 'João Silva' },
        },
      });

      expect(queue.add).toHaveBeenCalledWith(
        'persist',
        expect.objectContaining({
          actorId: 'user-uuid-1',
          actorType: 'USER',
          action: 'SHAREHOLDER_CREATED',
          resourceType: 'Shareholder',
          resourceId: 'shareholder-uuid-1',
          companyId: 'company-uuid-1',
          changes: {
            before: null,
            after: { name: 'João Silva' },
          },
          metadata: expect.objectContaining({ source: 'system' }),
        }),
        expect.objectContaining({ attempts: 3 }),
      );
    });

    it('should default actorId and resourceId to null when not provided', async () => {
      await service.log({
        actorType: 'SYSTEM',
        action: 'OPTION_VESTING_MILESTONE',
        resourceType: 'OptionGrant',
      });

      expect(queue.add).toHaveBeenCalledWith(
        'persist',
        expect.objectContaining({
          actorId: null,
          actorType: 'SYSTEM',
          resourceId: null,
          companyId: null,
        }),
        expect.any(Object),
      );
    });

    it('should merge additional metadata with source: system', async () => {
      await service.log({
        actorType: 'SYSTEM',
        action: 'BLOCKCHAIN_TX_CONFIRMED',
        resourceType: 'BlockchainTransaction',
        metadata: { txHash: '0xabc123' },
      });

      expect(queue.add).toHaveBeenCalledWith(
        'persist',
        expect.objectContaining({
          metadata: { source: 'system', txHash: '0xabc123' },
        }),
        expect.any(Object),
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated audit logs with actor info', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([mockAuditLog]);
      mockPrisma.auditLog.count.mockResolvedValue(1);

      const result = await service.findAll('company-uuid-1', {
        page: 1,
        limit: 20,
      });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.items[0]).toEqual(
        expect.objectContaining({
          id: 'audit-uuid-1',
          action: 'SHAREHOLDER_CREATED',
          actorName: 'Nelson Pereira',
          actorEmail: 'n***@example.com',
        }),
      );
    });

    it('should apply action filter', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      await service.findAll('company-uuid-1', {
        page: 1,
        limit: 20,
        action: 'SHARES_ISSUED',
      });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: 'company-uuid-1',
            action: 'SHARES_ISSUED',
          }),
        }),
      );
    });

    it('should apply actorId filter', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      await service.findAll('company-uuid-1', {
        page: 1,
        limit: 20,
        actorId: 'user-uuid-1',
      });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            actorId: 'user-uuid-1',
          }),
        }),
      );
    });

    it('should apply resourceType filter', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      await service.findAll('company-uuid-1', {
        page: 1,
        limit: 20,
        resourceType: 'Transaction',
      });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            resourceType: 'Transaction',
          }),
        }),
      );
    });

    it('should apply resourceId filter', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      await service.findAll('company-uuid-1', {
        page: 1,
        limit: 20,
        resourceId: 'resource-uuid-1',
      });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            resourceId: 'resource-uuid-1',
          }),
        }),
      );
    });

    it('should apply date range filter', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      await service.findAll('company-uuid-1', {
        page: 1,
        limit: 20,
        dateFrom: '2026-01-01T00:00:00.000Z',
        dateTo: '2026-02-01T00:00:00.000Z',
      });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            timestamp: {
              gte: new Date('2026-01-01T00:00:00.000Z'),
              lte: new Date('2026-02-01T00:00:00.000Z'),
            },
          }),
        }),
      );
    });

    it('should apply dateFrom only filter', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      await service.findAll('company-uuid-1', {
        page: 1,
        limit: 20,
        dateFrom: '2026-01-01T00:00:00.000Z',
      });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            timestamp: {
              gte: new Date('2026-01-01T00:00:00.000Z'),
            },
          }),
        }),
      );
    });

    it('should sort descending by timestamp by default', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      await service.findAll('company-uuid-1', { page: 1, limit: 20 });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ timestamp: 'desc' }],
        }),
      );
    });

    it('should apply custom sort', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      await service.findAll('company-uuid-1', {
        page: 1,
        limit: 20,
        sort: 'action,-timestamp',
      });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ action: 'asc' }, { timestamp: 'desc' }],
        }),
      );
    });

    it('should ignore invalid sort fields', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      await service.findAll('company-uuid-1', {
        page: 1,
        limit: 20,
        sort: 'invalidField',
      });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ timestamp: 'desc' }],
        }),
      );
    });

    it('should calculate correct skip for pagination', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      await service.findAll('company-uuid-1', { page: 3, limit: 10 });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
        }),
      );
    });

    it('should handle actor with only firstName', async () => {
      const logWithPartialActor = {
        ...mockAuditLog,
        actor: { id: 'user-uuid-1', firstName: 'Nelson', lastName: null, email: 'n@e.com' },
      };
      mockPrisma.auditLog.findMany.mockResolvedValue([logWithPartialActor]);
      mockPrisma.auditLog.count.mockResolvedValue(1);

      const result = await service.findAll('company-uuid-1', { page: 1, limit: 20 });

      expect(result.items[0].actorName).toBe('Nelson');
    });

    it('should handle actor with no name', async () => {
      const logWithNoName = {
        ...mockAuditLog,
        actor: { id: 'user-uuid-1', firstName: null, lastName: null, email: 'n@e.com' },
      };
      mockPrisma.auditLog.findMany.mockResolvedValue([logWithNoName]);
      mockPrisma.auditLog.count.mockResolvedValue(1);

      const result = await service.findAll('company-uuid-1', { page: 1, limit: 20 });

      expect(result.items[0].actorName).toBeNull();
    });

    it('should handle null actor (SYSTEM events)', async () => {
      const systemLog = {
        ...mockAuditLog,
        actorId: null,
        actorType: 'SYSTEM',
        actor: null,
      };
      mockPrisma.auditLog.findMany.mockResolvedValue([systemLog]);
      mockPrisma.auditLog.count.mockResolvedValue(1);

      const result = await service.findAll('company-uuid-1', { page: 1, limit: 20 });

      expect(result.items[0].actorName).toBeNull();
      expect(result.items[0].actorEmail).toBeNull();
    });

    it('should return empty array when no logs found', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      const result = await service.findAll('company-uuid-1', { page: 1, limit: 20 });

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('findById', () => {
    it('should return a single audit log by ID scoped to company', async () => {
      mockPrisma.auditLog.findFirst.mockResolvedValue(mockAuditLog);

      const result = await service.findById('company-uuid-1', 'audit-uuid-1');

      expect(result).toEqual(
        expect.objectContaining({
          id: 'audit-uuid-1',
          action: 'SHAREHOLDER_CREATED',
          actorName: 'Nelson Pereira',
          actorEmail: 'n***@example.com',
        }),
      );
      expect(mockPrisma.auditLog.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'audit-uuid-1', companyId: 'company-uuid-1' },
        }),
      );
    });

    it('should throw NotFoundException when log not found', async () => {
      mockPrisma.auditLog.findFirst.mockResolvedValue(null);

      await expect(
        service.findById('company-uuid-1', 'nonexistent-uuid'),
      ).rejects.toThrow('errors.auditlog.notFound');
    });
  });

  describe('verifyHashChain', () => {
    it('should return NO_DATA when no hash chains exist', async () => {
      mockPrisma.auditHashChain.findMany.mockResolvedValue([]);

      const result = await service.verifyHashChain('2026-01-01', '2026-01-31');

      expect(result.status).toBe('NO_DATA');
      expect(result.daysVerified).toBe(0);
    });

    it('should verify a valid hash chain', async () => {
      const logs = [
        {
          id: 'log-1',
          timestamp: new Date('2026-01-15T10:00:00.000Z'),
          action: 'COMPANY_CREATED',
          actorId: 'user-1',
        },
      ];

      // Compute expected hash
      const crypto = require('crypto');
      const content = `log-1|2026-01-15T10:00:00.000Z|COMPANY_CREATED|user-1`;
      const expectedHash = crypto
        .createHash('sha256')
        .update('genesis\n' + content)
        .digest('hex');

      mockPrisma.auditHashChain.findMany.mockResolvedValue([
        {
          id: 'chain-1',
          date: '2026-01-15',
          logCount: 1,
          hash: expectedHash,
          previousHash: 'genesis',
          computedAt: new Date(),
        },
      ]);

      mockPrisma.auditLog.findMany.mockResolvedValue(logs);

      const result = await service.verifyHashChain('2026-01-15', '2026-01-15');

      expect(result.status).toBe('VALID');
      expect(result.daysVerified).toBe(1);
      expect(result.daysValid).toBe(1);
      expect(result.daysInvalid).toBe(0);
    });

    it('should detect tampered hash chain', async () => {
      mockPrisma.auditHashChain.findMany.mockResolvedValue([
        {
          id: 'chain-1',
          date: '2026-01-15',
          logCount: 1,
          hash: 'tampered-hash-value',
          previousHash: 'genesis',
          computedAt: new Date(),
        },
      ]);

      mockPrisma.auditLog.findMany.mockResolvedValue([
        {
          id: 'log-1',
          timestamp: new Date('2026-01-15T10:00:00.000Z'),
          action: 'COMPANY_CREATED',
          actorId: 'user-1',
        },
      ]);

      const result = await service.verifyHashChain('2026-01-15', '2026-01-15');

      expect(result.status).toBe('INVALID');
      expect(result.daysInvalid).toBe(1);
    });

    it('should detect log count mismatch', async () => {
      const logs = [
        {
          id: 'log-1',
          timestamp: new Date('2026-01-15T10:00:00.000Z'),
          action: 'COMPANY_CREATED',
          actorId: 'user-1',
        },
      ];

      const crypto = require('crypto');
      const content = `log-1|2026-01-15T10:00:00.000Z|COMPANY_CREATED|user-1`;
      const correctHash = crypto
        .createHash('sha256')
        .update('genesis\n' + content)
        .digest('hex');

      mockPrisma.auditHashChain.findMany.mockResolvedValue([
        {
          id: 'chain-1',
          date: '2026-01-15',
          logCount: 5, // Wrong count — 5 instead of 1
          hash: correctHash,
          previousHash: 'genesis',
          computedAt: new Date(),
        },
      ]);

      mockPrisma.auditLog.findMany.mockResolvedValue(logs);

      const result = await service.verifyHashChain('2026-01-15', '2026-01-15');

      expect(result.status).toBe('INVALID');
      expect(result.daysInvalid).toBe(1);
    });

    it('should call without date range', async () => {
      mockPrisma.auditHashChain.findMany.mockResolvedValue([]);

      const result = await service.verifyHashChain();

      expect(result.status).toBe('NO_DATA');
      expect(mockPrisma.auditHashChain.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });
  });

  describe('computeDailyHash', () => {
    it('should compute hash for a date with logs', async () => {
      const logs = [
        {
          id: 'log-1',
          timestamp: new Date('2026-01-15T10:00:00.000Z'),
          action: 'COMPANY_CREATED',
          actorId: 'user-1',
        },
        {
          id: 'log-2',
          timestamp: new Date('2026-01-15T14:00:00.000Z'),
          action: 'SHAREHOLDER_CREATED',
          actorId: 'user-1',
        },
      ];

      mockPrisma.auditLog.findMany.mockResolvedValue(logs);
      mockPrisma.auditHashChain.findFirst.mockResolvedValue(null); // No previous hash
      mockPrisma.auditHashChain.upsert.mockResolvedValue({});

      await service.computeDailyHash('2026-01-15');

      expect(mockPrisma.auditHashChain.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { date: '2026-01-15' },
          update: expect.objectContaining({
            logCount: 2,
            previousHash: 'genesis',
          }),
          create: expect.objectContaining({
            date: '2026-01-15',
            logCount: 2,
            previousHash: 'genesis',
          }),
        }),
      );
    });

    it('should chain with previous day hash', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditHashChain.findFirst.mockResolvedValue({
        hash: 'previous-day-hash-abc',
      });
      mockPrisma.auditHashChain.upsert.mockResolvedValue({});

      await service.computeDailyHash('2026-01-16');

      expect(mockPrisma.auditHashChain.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            previousHash: 'previous-day-hash-abc',
          }),
        }),
      );
    });

    it('should compute hash for date with no logs', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditHashChain.findFirst.mockResolvedValue(null);
      mockPrisma.auditHashChain.upsert.mockResolvedValue({});

      await service.computeDailyHash('2026-01-15');

      expect(mockPrisma.auditHashChain.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ logCount: 0 }),
        }),
      );
    });
  });

  describe('email masking', () => {
    it('should mask email in actor info', async () => {
      const logWithEmail = {
        ...mockAuditLog,
        actor: {
          id: 'user-uuid-1',
          firstName: 'Nelson',
          lastName: 'Pereira',
          email: 'nelson@example.com',
        },
      };
      mockPrisma.auditLog.findMany.mockResolvedValue([logWithEmail]);
      mockPrisma.auditLog.count.mockResolvedValue(1);

      const result = await service.findAll('company-uuid-1', { page: 1, limit: 20 });

      expect(result.items[0].actorEmail).toBe('n***@example.com');
    });
  });
});
