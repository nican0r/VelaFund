import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogController } from './audit-log.controller';
import { AuditLogService } from './audit-log.service';

const mockService = {
  findAll: jest.fn(),
  findById: jest.fn(),
  verifyHashChain: jest.fn(),
  log: jest.fn().mockResolvedValue(undefined),
};

const mockAuditLogItem = {
  id: 'audit-uuid-1',
  timestamp: '2026-02-20T14:30:00.000Z',
  actorId: 'user-uuid-1',
  actorType: 'USER',
  actorName: 'Nelson Pereira',
  actorEmail: 'n***@example.com',
  action: 'SHAREHOLDER_CREATED',
  resourceType: 'Shareholder',
  resourceId: 'shareholder-uuid-1',
  changes: { before: null, after: { name: 'João Silva' } },
  metadata: { ipAddress: '192.168.1.0/24', requestId: 'req-1' },
};

describe('AuditLogController', () => {
  let controller: AuditLogController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditLogController],
      providers: [
        { provide: AuditLogService, useValue: mockService },
      ],
    }).compile();

    controller = module.get<AuditLogController>(AuditLogController);
  });

  describe('list', () => {
    it('should return paginated audit logs', async () => {
      mockService.findAll.mockResolvedValue({
        items: [mockAuditLogItem],
        total: 1,
      });

      const result = await controller.list('company-uuid-1', {
        page: 1,
        limit: 20,
      });

      expect(result).toEqual({
        success: true,
        data: [mockAuditLogItem],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      });
    });

    it('should pass filters to service', async () => {
      mockService.findAll.mockResolvedValue({ items: [], total: 0 });

      await controller.list('company-uuid-1', {
        page: 1,
        limit: 20,
        action: 'SHARES_ISSUED',
        actorId: 'user-uuid-1',
        resourceType: 'Transaction',
        dateFrom: '2026-01-01',
        dateTo: '2026-02-01',
        sort: '-timestamp',
      });

      expect(mockService.findAll).toHaveBeenCalledWith('company-uuid-1', {
        page: 1,
        limit: 20,
        action: 'SHARES_ISSUED',
        actorId: 'user-uuid-1',
        resourceType: 'Transaction',
        dateFrom: '2026-01-01',
        dateTo: '2026-02-01',
        sort: '-timestamp',
      });
    });

    it('should log AUDIT_LOG_VIEWED event', async () => {
      mockService.findAll.mockResolvedValue({ items: [], total: 0 });

      await controller.list('company-uuid-1', { page: 1, limit: 20 });

      expect(mockService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'AUDIT_LOG_VIEWED',
          resourceType: 'AuditLog',
          companyId: 'company-uuid-1',
        }),
      );
    });

    it('should calculate pagination for multiple pages', async () => {
      mockService.findAll.mockResolvedValue({
        items: [mockAuditLogItem],
        total: 50,
      });

      const result = await controller.list('company-uuid-1', {
        page: 2,
        limit: 10,
      });

      expect(result.meta).toEqual({
        total: 50,
        page: 2,
        limit: 10,
        totalPages: 5,
      });
    });

    it('should return empty data for empty results', async () => {
      mockService.findAll.mockResolvedValue({ items: [], total: 0 });

      const result = await controller.list('company-uuid-1', {
        page: 1,
        limit: 20,
      });

      expect(result).toEqual({
        success: true,
        data: [],
        meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
      });
    });
  });

  describe('getById', () => {
    it('should return a single audit log', async () => {
      mockService.findById.mockResolvedValue(mockAuditLogItem);

      const result = await controller.getById('company-uuid-1', 'audit-uuid-1');

      expect(result).toEqual(mockAuditLogItem);
      expect(mockService.findById).toHaveBeenCalledWith(
        'company-uuid-1',
        'audit-uuid-1',
      );
    });

    it('should propagate NotFoundException', async () => {
      mockService.findById.mockRejectedValue(
        new Error('errors.auditLog.notFound'),
      );

      await expect(
        controller.getById('company-uuid-1', 'nonexistent'),
      ).rejects.toThrow('errors.auditLog.notFound');
    });
  });

  describe('verifyHashChain', () => {
    it('should return hash chain verification result', async () => {
      const verifyResult = {
        dateRange: { from: '2026-01-01', to: '2026-01-31' },
        daysVerified: 31,
        daysValid: 31,
        daysInvalid: 0,
        status: 'VALID',
      };
      mockService.verifyHashChain.mockResolvedValue(verifyResult);

      const result = await controller.verifyHashChain('company-uuid-1', {
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
      });

      expect(result).toEqual(verifyResult);
      expect(mockService.verifyHashChain).toHaveBeenCalledWith(
        '2026-01-01',
        '2026-01-31',
      );
    });

    it('should log AUDIT_LOG_INTEGRITY_VERIFIED event', async () => {
      mockService.verifyHashChain.mockResolvedValue({
        dateRange: { from: null, to: null },
        daysVerified: 0,
        daysValid: 0,
        daysInvalid: 0,
        status: 'NO_DATA',
      });

      await controller.verifyHashChain('company-uuid-1', {});

      expect(mockService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'AUDIT_LOG_INTEGRITY_VERIFIED',
          resourceType: 'AuditHashChain',
          companyId: 'company-uuid-1',
        }),
      );
    });

    it('should handle invalid hash chain', async () => {
      mockService.verifyHashChain.mockResolvedValue({
        dateRange: { from: '2026-01-01', to: '2026-01-31' },
        daysVerified: 31,
        daysValid: 29,
        daysInvalid: 2,
        status: 'INVALID',
      });

      const result = await controller.verifyHashChain('company-uuid-1', {
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
      });

      expect(result.status).toBe('INVALID');
      expect(result.daysInvalid).toBe(2);
    });
  });
});
