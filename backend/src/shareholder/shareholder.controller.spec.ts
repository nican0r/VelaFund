import { Test, TestingModule } from '@nestjs/testing';
import { ShareholderController } from './shareholder.controller';
import { ShareholderService } from './shareholder.service';
import {
  NotFoundException,
  ConflictException,
  BusinessRuleException,
} from '../common/filters/app-exception';
import { Prisma } from '@prisma/client';

const mockShareholder = {
  id: 'sh-1',
  companyId: 'comp-1',
  userId: null as string | null,
  name: 'João Silva',
  email: 'joao@example.com',
  phone: null as string | null,
  type: 'FOUNDER' as const,
  status: 'ACTIVE' as const,
  cpfCnpj: '529.982.247-25',
  cpfCnpjEncrypted: null as any,
  cpfCnpjBlindIndex: 'abc123' as string | null,
  walletAddress: null as string | null,
  nationality: 'BR',
  taxResidency: 'BR',
  isForeign: false,
  address: null as any,
  rdeIedNumber: null as string | null,
  rdeIedDate: null as Date | null,
  createdAt: new Date('2026-02-24T10:00:00Z'),
  updatedAt: new Date('2026-02-24T10:00:00Z'),
};

describe('ShareholderController', () => {
  let controller: ShareholderController;
  let service: jest.Mocked<ShareholderService>;

  beforeEach(async () => {
    const mockService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      setBeneficialOwners: jest.fn(),
      findForeignShareholders: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ShareholderController],
      providers: [{ provide: ShareholderService, useValue: mockService }],
    }).compile();

    controller = module.get<ShareholderController>(ShareholderController);
    service = module.get(ShareholderService) as jest.Mocked<ShareholderService>;
  });

  // ─── CREATE ──────────────────────────────────────────────────────

  describe('create', () => {
    it('should create a shareholder and return it', async () => {
      service.create.mockResolvedValue(mockShareholder as any);

      const result = await controller.create('comp-1', {
        name: 'João Silva',
        type: 'FOUNDER' as any,
        cpfCnpj: '529.982.247-25',
        email: 'joao@example.com',
      });

      expect(result).toEqual(mockShareholder);
      expect(service.create).toHaveBeenCalledWith('comp-1', {
        name: 'João Silva',
        type: 'FOUNDER',
        cpfCnpj: '529.982.247-25',
        email: 'joao@example.com',
      });
    });

    it('should propagate ConflictException for duplicate CPF/CNPJ', async () => {
      service.create.mockRejectedValue(
        new ConflictException(
          'SHAREHOLDER_CPF_CNPJ_DUPLICATE',
          'errors.shareholder.cpfCnpjDuplicate',
        ),
      );

      await expect(
        controller.create('comp-1', {
          name: 'João Silva',
          type: 'FOUNDER' as any,
          cpfCnpj: '529.982.247-25',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should propagate BusinessRuleException for inactive company', async () => {
      service.create.mockRejectedValue(
        new BusinessRuleException(
          'SHAREHOLDER_COMPANY_NOT_ACTIVE',
          'errors.shareholder.companyNotActive',
        ),
      );

      await expect(
        controller.create('comp-1', {
          name: 'Test',
          type: 'FOUNDER' as any,
        }),
      ).rejects.toThrow(BusinessRuleException);
    });
  });

  // ─── LIST ────────────────────────────────────────────────────────

  describe('list', () => {
    it('should return paginated shareholders', async () => {
      service.findAll.mockResolvedValue({
        items: [mockShareholder as any],
        total: 1,
      });

      const result = await controller.list('comp-1', {
        page: 1,
        limit: 20,
      });

      expect(result).toEqual({
        success: true,
        data: [mockShareholder],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      });
    });

    it('should pass filters to service', async () => {
      service.findAll.mockResolvedValue({ items: [], total: 0 });

      await controller.list('comp-1', {
        page: 1,
        limit: 10,
        status: 'ACTIVE' as any,
        type: 'FOUNDER' as any,
        search: 'joao',
      });

      expect(service.findAll).toHaveBeenCalledWith('comp-1', {
        page: 1,
        limit: 10,
        status: 'ACTIVE',
        type: 'FOUNDER',
        search: 'joao',
      });
    });
  });

  // ─── GET ONE ─────────────────────────────────────────────────────

  describe('getOne', () => {
    it('should return a single shareholder with relations', async () => {
      const withRelations = {
        ...mockShareholder,
        shareholdings: [],
        beneficialOwners: [],
      };
      service.findById.mockResolvedValue(withRelations as any);

      const result = await controller.getOne('comp-1', 'sh-1');

      expect(result).toEqual(withRelations);
      expect(service.findById).toHaveBeenCalledWith('comp-1', 'sh-1');
    });

    it('should propagate NotFoundException', async () => {
      service.findById.mockRejectedValue(
        new NotFoundException('shareholder', 'sh-999'),
      );

      await expect(controller.getOne('comp-1', 'sh-999')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── UPDATE ──────────────────────────────────────────────────────

  describe('update', () => {
    it('should update and return the shareholder', async () => {
      service.update.mockResolvedValue({
        ...mockShareholder,
        email: 'new@example.com',
      } as any);

      const result = await controller.update('comp-1', 'sh-1', {
        email: 'new@example.com',
      });

      expect(result.email).toBe('new@example.com');
      expect(service.update).toHaveBeenCalledWith('comp-1', 'sh-1', {
        email: 'new@example.com',
      });
    });

    it('should propagate NotFoundException', async () => {
      service.update.mockRejectedValue(
        new NotFoundException('shareholder', 'sh-999'),
      );

      await expect(
        controller.update('comp-1', 'sh-999', { email: 'test@test.com' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── REMOVE ──────────────────────────────────────────────────────

  describe('remove', () => {
    it('should delete shareholder with no holdings', async () => {
      service.remove.mockResolvedValue({ action: 'DELETED' });

      const result = await controller.remove('comp-1', 'sh-1');

      expect(result).toEqual({ action: 'DELETED' });
    });

    it('should inactivate shareholder with holdings', async () => {
      service.remove.mockResolvedValue({ action: 'INACTIVATED' });

      const result = await controller.remove('comp-1', 'sh-1');

      expect(result).toEqual({ action: 'INACTIVATED' });
    });

    it('should propagate NotFoundException', async () => {
      service.remove.mockRejectedValue(
        new NotFoundException('shareholder', 'sh-999'),
      );

      await expect(controller.remove('comp-1', 'sh-999')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── FOREIGN SHAREHOLDERS ───────────────────────────────────────

  describe('listForeign', () => {
    it('should return foreign shareholders with summary', async () => {
      service.findForeignShareholders.mockResolvedValue({
        shareholders: [],
        summary: {
          totalForeignShareholders: 0,
          totalForeignOwnershipPercentage: '0',
        },
      });

      const result = await controller.listForeign('comp-1');

      expect(result.summary.totalForeignShareholders).toBe(0);
      expect(service.findForeignShareholders).toHaveBeenCalledWith('comp-1');
    });
  });

  // ─── BENEFICIAL OWNERS ──────────────────────────────────────────

  describe('setBeneficialOwners', () => {
    it('should set beneficial owners and return them', async () => {
      const owners = [
        { id: 'bo-1', shareholderId: 'sh-2', name: 'Maria', cpf: null, ownershipPct: new Prisma.Decimal('60'), createdAt: new Date(), updatedAt: new Date() },
      ];
      service.setBeneficialOwners.mockResolvedValue(owners);

      const result = await controller.setBeneficialOwners('comp-1', 'sh-2', {
        beneficialOwners: [
          { name: 'Maria', ownershipPercentage: '60.00' },
        ],
      });

      expect(result).toEqual(owners);
    });

    it('should propagate BusinessRuleException for non-corporate', async () => {
      service.setBeneficialOwners.mockRejectedValue(
        new BusinessRuleException(
          'SHAREHOLDER_NOT_CORPORATE',
          'errors.shareholder.notCorporate',
        ),
      );

      await expect(
        controller.setBeneficialOwners('comp-1', 'sh-1', {
          beneficialOwners: [{ name: 'A', ownershipPercentage: '100' }],
        }),
      ).rejects.toThrow(BusinessRuleException);
    });
  });
});
