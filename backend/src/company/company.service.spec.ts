import { Test, TestingModule } from '@nestjs/testing';
import { CompanyService } from './company.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  NotFoundException,
  ConflictException,
  BusinessRuleException,
} from '../common/filters/app-exception';
import {
  CreateCompanyDto,
  CompanyEntityTypeDto,
} from './dto/create-company.dto';
import { Prisma } from '@prisma/client';

// Valid CNPJ for tests (passes Módulo 11 checksum)
const VALID_CNPJ = '11.222.333/0001-81';
// Invalid CNPJ checksum
const INVALID_CNPJ = '11.222.333/0001-99';

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
};

const mockCompany = {
  id: 'comp-1',
  name: 'Test Company',
  entityType: 'LTDA',
  cnpj: VALID_CNPJ,
  description: null,
  logoUrl: null,
  foundedDate: null,
  status: 'DRAFT',
  cnpjValidatedAt: null,
  cnpjData: null,
  contractAddress: null,
  adminWalletAddress: null,
  defaultCurrency: 'BRL',
  fiscalYearEnd: '12-31',
  timezone: 'America/Sao_Paulo',
  locale: 'pt-BR',
  createdById: 'user-1',
  createdAt: new Date('2026-02-23T10:00:00Z'),
  updatedAt: new Date('2026-02-23T10:00:00Z'),
};

