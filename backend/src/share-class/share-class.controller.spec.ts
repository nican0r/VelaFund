import { Test, TestingModule } from '@nestjs/testing';
import { ShareClassController } from './share-class.controller';
import { ShareClassService } from './share-class.service';
import {
  NotFoundException,
  ConflictException,
  BusinessRuleException,
} from '../common/filters/app-exception';
import { Prisma } from '@prisma/client';

const mockShareClass = {
  id: 'sc-1',
  companyId: 'comp-1',
  className: 'Quotas Ordinarias',
  type: 'QUOTA' as const,
  totalAuthorized: new Prisma.Decimal('1000000'),
  totalIssued: new Prisma.Decimal('0'),
  votesPerShare: 1,
  liquidationPreferenceMultiple: new Prisma.Decimal('1.0'),
  participatingRights: false,
  rightOfFirstRefusal: true,
  lockUpPeriodMonths: null as number | null,
  tagAlongPercentage: null as Prisma.Decimal | null,
  conversionRatio: null as Prisma.Decimal | null,
  antiDilutionType: null as string | null,
  participationCap: null as Prisma.Decimal | null,
  seniority: 0,
  blockchainTokenId: null as string | null,
  octData: null as any,
  createdAt: new Date('2026-02-24T10:00:00Z'),
  updatedAt: new Date('2026-02-24T10:00:00Z'),
};

