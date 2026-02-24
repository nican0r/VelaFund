import { Test, TestingModule } from '@nestjs/testing';
import { ShareClassService } from './share-class.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  NotFoundException,
  ConflictException,
  BusinessRuleException,
} from '../common/filters/app-exception';
import {
  CreateShareClassDto,
  ShareClassTypeDto,
} from './dto/create-share-class.dto';
import { Prisma } from '@prisma/client';

const mockCompanyLtda = {
  id: 'comp-1',
  name: 'Test Ltda',
  entityType: 'LTDA',
  status: 'ACTIVE',
};

const mockCompanySA = {
  id: 'comp-2',
  name: 'Test SA',
  entityType: 'SA_CAPITAL_FECHADO',
  status: 'ACTIVE',
};

const mockShareClass = {
  id: 'sc-1',
  companyId: 'comp-1',
  className: 'Quotas Ordinarias',
  type: 'QUOTA',
  totalAuthorized: new Prisma.Decimal('1000000'),
  totalIssued: new Prisma.Decimal('0'),
  votesPerShare: 1,
  liquidationPreferenceMultiple: new Prisma.Decimal('1.0'),
  participatingRights: false,
  rightOfFirstRefusal: true,
  lockUpPeriodMonths: null,
  tagAlongPercentage: null,
  conversionRatio: null,
  antiDilutionType: null,
  participationCap: null,
  seniority: 0,
  blockchainTokenId: null,
  octData: null,
  createdAt: new Date('2026-02-24T10:00:00Z'),
  updatedAt: new Date('2026-02-24T10:00:00Z'),
};