describe('CompanyService', () => {
  let service: CompanyService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      company: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      companyMember: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
      },
      user: {
        findUniqueOrThrow: jest.fn(),
      },
      shareholder: {
        count: jest.fn(),
      },
      fundingRound: {
        count: jest.fn(),
      },
      $transaction: jest
        .fn()
        .mockImplementation((fn: (tx: typeof prisma) => Promise<unknown>) =>
          fn(prisma),
        ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompanyService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<CompanyService>(CompanyService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── CREATE ──────────────────────────────────────────────────────

  describe('create', () => {
    const createDto: CreateCompanyDto = {
      name: 'Test Company',
      entityType: CompanyEntityTypeDto.LTDA,
      cnpj: VALID_CNPJ,
    };

    it('should create a company and assign creator as ADMIN', async () => {
      prisma.companyMember.count.mockResolvedValue(0);
      prisma.user.findUniqueOrThrow.mockResolvedValue(mockUser);
      prisma.company.create.mockResolvedValue(mockCompany);
      prisma.companyMember.create.mockResolvedValue({});

      const result = await service.create(createDto, mockUser.id);

      expect(result).toEqual(mockCompany);
      expect(prisma.company.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Test Company',
          entityType: CompanyEntityTypeDto.LTDA,
          cnpj: VALID_CNPJ,
          createdById: mockUser.id,
          defaultCurrency: 'BRL',
          fiscalYearEnd: '12-31',
          timezone: 'America/Sao_Paulo',
          locale: 'pt-BR',
        }),
      });
      // Verify ADMIN membership created
      expect(prisma.companyMember.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockUser.id,
          email: mockUser.email,
          role: 'ADMIN',
          status: 'ACTIVE',
        }),
      });
    });

    it('should reject invalid CNPJ checksum', async () => {
      const dto = { ...createDto, cnpj: INVALID_CNPJ };
      await expect(service.create(dto, mockUser.id)).rejects.toThrow(
        BusinessRuleException,
      );
      await expect(service.create(dto, mockUser.id)).rejects.toThrow(
        'errors.company.invalidCnpj',
      );
    });

    it('should reject all-same-digit CNPJ', async () => {
      const dto = { ...createDto, cnpj: '11.111.111/1111-11' };
      await expect(service.create(dto, mockUser.id)).rejects.toThrow(
        BusinessRuleException,
      );
    });

    it('should reject if user at membership limit (20)', async () => {
      prisma.companyMember.count.mockResolvedValue(20);

      await expect(service.create(createDto, mockUser.id)).rejects.toThrow(
        BusinessRuleException,
      );
      await expect(service.create(createDto, mockUser.id)).rejects.toThrow(
        'errors.company.membershipLimit',
      );
    });

    it('should reject duplicate CNPJ with ConflictException', async () => {
      prisma.companyMember.count.mockResolvedValue(0);
      prisma.user.findUniqueOrThrow.mockResolvedValue(mockUser);
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        { code: 'P2002', clientVersion: '5.0.0', meta: { target: ['cnpj'] } },
      );
      prisma.company.create.mockRejectedValue(prismaError);

      await expect(service.create(createDto, mockUser.id)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should accept optional fields', async () => {
      const dto = {
        ...createDto,
        description: 'A great company',
        foundedDate: '2022-03-15',
        defaultCurrency: 'USD',
        fiscalYearEnd: '03-31',
        timezone: 'America/New_York',
        locale: 'en',
      };

      prisma.companyMember.count.mockResolvedValue(0);
      prisma.user.findUniqueOrThrow.mockResolvedValue(mockUser);
      prisma.company.create.mockResolvedValue({
        ...mockCompany,
        ...dto,
      });
      prisma.companyMember.create.mockResolvedValue({});

      const result = await service.create(dto, mockUser.id);
      expect(result.name).toBe('Test Company');
      expect(prisma.company.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          description: 'A great company',
          defaultCurrency: 'USD',
          fiscalYearEnd: '03-31',
        }),
      });
    });

    it('should reject future foundedDate', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const dto = {
        ...createDto,
        foundedDate: futureDate.toISOString(),
      };

      prisma.companyMember.count.mockResolvedValue(0);

      await expect(service.create(dto, mockUser.id)).rejects.toThrow(
        'errors.company.futureFoundedDate',
      );
    });

    it('should reject invalid foundedDate format', async () => {
      const dto = {
        ...createDto,
        foundedDate: 'not-a-date',
      };

      prisma.companyMember.count.mockResolvedValue(0);

      await expect(service.create(dto, mockUser.id)).rejects.toThrow(
        'errors.company.invalidFoundedDate',
      );
    });

    it('should create company atomically using $transaction', async () => {
      prisma.companyMember.count.mockResolvedValue(0);
      prisma.user.findUniqueOrThrow.mockResolvedValue(mockUser);
      prisma.company.create.mockResolvedValue(mockCompany);
      prisma.companyMember.create.mockResolvedValue({});

      await service.create(createDto, mockUser.id);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  // ─── FIND ALL FOR USER ───────────────────────────────────────────

  describe('findAllForUser', () => {
    const pagination = { page: 1, limit: 20 };

    it('should return user companies with role and member count', async () => {
      const membership = {
        role: 'ADMIN',
        company: {
          id: 'comp-1',
          name: 'Test Company',
          entityType: 'LTDA',
          cnpj: VALID_CNPJ,
          status: 'ACTIVE',
          logoUrl: null,
          createdAt: new Date(),
        },
      };

      prisma.companyMember.findMany.mockResolvedValue([membership]);
      prisma.companyMember.count.mockResolvedValue(1);
      prisma.companyMember.groupBy.mockResolvedValue([
        { companyId: 'comp-1', _count: { id: 3 } },
      ]);

      const result = await service.findAllForUser(mockUser.id, pagination, {});

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toEqual(
        expect.objectContaining({
          id: 'comp-1',
          name: 'Test Company',
          role: 'ADMIN',
          memberCount: 3,
        }),
      );
      expect(result.total).toBe(1);
    });

    it('should filter by status', async () => {
      prisma.companyMember.findMany.mockResolvedValue([]);
      prisma.companyMember.count.mockResolvedValue(0);
      prisma.companyMember.groupBy.mockResolvedValue([]);

      await service.findAllForUser(mockUser.id, pagination, {
        status: 'ACTIVE',
      });

      expect(prisma.companyMember.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: mockUser.id,
            status: 'ACTIVE',
            company: { status: 'ACTIVE' },
          }),
        }),
      );
    });

    it('should return empty list for user with no memberships', async () => {
      prisma.companyMember.findMany.mockResolvedValue([]);
      prisma.companyMember.count.mockResolvedValue(0);
      prisma.companyMember.groupBy.mockResolvedValue([]);

      const result = await service.findAllForUser(mockUser.id, pagination, {});

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should paginate results', async () => {
      prisma.companyMember.findMany.mockResolvedValue([]);
      prisma.companyMember.count.mockResolvedValue(0);
      prisma.companyMember.groupBy.mockResolvedValue([]);

      await service.findAllForUser(mockUser.id, { page: 2, limit: 10 }, {});

      expect(prisma.companyMember.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        }),
      );
    });
  });

  // ─── FIND BY ID ──────────────────────────────────────────────────

  describe('findById', () => {
    it('should return company when found', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany);

      const result = await service.findById('comp-1');

      expect(result).toEqual(mockCompany);
      expect(prisma.company.findUnique).toHaveBeenCalledWith({
        where: { id: 'comp-1' },
      });
    });

    it('should throw NotFoundException when not found', async () => {
      prisma.company.findUnique.mockResolvedValue(null);

      await expect(service.findById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── UPDATE ──────────────────────────────────────────────────────

  describe('update', () => {
    it('should update company fields', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.company.update.mockResolvedValue({
        ...mockCompany,
        name: 'Updated Name',
      });

      const result = await service.update('comp-1', { name: 'Updated Name' });

      expect(result.name).toBe('Updated Name');
      expect(prisma.company.update).toHaveBeenCalledWith({
        where: { id: 'comp-1' },
        data: { name: 'Updated Name' },
      });
    });

    it('should reject update of DISSOLVED company', async () => {
      prisma.company.findUnique.mockResolvedValue({
        ...mockCompany,
        status: 'DISSOLVED',
      });

      await expect(
        service.update('comp-1', { name: 'New Name' }),
      ).rejects.toThrow(BusinessRuleException);
      await expect(
        service.update('comp-1', { name: 'New Name' }),
      ).rejects.toThrow('errors.company.cannotUpdateDissolved');
    });

    it('should not include undefined fields in update', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.company.update.mockResolvedValue(mockCompany);

      await service.update('comp-1', { name: 'Only Name' });

      expect(prisma.company.update).toHaveBeenCalledWith({
        where: { id: 'comp-1' },
        data: { name: 'Only Name' },
      });
    });

    it('should throw NotFoundException for non-existent company', async () => {
      prisma.company.findUnique.mockResolvedValue(null);

      await expect(
        service.update('non-existent', { name: 'Foo' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── DISSOLVE ────────────────────────────────────────────────────

  describe('dissolve', () => {
    it('should dissolve company with no active shareholders or rounds', async () => {
      prisma.company.findUnique.mockResolvedValue({
        ...mockCompany,
        status: 'ACTIVE',
      });
      prisma.shareholder.count.mockResolvedValue(0);
      prisma.fundingRound.count.mockResolvedValue(0);
      prisma.company.update.mockResolvedValue({
        ...mockCompany,
        status: 'DISSOLVED',
      });

      const result = await service.dissolve('comp-1');

      expect(result.status).toBe('DISSOLVED');
      expect(prisma.company.update).toHaveBeenCalledWith({
        where: { id: 'comp-1' },
        data: { status: 'DISSOLVED' },
      });
    });

    it('should reject dissolving already DISSOLVED company', async () => {
      prisma.company.findUnique.mockResolvedValue({
        ...mockCompany,
        status: 'DISSOLVED',
      });

      await expect(service.dissolve('comp-1')).rejects.toThrow(
        BusinessRuleException,
      );
      await expect(service.dissolve('comp-1')).rejects.toThrow(
        'errors.company.alreadyDissolved',
      );
    });

    it('should reject dissolving with active shareholders', async () => {
      prisma.company.findUnique.mockResolvedValue({
        ...mockCompany,
        status: 'ACTIVE',
      });
      prisma.shareholder.count.mockResolvedValue(5);

      await expect(service.dissolve('comp-1')).rejects.toThrow(
        BusinessRuleException,
      );
      await expect(service.dissolve('comp-1')).rejects.toThrow(
        'errors.company.hasActiveShareholders',
      );
    });

    it('should reject dissolving with active funding rounds', async () => {
      prisma.company.findUnique.mockResolvedValue({
        ...mockCompany,
        status: 'ACTIVE',
      });
      prisma.shareholder.count.mockResolvedValue(0);
      prisma.fundingRound.count.mockResolvedValue(2);

      await expect(service.dissolve('comp-1')).rejects.toThrow(
        BusinessRuleException,
      );
      await expect(service.dissolve('comp-1')).rejects.toThrow(
        'errors.company.hasActiveRounds',
      );
    });

    it('should allow dissolving INACTIVE company', async () => {
      prisma.company.findUnique.mockResolvedValue({
        ...mockCompany,
        status: 'INACTIVE',
      });
      prisma.shareholder.count.mockResolvedValue(0);
      prisma.fundingRound.count.mockResolvedValue(0);
      prisma.company.update.mockResolvedValue({
        ...mockCompany,
        status: 'DISSOLVED',
      });

      const result = await service.dissolve('comp-1');
      expect(result.status).toBe('DISSOLVED');
    });
  });

  // ─── UPDATE STATUS ───────────────────────────────────────────────

  describe('updateStatus', () => {
    it('should deactivate an ACTIVE company', async () => {
      prisma.company.findUnique.mockResolvedValue({
        ...mockCompany,
        status: 'ACTIVE',
      });
      prisma.company.update.mockResolvedValue({
        ...mockCompany,
        status: 'INACTIVE',
      });

      const result = await service.updateStatus('comp-1', 'INACTIVE');
      expect(result.status).toBe('INACTIVE');
    });

    it('should reactivate an INACTIVE company', async () => {
      prisma.company.findUnique.mockResolvedValue({
        ...mockCompany,
        status: 'INACTIVE',
      });
      prisma.company.update.mockResolvedValue({
        ...mockCompany,
        status: 'ACTIVE',
      });

      const result = await service.updateStatus('comp-1', 'ACTIVE');
      expect(result.status).toBe('ACTIVE');
    });

    it('should reject status change on DISSOLVED company', async () => {
      prisma.company.findUnique.mockResolvedValue({
        ...mockCompany,
        status: 'DISSOLVED',
      });

      await expect(
        service.updateStatus('comp-1', 'ACTIVE'),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should reject status change on DRAFT company', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany); // status: DRAFT

      await expect(
        service.updateStatus('comp-1', 'ACTIVE'),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should reject ACTIVE → ACTIVE transition', async () => {
      prisma.company.findUnique.mockResolvedValue({
        ...mockCompany,
        status: 'ACTIVE',
      });

      await expect(
        service.updateStatus('comp-1', 'ACTIVE'),
      ).rejects.toThrow(BusinessRuleException);
    });
  });
});