describe('ShareClassController', () => {
  let controller: ShareClassController;
  let service: jest.Mocked<ShareClassService>;

  beforeEach(async () => {
    const mockService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ShareClassController],
      providers: [{ provide: ShareClassService, useValue: mockService }],
    }).compile();

    controller = module.get<ShareClassController>(ShareClassController);
    service = module.get(ShareClassService) as jest.Mocked<ShareClassService>;
  });

  // ─── CREATE ──────────────────────────────────────────────────────

  describe('create', () => {
    it('should create a share class and return it', async () => {
      service.create.mockResolvedValue(mockShareClass as any);

      const result = await controller.create('comp-1', {
        className: 'Quotas Ordinarias',
        type: 'QUOTA' as any,
        totalAuthorized: '1000000',
        votesPerShare: 1,
      });

      expect(result).toEqual(mockShareClass);
      expect(service.create).toHaveBeenCalledWith('comp-1', {
        className: 'Quotas Ordinarias',
        type: 'QUOTA',
        totalAuthorized: '1000000',
        votesPerShare: 1,
      });
    });

    it('should propagate ConflictException for duplicate name', async () => {
      service.create.mockRejectedValue(
        new ConflictException('CAP_SHARE_CLASS_DUPLICATE', 'errors.cap.shareClassDuplicate'),
      );

      await expect(
        controller.create('comp-1', {
          className: 'Quotas Ordinarias',
          type: 'QUOTA' as any,
          totalAuthorized: '1000000',
          votesPerShare: 1,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should propagate BusinessRuleException for inactive company', async () => {
      service.create.mockRejectedValue(
        new BusinessRuleException('CAP_COMPANY_NOT_ACTIVE', 'errors.cap.companyNotActive'),
      );

      await expect(
        controller.create('comp-1', {
          className: 'Test',
          type: 'QUOTA' as any,
          totalAuthorized: '1000',
          votesPerShare: 1,
        }),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should propagate BusinessRuleException for invalid type', async () => {
      service.create.mockRejectedValue(
        new BusinessRuleException(
          'CAP_INVALID_SHARE_CLASS_TYPE',
          'errors.cap.invalidShareClassType',
        ),
      );

      await expect(
        controller.create('comp-1', {
          className: 'ON',
          type: 'COMMON_SHARES' as any,
          totalAuthorized: '1000',
          votesPerShare: 1,
        }),
      ).rejects.toThrow(BusinessRuleException);
    });
  });

  // ─── LIST ──────────────────────────────────────────────────────

  describe('list', () => {
    it('should return paginated share class list', async () => {
      service.findAll.mockResolvedValue({
        items: [mockShareClass as any],
        total: 1,
      });

      const result = await controller.list('comp-1', {
        page: 1,
        limit: 20,
      });

      expect(result).toEqual({
        success: true,
        data: [mockShareClass],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      });
    });

    it('should pass type filter and sort to service', async () => {
      service.findAll.mockResolvedValue({ items: [], total: 0 });

      await controller.list('comp-1', {
        page: 1,
        limit: 10,
        type: 'PREFERRED_SHARES' as any,
        sort: '-totalAuthorized',
      });

      expect(service.findAll).toHaveBeenCalledWith('comp-1', {
        page: 1,
        limit: 10,
        type: 'PREFERRED_SHARES',
        sort: '-totalAuthorized',
      });
    });

    it('should return empty list when no share classes', async () => {
      service.findAll.mockResolvedValue({ items: [], total: 0 });

      const result = await controller.list('comp-1', {
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

  // ─── GET ONE ───────────────────────────────────────────────────

  describe('getOne', () => {
    it('should return share class details', async () => {
      service.findById.mockResolvedValue(mockShareClass as any);

      const result = await controller.getOne('comp-1', 'sc-1');

      expect(result).toEqual(mockShareClass);
      expect(service.findById).toHaveBeenCalledWith('comp-1', 'sc-1');
    });

    it('should propagate NotFoundException', async () => {
      service.findById.mockRejectedValue(new NotFoundException('shareClass', 'sc-1'));

      await expect(controller.getOne('comp-1', 'sc-1')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── UPDATE ────────────────────────────────────────────────────

  describe('update', () => {
    it('should update and return share class', async () => {
      const updated = {
        ...mockShareClass,
        totalAuthorized: new Prisma.Decimal('2000000'),
      };
      service.update.mockResolvedValue(updated as any);

      const result = await controller.update('comp-1', 'sc-1', {
        totalAuthorized: '2000000',
      });

      expect(result.totalAuthorized.toString()).toBe('2000000');
      expect(service.update).toHaveBeenCalledWith('comp-1', 'sc-1', {
        totalAuthorized: '2000000',
      });
    });

    it('should propagate BusinessRuleException for cannot decrease', async () => {
      service.update.mockRejectedValue(
        new BusinessRuleException(
          'CAP_TOTAL_AUTHORIZED_CANNOT_DECREASE',
          'errors.cap.totalAuthorizedCannotDecrease',
        ),
      );

      await expect(controller.update('comp-1', 'sc-1', { totalAuthorized: '500' })).rejects.toThrow(
        BusinessRuleException,
      );
    });

    it('should propagate NotFoundException for non-existent share class', async () => {
      service.update.mockRejectedValue(new NotFoundException('shareClass', 'sc-1'));

      await expect(
        controller.update('comp-1', 'sc-1', { totalAuthorized: '2000000' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── DELETE ────────────────────────────────────────────────────

  describe('delete', () => {
    it('should delete share class returning no content', async () => {
      service.delete.mockResolvedValue(undefined);

      await controller.delete('comp-1', 'sc-1');

      expect(service.delete).toHaveBeenCalledWith('comp-1', 'sc-1');
    });

    it('should propagate BusinessRuleException for share class in use', async () => {
      service.delete.mockRejectedValue(
        new BusinessRuleException('CAP_SHARE_CLASS_IN_USE', 'errors.cap.shareClassInUse'),
      );

      await expect(controller.delete('comp-1', 'sc-1')).rejects.toThrow(BusinessRuleException);
    });

    it('should propagate NotFoundException', async () => {
      service.delete.mockRejectedValue(new NotFoundException('shareClass', 'sc-1'));

      await expect(controller.delete('comp-1', 'sc-1')).rejects.toThrow(NotFoundException);
    });
  });
});
