import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogProcessor, AuditEvent } from './audit-log.processor';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

const mockPrisma = {
  auditLog: {
    create: jest.fn(),
  },
};

describe('AuditLogProcessor', () => {
  let processor: AuditLogProcessor;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [AuditLogProcessor, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    processor = module.get<AuditLogProcessor>(AuditLogProcessor);
  });

  describe('handlePersist', () => {
    it('should persist audit event to database', async () => {
      const event: AuditEvent = {
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
      };

      mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-uuid-1' });

      await processor.handlePersist({ id: 'job-1', data: event } as any);

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
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
        },
      });
    });

    it('should handle SYSTEM events with null actorId', async () => {
      const event: AuditEvent = {
        actorId: null,
        actorType: 'SYSTEM',
        action: 'OPTION_VESTING_MILESTONE',
        resourceType: 'OptionGrant',
        resourceId: 'grant-uuid-1',
        companyId: 'company-uuid-1',
        changes: {
          before: { vestedQuantity: '2500' },
          after: { vestedQuantity: '5000' },
        },
        metadata: { source: 'system' },
      };

      mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-uuid-2' });

      await processor.handlePersist({ id: 'job-2', data: event } as any);

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: null,
          actorType: 'SYSTEM',
          action: 'OPTION_VESTING_MILESTONE',
        }),
      });
    });

    it('should handle events with null changes', async () => {
      const event: AuditEvent = {
        actorId: 'user-uuid-1',
        actorType: 'USER',
        action: 'AUTH_LOGIN_SUCCESS',
        resourceType: 'User',
        resourceId: 'user-uuid-1',
        companyId: null,
        changes: null,
        metadata: {
          ipAddress: '192.168.1.0/24',
          loginMethod: 'email',
        },
      };

      mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-uuid-3' });

      await processor.handlePersist({ id: 'job-3', data: event } as any);

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          changes: Prisma.JsonNull,
          companyId: null,
        }),
      });
    });

    it('should handle events with null metadata', async () => {
      const event: AuditEvent = {
        actorId: 'user-uuid-1',
        actorType: 'USER',
        action: 'AUTH_LOGOUT',
        resourceType: 'User',
        resourceId: 'user-uuid-1',
        companyId: null,
        changes: null,
        metadata: null,
      };

      mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-uuid-4' });

      await processor.handlePersist({ id: 'job-4', data: event } as any);

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: Prisma.JsonNull,
        }),
      });
    });

    it('should propagate database errors for retry', async () => {
      const event: AuditEvent = {
        actorId: 'user-uuid-1',
        actorType: 'USER',
        action: 'COMPANY_CREATED',
        resourceType: 'Company',
        resourceId: 'company-uuid-1',
        companyId: 'company-uuid-1',
        changes: null,
        metadata: null,
      };

      const dbError = new Error('Connection refused');
      mockPrisma.auditLog.create.mockRejectedValue(dbError);

      await expect(processor.handlePersist({ id: 'job-5', data: event } as any)).rejects.toThrow(
        'Connection refused',
      );
    });
  });
});
