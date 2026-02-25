import { Test, TestingModule } from '@nestjs/testing';
import { CompanyController } from './company.controller';
import { CompanyService } from './company.service';
import {
  NotFoundException,
  ConflictException,
  BusinessRuleException,
} from '../common/filters/app-exception';

const VALID_CNPJ = '11.222.333/0001-81';

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

const mockCompanySummary = {
  id: 'comp-1',
  name: 'Test Company',
  entityType: 'LTDA' as const,
  cnpj: VALID_CNPJ,
  status: 'ACTIVE' as const,
  logoUrl: null as string | null,
  role: 'ADMIN' as const,
  memberCount: 3,
  createdAt: new Date(),
};

describe('CompanyController', () => {
  let controller: CompanyController;
  let service: jest.Mocked<CompanyService>;

  beforeEach(async () => {
    const mockService = {
      create: jest.fn(),
      findAllForUser: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      dissolve: jest.fn(),
      updateStatus: jest.fn(),
      getSetupStatus: jest.fn(),
      retryCnpjValidation: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CompanyController],
      providers: [{ provide: CompanyService, useValue: mockService }],
    }).compile();

    controller = module.get<CompanyController>(CompanyController);
    service = module.get(CompanyService) as jest.Mocked<CompanyService>;
  });

  // ─── CREATE ──────────────────────────────────────────────────────

  describe('create', () => {
    it('should create a company and return it', async () => {
      service.create.mockResolvedValue(mockCompany as any);

      const result = await controller.create(
        { name: 'Test Company', entityType: 'LTDA' as any, cnpj: VALID_CNPJ },
        'user-1',
      );

      expect(result).toEqual(mockCompany);
      expect(service.create).toHaveBeenCalledWith(
        { name: 'Test Company', entityType: 'LTDA', cnpj: VALID_CNPJ },
        'user-1',
      );
    });

    it('should propagate ConflictException for duplicate CNPJ', async () => {
      service.create.mockRejectedValue(
        new ConflictException(
          'COMPANY_CNPJ_DUPLICATE',
          'errors.company.cnpjDuplicate',
        ),
      );

      await expect(
        controller.create(
          { name: 'Test', entityType: 'LTDA' as any, cnpj: VALID_CNPJ },
          'user-1',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should propagate BusinessRuleException for membership limit', async () => {
      service.create.mockRejectedValue(
        new BusinessRuleException(
          'COMPANY_MEMBERSHIP_LIMIT',
          'errors.company.membershipLimit',
        ),
      );

      await expect(
        controller.create(
          { name: 'Test', entityType: 'LTDA' as any, cnpj: VALID_CNPJ },
          'user-1',
        ),
      ).rejects.toThrow(BusinessRuleException);
    });
  });

  // ─── LIST ────────────────────────────────────────────────────────

  describe('list', () => {
    it('should return paginated company list', async () => {
      service.findAllForUser.mockResolvedValue({
        items: [mockCompanySummary],
        total: 1,
      });

      const result = await controller.list(
        'user-1',
        { page: 1, limit: 20 },
        undefined,
        undefined,
      );

      expect(result).toEqual({
        success: true,
        data: [mockCompanySummary],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      });
    });

    it('should pass status filter to service', async () => {
      service.findAllForUser.mockResolvedValue({ items: [], total: 0 });

      await controller.list('user-1', { page: 1, limit: 20 }, 'ACTIVE', '-name');

      expect(service.findAllForUser).toHaveBeenCalledWith(
        'user-1',
        { page: 1, limit: 20 },
        { status: 'ACTIVE', sort: '-name' },
      );
    });

    it('should return empty list when user has no companies', async () => {
      service.findAllForUser.mockResolvedValue({ items: [], total: 0 });

      const result = await controller.list('user-1', { page: 1, limit: 20 });

      expect(result).toEqual({
        success: true,
        data: [],
        meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
      });
    });
  });

  // ─── GET ONE ─────────────────────────────────────────────────────

  describe('getOne', () => {
    it('should return company details', async () => {
      service.findById.mockResolvedValue(mockCompany as any);

      const result = await controller.getOne('comp-1');

      expect(result).toEqual(mockCompany);
      expect(service.findById).toHaveBeenCalledWith('comp-1');
    });

    it('should propagate NotFoundException', async () => {
      service.findById.mockRejectedValue(
        new NotFoundException('company', 'comp-1'),
      );

      await expect(controller.getOne('comp-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── UPDATE ──────────────────────────────────────────────────────

  describe('update', () => {
    it('should update and return company', async () => {
      const updated = { ...mockCompany, name: 'New Name' };
      service.update.mockResolvedValue(updated as any);

      const result = await controller.update('comp-1', { name: 'New Name' });

      expect(result.name).toBe('New Name');
      expect(service.update).toHaveBeenCalledWith('comp-1', {
        name: 'New Name',
      });
    });

    it('should propagate BusinessRuleException for DISSOLVED company', async () => {
      service.update.mockRejectedValue(
        new BusinessRuleException(
          'COMPANY_CANNOT_UPDATE_DISSOLVED',
          'errors.company.cannotUpdateDissolved',
        ),
      );

      await expect(
        controller.update('comp-1', { name: 'Foo' }),
      ).rejects.toThrow(BusinessRuleException);
    });
  });

  // ─── UPDATE STATUS ───────────────────────────────────────────────

  describe('updateStatus', () => {
    it('should update company status', async () => {
      const deactivated = { ...mockCompany, status: 'INACTIVE' };
      service.updateStatus.mockResolvedValue(deactivated as any);

      const result = await controller.updateStatus('comp-1', 'INACTIVE');

      expect(result.status).toBe('INACTIVE');
      expect(service.updateStatus).toHaveBeenCalledWith('comp-1', 'INACTIVE');
    });
  });

  // ─── GET SETUP STATUS ────────────────────────────────────────────

  describe('getSetupStatus', () => {
    it('should return setup status', async () => {
      const setupStatus = {
        companyId: 'comp-1',
        companyStatus: 'DRAFT',
        cnpjValidation: {
          status: 'PENDING',
          validatedAt: null,
          error: null,
        },
      };
      service.getSetupStatus.mockResolvedValue(setupStatus as any);

      const result = await controller.getSetupStatus('comp-1');

      expect(result).toEqual(setupStatus);
      expect(service.getSetupStatus).toHaveBeenCalledWith('comp-1');
    });

    it('should propagate NotFoundException', async () => {
      service.getSetupStatus.mockRejectedValue(
        new NotFoundException('company', 'comp-1'),
      );

      await expect(controller.getSetupStatus('comp-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── RETRY VALIDATION ────────────────────────────────────────────

  describe('retryValidation', () => {
    it('should dispatch retry and return message', async () => {
      service.retryCnpjValidation.mockResolvedValue(undefined);

      const result = await controller.retryValidation('comp-1', 'user-1');

      expect(result).toEqual({ message: 'CNPJ validation retry dispatched' });
      expect(service.retryCnpjValidation).toHaveBeenCalledWith(
        'comp-1',
        'user-1',
      );
    });

    it('should propagate BusinessRuleException for non-DRAFT company', async () => {
      service.retryCnpjValidation.mockRejectedValue(
        new BusinessRuleException(
          'COMPANY_NOT_DRAFT',
          'errors.company.notDraft',
        ),
      );

      await expect(
        controller.retryValidation('comp-1', 'user-1'),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should propagate BusinessRuleException when validation is not failed', async () => {
      service.retryCnpjValidation.mockRejectedValue(
        new BusinessRuleException(
          'COMPANY_CNPJ_NOT_FAILED',
          'errors.company.cnpjNotFailed',
        ),
      );

      await expect(
        controller.retryValidation('comp-1', 'user-1'),
      ).rejects.toThrow(BusinessRuleException);
    });
  });

  // ─── DISSOLVE ────────────────────────────────────────────────────

  describe('dissolve', () => {
    it('should dissolve company returning no content', async () => {
      service.dissolve.mockResolvedValue(undefined as any);

      await controller.dissolve('comp-1');

      expect(service.dissolve).toHaveBeenCalledWith('comp-1');
    });

    it('should propagate BusinessRuleException for active shareholders', async () => {
      service.dissolve.mockRejectedValue(
        new BusinessRuleException(
          'COMPANY_HAS_ACTIVE_SHAREHOLDERS',
          'errors.company.hasActiveShareholders',
        ),
      );

      await expect(controller.dissolve('comp-1')).rejects.toThrow(
        BusinessRuleException,
      );
    });
  });
});