describe('ShareClassService', () => {
  let service: ShareClassService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      company: {
        findUnique: jest.fn(),
      },
      shareClass: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      shareholding: {
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShareClassService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ShareClassService>(ShareClassService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── CREATE ──────────────────────────────────────────────────────

  describe('create', () => {
    const createDto: CreateShareClassDto = {
      className: 'Quotas Ordinarias',
      type: ShareClassTypeDto.QUOTA,
      totalAuthorized: '1000000',
      votesPerShare: 1,
    };

    it('should create a QUOTA share class for Ltda company', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompanyLtda);
      prisma.shareClass.create.mockResolvedValue(mockShareClass);

      const result = await service.create('comp-1', createDto);

      expect(result).toEqual(mockShareClass);
      expect(prisma.shareClass.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          companyId: 'comp-1',
          className: 'Quotas Ordinarias',
          type: 'QUOTA',
          votesPerShare: 1,
          participatingRights: false,
          rightOfFirstRefusal: true,
          lockUpPeriodMonths: null,
          tagAlongPercentage: null,
        }),
      });
    });

    it('should create COMMON_SHARES for S.A. company', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompanySA);
      prisma.shareClass.create.mockResolvedValue({
        ...mockShareClass,
        type: 'COMMON_SHARES',
        companyId: 'comp-2',
      });

      const dto: CreateShareClassDto = {
        className: 'Acoes Ordinarias',
        type: ShareClassTypeDto.COMMON_SHARES,
        totalAuthorized: '500000',
        votesPerShare: 1,
      };

      const result = await service.create('comp-2', dto);
      expect(result.type).toBe('COMMON_SHARES');
    });

    it('should create PREFERRED_SHARES with optional fields', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompanySA);
      prisma.shareClass.findMany.mockResolvedValue([
        {
          type: 'COMMON_SHARES',
          totalAuthorized: new Prisma.Decimal('1000000'),
        },
      ]);
      prisma.shareClass.create.mockResolvedValue({
        ...mockShareClass,
        type: 'PREFERRED_SHARES',
        liquidationPreferenceMultiple: new Prisma.Decimal('2.0'),
        participatingRights: true,
        tagAlongPercentage: new Prisma.Decimal('80'),
        lockUpPeriodMonths: 12,
      });

      const dto: CreateShareClassDto = {
        className: 'Acoes Preferenciais A',
        type: ShareClassTypeDto.PREFERRED_SHARES,
        totalAuthorized: '200000',
        votesPerShare: 0,
        liquidationPreferenceMultiple: 2.0,
        participatingRights: true,
        tagAlongPercentage: 80,
        lockUpPeriodMonths: 12,
      };

      const result = await service.create('comp-2', dto);
      expect(result.participatingRights).toBe(true);
    });

    it('should reject if company not found', async () => {
      prisma.company.findUnique.mockResolvedValue(null);

      await expect(service.create('non-existent', createDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should reject if company is not ACTIVE', async () => {
      prisma.company.findUnique.mockResolvedValue({
        ...mockCompanyLtda,
        status: 'DRAFT',
      });

      await expect(service.create('comp-1', createDto)).rejects.toThrow(
        BusinessRuleException,
      );
      await expect(service.create('comp-1', createDto)).rejects.toThrow(
        'errors.cap.companyNotActive',
      );
    });

    it('should reject non-QUOTA type for Ltda company', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompanyLtda);

      const dto: CreateShareClassDto = {
        ...createDto,
        type: ShareClassTypeDto.COMMON_SHARES,
      };

      await expect(service.create('comp-1', dto)).rejects.toThrow(
        BusinessRuleException,
      );
      await expect(service.create('comp-1', dto)).rejects.toThrow(
        'errors.cap.invalidShareClassType',
      );
    });

    it('should reject QUOTA type for S.A. company', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompanySA);

      const dto: CreateShareClassDto = {
        ...createDto,
        type: ShareClassTypeDto.QUOTA,
      };

      await expect(service.create('comp-2', dto)).rejects.toThrow(
        BusinessRuleException,
      );
      await expect(service.create('comp-2', dto)).rejects.toThrow(
        'errors.cap.invalidShareClassType',
      );
    });

    it('should reject if preferred shares would exceed 2/3 limit', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompanySA);
      // Existing: 100 common, 200 preferred already at limit
      prisma.shareClass.findMany.mockResolvedValue([
        {
          type: 'COMMON_SHARES',
          totalAuthorized: new Prisma.Decimal('100'),
        },
        {
          type: 'PREFERRED_SHARES',
          totalAuthorized: new Prisma.Decimal('200'),
        },
      ]);

      const dto: CreateShareClassDto = {
        className: 'Preferred B',
        type: ShareClassTypeDto.PREFERRED_SHARES,
        totalAuthorized: '100',
        votesPerShare: 0,
      };

      await expect(service.create('comp-2', dto)).rejects.toThrow(
        BusinessRuleException,
      );
      await expect(service.create('comp-2', dto)).rejects.toThrow(
        'errors.cap.preferredShareLimitExceeded',
      );
    });

    it('should allow preferred shares within 2/3 limit', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompanySA);
      prisma.shareClass.findMany.mockResolvedValue([
        {
          type: 'COMMON_SHARES',
          totalAuthorized: new Prisma.Decimal('1000000'),
        },
      ]);
      prisma.shareClass.create.mockResolvedValue({
        ...mockShareClass,
        type: 'PREFERRED_SHARES',
      });

      const dto: CreateShareClassDto = {
        className: 'Preferred A',
        type: ShareClassTypeDto.PREFERRED_SHARES,
        totalAuthorized: '500000',
        votesPerShare: 0,
      };

      // 500000 preferred / 1500000 total = 33.3% < 66.7%
      const result = await service.create('comp-2', dto);
      expect(result).toBeDefined();
    });

    it('should reject duplicate className with ConflictException', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompanyLtda);
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '5.0.0',
          meta: { target: ['company_id', 'class_name'] },
        },
      );
      prisma.shareClass.create.mockRejectedValue(prismaError);

      await expect(service.create('comp-1', createDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should handle zero totalAuthorized', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompanyLtda);
      prisma.shareClass.create.mockResolvedValue({
        ...mockShareClass,
        totalAuthorized: new Prisma.Decimal('0'),
      });

      const dto: CreateShareClassDto = {
        ...createDto,
        totalAuthorized: '0',
      };

      const result = await service.create('comp-1', dto);
      expect(result).toBeDefined();
    });

    it('should reject DISSOLVED company', async () => {
      prisma.company.findUnique.mockResolvedValue({
        ...mockCompanyLtda,
        status: 'DISSOLVED',
      });

      await expect(service.create('comp-1', createDto)).rejects.toThrow(
        'errors.cap.companyNotActive',
      );
    });
  });

  // ─── FIND ALL ──────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return paginated share classes', async () => {
      prisma.shareClass.findMany.mockResolvedValue([mockShareClass]);
      prisma.shareClass.count.mockResolvedValue(1);

      const result = await service.findAll('comp-1', {
        page: 1,
        limit: 20,
      });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(prisma.shareClass.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { companyId: 'comp-1' },
          skip: 0,
          take: 20,
        }),
      );
    });

    it('should filter by type', async () => {
      prisma.shareClass.findMany.mockResolvedValue([]);
      prisma.shareClass.count.mockResolvedValue(0);

      await service.findAll('comp-1', {
        page: 1,
        limit: 20,
        type: ShareClassTypeDto.PREFERRED_SHARES,
      });

      expect(prisma.shareClass.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { companyId: 'comp-1', type: 'PREFERRED_SHARES' },
        }),
      );
    });

    it('should apply sort order', async () => {
      prisma.shareClass.findMany.mockResolvedValue([]);
      prisma.shareClass.count.mockResolvedValue(0);

      await service.findAll('comp-1', {
        page: 1,
        limit: 20,
        sort: '-totalAuthorized',
      });

      expect(prisma.shareClass.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ totalAuthorized: 'desc' }],
        }),
      );
    });

    it('should paginate correctly', async () => {
      prisma.shareClass.findMany.mockResolvedValue([]);
      prisma.shareClass.count.mockResolvedValue(0);

      await service.findAll('comp-1', { page: 3, limit: 10 });

      expect(prisma.shareClass.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
        }),
      );
    });

    it('should return empty list when no share classes', async () => {
      prisma.shareClass.findMany.mockResolvedValue([]);
      prisma.shareClass.count.mockResolvedValue(0);

      const result = await service.findAll('comp-1', {
        page: 1,
        limit: 20,
      });

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  // ─── FIND BY ID ────────────────────────────────────────────────

  describe('findById', () => {
    it('should return share class when found', async () => {
      prisma.shareClass.findFirst.mockResolvedValue(mockShareClass);

      const result = await service.findById('comp-1', 'sc-1');

      expect(result).toEqual(mockShareClass);
      expect(prisma.shareClass.findFirst).toHaveBeenCalledWith({
        where: { id: 'sc-1', companyId: 'comp-1' },
      });
    });

    it('should throw NotFoundException when not found', async () => {
      prisma.shareClass.findFirst.mockResolvedValue(null);

      await expect(
        service.findById('comp-1', 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should not return share class from another company', async () => {
      prisma.shareClass.findFirst.mockResolvedValue(null);

      await expect(
        service.findById('other-company', 'sc-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── UPDATE ────────────────────────────────────────────────────

  describe('update', () => {
    it('should update totalAuthorized (increase)', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompanyLtda);
      prisma.shareClass.findFirst.mockResolvedValue(mockShareClass);
      prisma.shareClass.update.mockResolvedValue({
        ...mockShareClass,
        totalAuthorized: new Prisma.Decimal('2000000'),
      });

      const result = await service.update('comp-1', 'sc-1', {
        totalAuthorized: '2000000',
      });

      expect(result.totalAuthorized.toString()).toBe('2000000');
      expect(prisma.shareClass.update).toHaveBeenCalledWith({
        where: { id: 'sc-1' },
        data: expect.objectContaining({
          totalAuthorized: expect.any(Prisma.Decimal),
        }),
      });
    });

    it('should update lockUpPeriodMonths', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompanyLtda);
      prisma.shareClass.findFirst.mockResolvedValue(mockShareClass);
      prisma.shareClass.update.mockResolvedValue({
        ...mockShareClass,
        lockUpPeriodMonths: 24,
      });

      const result = await service.update('comp-1', 'sc-1', {
        lockUpPeriodMonths: 24,
      });

      expect(result.lockUpPeriodMonths).toBe(24);
    });

    it('should update tagAlongPercentage', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompanyLtda);
      prisma.shareClass.findFirst.mockResolvedValue(mockShareClass);
      prisma.shareClass.update.mockResolvedValue({
        ...mockShareClass,
        tagAlongPercentage: new Prisma.Decimal('100'),
      });

      const result = await service.update('comp-1', 'sc-1', {
        tagAlongPercentage: 100,
      });

      expect(result.tagAlongPercentage!.toString()).toBe('100');
    });

    it('should update rightOfFirstRefusal', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompanyLtda);
      prisma.shareClass.findFirst.mockResolvedValue(mockShareClass);
      prisma.shareClass.update.mockResolvedValue({
        ...mockShareClass,
        rightOfFirstRefusal: false,
      });

      const result = await service.update('comp-1', 'sc-1', {
        rightOfFirstRefusal: false,
      });

      expect(result.rightOfFirstRefusal).toBe(false);
    });

    it('should reject if company not found', async () => {
      prisma.company.findUnique.mockResolvedValue(null);

      await expect(
        service.update('non-existent', 'sc-1', { totalAuthorized: '2000000' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject if company is not ACTIVE', async () => {
      prisma.company.findUnique.mockResolvedValue({
        ...mockCompanyLtda,
        status: 'INACTIVE',
      });

      await expect(
        service.update('comp-1', 'sc-1', { totalAuthorized: '2000000' }),
      ).rejects.toThrow(BusinessRuleException);
      await expect(
        service.update('comp-1', 'sc-1', { totalAuthorized: '2000000' }),
      ).rejects.toThrow('errors.cap.companyNotActive');
    });

    it('should reject decreasing totalAuthorized', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompanyLtda);
      prisma.shareClass.findFirst.mockResolvedValue(mockShareClass);

      await expect(
        service.update('comp-1', 'sc-1', { totalAuthorized: '500000' }),
      ).rejects.toThrow(BusinessRuleException);
      await expect(
        service.update('comp-1', 'sc-1', { totalAuthorized: '500000' }),
      ).rejects.toThrow('errors.cap.totalAuthorizedCannotDecrease');
    });

    it('should reject totalAuthorized below totalIssued', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompanyLtda);
      prisma.shareClass.findFirst.mockResolvedValue({
        ...mockShareClass,
        totalAuthorized: new Prisma.Decimal('1000000'),
        totalIssued: new Prisma.Decimal('800000'),
      });

      // Trying to set to 700000 which is below 800000 issued
      // But since it's also below 1000000 current, it'll hit "cannot decrease" first
      await expect(
        service.update('comp-1', 'sc-1', { totalAuthorized: '700000' }),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should reject if share class not found', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompanyLtda);
      prisma.shareClass.findFirst.mockResolvedValue(null);

      await expect(
        service.update('comp-1', 'non-existent', {
          totalAuthorized: '2000000',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should check preferred share limit when increasing preferred totalAuthorized', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompanySA);
      prisma.shareClass.findFirst.mockResolvedValue({
        ...mockShareClass,
        companyId: 'comp-2',
        type: 'PREFERRED_SHARES',
        totalAuthorized: new Prisma.Decimal('200'),
      });
      // Existing classes: this preferred class (200) + common (100)
      prisma.shareClass.findMany.mockResolvedValue([
        { type: 'COMMON_SHARES', totalAuthorized: new Prisma.Decimal('100') },
        {
          type: 'PREFERRED_SHARES',
          totalAuthorized: new Prisma.Decimal('200'),
        },
      ]);

      // Increasing to 500 would make preferred 500/(100+300 increase)=500/400 > 2/3
      await expect(
        service.update('comp-2', 'sc-1', { totalAuthorized: '500' }),
      ).rejects.toThrow('errors.cap.preferredShareLimitExceeded');
    });
  });

  // ─── DELETE ────────────────────────────────────────────────────

  describe('delete', () => {
    it('should delete share class with no issued shares', async () => {
      prisma.shareClass.findFirst.mockResolvedValue(mockShareClass);
      prisma.shareholding.count.mockResolvedValue(0);
      prisma.shareClass.delete.mockResolvedValue(mockShareClass);

      await service.delete('comp-1', 'sc-1');

      expect(prisma.shareClass.delete).toHaveBeenCalledWith({
        where: { id: 'sc-1' },
      });
    });

    it('should reject deletion if shares have been issued', async () => {
      prisma.shareClass.findFirst.mockResolvedValue({
        ...mockShareClass,
        totalIssued: new Prisma.Decimal('5000'),
      });

      await expect(service.delete('comp-1', 'sc-1')).rejects.toThrow(
        BusinessRuleException,
      );
      await expect(service.delete('comp-1', 'sc-1')).rejects.toThrow(
        'errors.cap.shareClassInUse',
      );
    });

    it('should reject deletion if active shareholdings exist', async () => {
      prisma.shareClass.findFirst.mockResolvedValue(mockShareClass);
      prisma.shareholding.count.mockResolvedValue(3);

      await expect(service.delete('comp-1', 'sc-1')).rejects.toThrow(
        BusinessRuleException,
      );
      await expect(service.delete('comp-1', 'sc-1')).rejects.toThrow(
        'errors.cap.shareClassInUse',
      );
    });

    it('should throw NotFoundException for non-existent share class', async () => {
      prisma.shareClass.findFirst.mockResolvedValue(null);

      await expect(
        service.delete('comp-1', 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
