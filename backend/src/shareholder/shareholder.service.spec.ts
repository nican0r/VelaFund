import { Test, TestingModule } from '@nestjs/testing';
import { ShareholderService, isValidCpfChecksum, isValidCnpjChecksum } from './shareholder.service';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../encryption/encryption.service';
import {
  NotFoundException,
  ConflictException,
  BusinessRuleException,
} from '../common/filters/app-exception';
import { CreateShareholderDto, ShareholderTypeDto } from './dto/create-shareholder.dto';
import { Prisma } from '@prisma/client';
import { NotificationService } from '../notification/notification.service';

const mockCompany = {
  id: 'comp-1',
  name: 'Test Company',
  entityType: 'LTDA',
  status: 'ACTIVE',
};

const mockShareholder = {
  id: 'sh-1',
  companyId: 'comp-1',
  userId: null,
  name: 'João Silva',
  email: 'joao@example.com',
  phone: null,
  type: 'FOUNDER' as const,
  status: 'ACTIVE' as const,
  cpfCnpj: '529.982.247-25',
  cpfCnpjEncrypted: null,
  cpfCnpjBlindIndex: 'abcdef1234567890abcdef1234567890',
  walletAddress: null,
  nationality: 'BR',
  taxResidency: 'BR',
  isForeign: false,
  address: null,
  rdeIedNumber: null,
  rdeIedDate: null,
  createdAt: new Date('2026-02-24T10:00:00Z'),
  updatedAt: new Date('2026-02-24T10:00:00Z'),
};

const mockCorporateShareholder = {
  ...mockShareholder,
  id: 'sh-2',
  name: 'Acme Holdings Ltda',
  type: 'CORPORATE' as const,
  cpfCnpj: '11.222.333/0001-81',
};

describe('ShareholderService', () => {
  let service: ShareholderService;
  let prisma: any;
  let encryptionService: any;

  beforeEach(async () => {
    prisma = {
      company: {
        findUnique: jest.fn(),
      },
      shareholder: {
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
      transaction: {
        count: jest.fn(),
      },
      beneficialOwner: {
        create: jest.fn(),
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    encryptionService = {
      createBlindIndex: jest.fn().mockReturnValue('hmac-blind-index-1234567890ab'),
      isEncryptionAvailable: jest.fn().mockReturnValue(false),
      encrypt: jest.fn().mockResolvedValue(Buffer.from('encrypted-cpf')),
      decrypt: jest.fn().mockResolvedValue('529.982.247-25'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShareholderService,
        { provide: PrismaService, useValue: prisma },
        { provide: EncryptionService, useValue: encryptionService },
        { provide: NotificationService, useValue: { create: jest.fn() } },
      ],
    }).compile();

    service = module.get<ShareholderService>(ShareholderService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── CPF/CNPJ VALIDATION HELPERS ─────────────────────────────────

  describe('isValidCpfChecksum', () => {
    it('should accept valid CPF', () => {
      expect(isValidCpfChecksum('529.982.247-25')).toBe(true);
    });

    it('should reject all-same-digit CPF', () => {
      expect(isValidCpfChecksum('111.111.111-11')).toBe(false);
    });

    it('should reject invalid checksum', () => {
      expect(isValidCpfChecksum('529.982.247-26')).toBe(false);
    });

    it('should reject wrong length', () => {
      expect(isValidCpfChecksum('123.456.789')).toBe(false);
    });

    it('should accept valid CPF without formatting', () => {
      expect(isValidCpfChecksum('52998224725')).toBe(true);
    });
  });

  describe('isValidCnpjChecksum', () => {
    it('should accept valid CNPJ', () => {
      expect(isValidCnpjChecksum('11.222.333/0001-81')).toBe(true);
    });

    it('should reject all-same-digit CNPJ', () => {
      expect(isValidCnpjChecksum('11.111.111/1111-11')).toBe(false);
    });

    it('should reject invalid checksum', () => {
      expect(isValidCnpjChecksum('11.222.333/0001-82')).toBe(false);
    });
  });

  // ─── CREATE ──────────────────────────────────────────────────────

  describe('create', () => {
    const createDto: CreateShareholderDto = {
      name: 'João Silva',
      type: ShareholderTypeDto.FOUNDER,
      cpfCnpj: '529.982.247-25',
      email: 'joao@example.com',
    };

    it('should create a shareholder for an active company', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.shareholder.create.mockResolvedValue(mockShareholder);

      const result = await service.create('comp-1', createDto);

      expect(result).toEqual(mockShareholder);
      expect(encryptionService.createBlindIndex).toHaveBeenCalledWith('529.982.247-25');
      expect(prisma.shareholder.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          companyId: 'comp-1',
          name: 'João Silva',
          type: 'FOUNDER',
          email: 'joao@example.com',
          cpfCnpj: '529.982.247-25',
          cpfCnpjBlindIndex: 'hmac-blind-index-1234567890ab',
          cpfCnpjEncrypted: null,
          isForeign: false,
          nationality: 'BR',
          taxResidency: 'BR',
        }),
      });
    });

    it('should create a foreign shareholder with isForeign=true', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.shareholder.create.mockResolvedValue({
        ...mockShareholder,
        taxResidency: 'US',
        isForeign: true,
      });

      const foreignDto = {
        ...createDto,
        taxResidency: 'US',
        nationality: 'US',
        cpfCnpj: undefined,
      };

      await service.create('comp-1', foreignDto);

      expect(prisma.shareholder.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          isForeign: true,
          taxResidency: 'US',
        }),
      });
    });

    it('should throw NotFoundException for missing company', async () => {
      prisma.company.findUnique.mockResolvedValue(null);

      await expect(service.create('comp-1', createDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw BusinessRuleException for inactive company', async () => {
      prisma.company.findUnique.mockResolvedValue({
        ...mockCompany,
        status: 'DRAFT',
      });

      await expect(service.create('comp-1', createDto)).rejects.toThrow(BusinessRuleException);
    });

    it('should throw BusinessRuleException for invalid CPF checksum', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany);

      await expect(
        service.create('comp-1', { ...createDto, cpfCnpj: '529.982.247-26' }),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should throw BusinessRuleException when CORPORATE uses CPF', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany);

      await expect(
        service.create('comp-1', {
          ...createDto,
          type: ShareholderTypeDto.CORPORATE,
          cpfCnpj: '529.982.247-25',
        }),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should throw BusinessRuleException when individual uses CNPJ', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany);

      await expect(
        service.create('comp-1', {
          ...createDto,
          type: ShareholderTypeDto.FOUNDER,
          cpfCnpj: '11.222.333/0001-81',
        }),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should throw ConflictException for duplicate CPF/CNPJ in company', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.shareholder.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint', {
          code: 'P2002',
          clientVersion: '5.0.0',
          meta: { target: ['company_id', 'cpf_cnpj_blind_index'] },
        }),
      );

      await expect(service.create('comp-1', createDto)).rejects.toThrow(ConflictException);
    });

    it('should create shareholder without CPF/CNPJ (foreign)', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.shareholder.create.mockResolvedValue({
        ...mockShareholder,
        cpfCnpj: null,
        cpfCnpjBlindIndex: null,
      });

      await service.create('comp-1', {
        name: 'Foreign Investor',
        type: ShareholderTypeDto.INVESTOR,
        nationality: 'US',
        taxResidency: 'US',
      });

      expect(prisma.shareholder.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          cpfCnpj: null,
          cpfCnpjBlindIndex: null,
        }),
      });
    });

    it('should reject invalid document format', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany);

      await expect(service.create('comp-1', { ...createDto, cpfCnpj: '12345' })).rejects.toThrow(
        BusinessRuleException,
      );
    });

    it('should encrypt CPF when KMS is available', async () => {
      encryptionService.isEncryptionAvailable.mockReturnValue(true);
      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.shareholder.create.mockResolvedValue({
        ...mockShareholder,
        cpfCnpj: null,
        cpfCnpjEncrypted: Buffer.from('encrypted-cpf'),
      });

      await service.create('comp-1', createDto);

      expect(encryptionService.encrypt).toHaveBeenCalledWith('529.982.247-25');
      expect(prisma.shareholder.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          cpfCnpj: null, // Plaintext cleared
          cpfCnpjEncrypted: Buffer.from('encrypted-cpf'),
          cpfCnpjBlindIndex: 'hmac-blind-index-1234567890ab',
        }),
      });
    });

    it('should NOT encrypt CNPJ (public registry data)', async () => {
      encryptionService.isEncryptionAvailable.mockReturnValue(true);
      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.shareholder.create.mockResolvedValue(mockCorporateShareholder);

      await service.create('comp-1', {
        name: 'Acme Holdings Ltda',
        type: ShareholderTypeDto.CORPORATE,
        cpfCnpj: '11.222.333/0001-81',
      });

      // CNPJ should NOT be encrypted per security.md
      expect(encryptionService.encrypt).not.toHaveBeenCalled();
      expect(prisma.shareholder.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          cpfCnpj: '11.222.333/0001-81', // Plaintext preserved
          cpfCnpjEncrypted: null,
        }),
      });
    });

    it('should fall back to plaintext if CPF encryption fails', async () => {
      encryptionService.isEncryptionAvailable.mockReturnValue(true);
      encryptionService.encrypt.mockRejectedValue(new Error('KMS timeout'));
      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.shareholder.create.mockResolvedValue(mockShareholder);

      await service.create('comp-1', createDto);

      // Should still create with plaintext CPF as fallback
      expect(prisma.shareholder.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          cpfCnpj: '529.982.247-25', // Plaintext fallback
          cpfCnpjEncrypted: null,
        }),
      });
    });
  });

  // ─── FIND ALL ────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return paginated shareholders', async () => {
      prisma.shareholder.findMany.mockResolvedValue([mockShareholder]);
      prisma.shareholder.count.mockResolvedValue(1);

      const result = await service.findAll('comp-1', {
        page: 1,
        limit: 20,
      });

      expect(result).toEqual({ items: [mockShareholder], total: 1 });
      expect(prisma.shareholder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { companyId: 'comp-1' },
          skip: 0,
          take: 20,
        }),
      );
    });

    it('should filter by status', async () => {
      prisma.shareholder.findMany.mockResolvedValue([]);
      prisma.shareholder.count.mockResolvedValue(0);

      await service.findAll('comp-1', {
        page: 1,
        limit: 20,
        status: 'ACTIVE' as any,
      });

      expect(prisma.shareholder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: 'comp-1', status: 'ACTIVE' }),
        }),
      );
    });

    it('should filter by type', async () => {
      prisma.shareholder.findMany.mockResolvedValue([]);
      prisma.shareholder.count.mockResolvedValue(0);

      await service.findAll('comp-1', {
        page: 1,
        limit: 20,
        type: 'FOUNDER' as any,
      });

      expect(prisma.shareholder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'FOUNDER' }),
        }),
      );
    });

    it('should search by name or email', async () => {
      prisma.shareholder.findMany.mockResolvedValue([]);
      prisma.shareholder.count.mockResolvedValue(0);

      await service.findAll('comp-1', {
        page: 1,
        limit: 20,
        search: 'joao',
      });

      expect(prisma.shareholder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { name: { contains: 'joao', mode: 'insensitive' } },
              { email: { contains: 'joao', mode: 'insensitive' } },
            ],
          }),
        }),
      );
    });
  });

  // ─── FIND BY ID ──────────────────────────────────────────────────

  describe('findById', () => {
    it('should return shareholder with shareholdings and beneficial owners', async () => {
      const shareholderWithRelations = {
        ...mockShareholder,
        shareholdings: [],
        beneficialOwners: [],
      };
      prisma.shareholder.findFirst.mockResolvedValue(shareholderWithRelations);

      const result = await service.findById('comp-1', 'sh-1');

      expect(result).toEqual(shareholderWithRelations);
      expect(prisma.shareholder.findFirst).toHaveBeenCalledWith({
        where: { id: 'sh-1', companyId: 'comp-1' },
        include: expect.objectContaining({
          shareholdings: expect.any(Object),
          beneficialOwners: true,
        }),
      });
    });

    it('should throw NotFoundException if not found', async () => {
      prisma.shareholder.findFirst.mockResolvedValue(null);

      await expect(service.findById('comp-1', 'sh-999')).rejects.toThrow(NotFoundException);
    });

    it('should decrypt CPF when stored encrypted', async () => {
      const encryptedShareholder = {
        ...mockShareholder,
        cpfCnpj: null, // Plaintext cleared
        cpfCnpjEncrypted: Buffer.from('encrypted-cpf-data'),
        shareholdings: [],
        beneficialOwners: [],
      };
      prisma.shareholder.findFirst.mockResolvedValue(encryptedShareholder);

      const result = await service.findById('comp-1', 'sh-1');

      expect(encryptionService.decrypt).toHaveBeenCalledWith(Buffer.from('encrypted-cpf-data'));
      expect(result.cpfCnpj).toBe('529.982.247-25');
    });

    it('should return shareholder without CPF if decryption fails', async () => {
      const encryptedShareholder = {
        ...mockShareholder,
        cpfCnpj: null,
        cpfCnpjEncrypted: Buffer.from('bad-encrypted-data'),
        shareholdings: [],
        beneficialOwners: [],
      };
      prisma.shareholder.findFirst.mockResolvedValue(encryptedShareholder);
      encryptionService.decrypt.mockRejectedValue(new Error('KMS unavailable'));

      const result = await service.findById('comp-1', 'sh-1');

      // Should return without cpfCnpj rather than throwing
      expect(result.cpfCnpj).toBeNull();
    });

    it('should not attempt decryption for plaintext CPF', async () => {
      const plaintextShareholder = {
        ...mockShareholder,
        cpfCnpj: '529.982.247-25',
        cpfCnpjEncrypted: null,
        shareholdings: [],
        beneficialOwners: [],
      };
      prisma.shareholder.findFirst.mockResolvedValue(plaintextShareholder);

      const result = await service.findById('comp-1', 'sh-1');

      expect(encryptionService.decrypt).not.toHaveBeenCalled();
      expect(result.cpfCnpj).toBe('529.982.247-25');
    });
  });

  // ─── UPDATE ──────────────────────────────────────────────────────

  describe('update', () => {
    it('should update mutable fields', async () => {
      prisma.shareholder.findFirst.mockResolvedValue(mockShareholder);
      prisma.shareholder.update.mockResolvedValue({
        ...mockShareholder,
        email: 'new@example.com',
      });

      const result = await service.update('comp-1', 'sh-1', {
        email: 'new@example.com',
      });

      expect(result.email).toBe('new@example.com');
      expect(prisma.shareholder.update).toHaveBeenCalledWith({
        where: { id: 'sh-1' },
        data: { email: 'new@example.com' },
      });
    });

    it('should recalculate isForeign when taxResidency changes', async () => {
      prisma.shareholder.findFirst.mockResolvedValue(mockShareholder);
      prisma.shareholder.update.mockResolvedValue({
        ...mockShareholder,
        taxResidency: 'US',
        isForeign: true,
      });

      await service.update('comp-1', 'sh-1', { taxResidency: 'US' });

      expect(prisma.shareholder.update).toHaveBeenCalledWith({
        where: { id: 'sh-1' },
        data: expect.objectContaining({
          taxResidency: 'US',
          isForeign: true,
        }),
      });
    });

    it('should set isForeign=false when taxResidency changed to BR', async () => {
      const foreignShareholder = {
        ...mockShareholder,
        taxResidency: 'US',
        isForeign: true,
      };
      prisma.shareholder.findFirst.mockResolvedValue(foreignShareholder);
      prisma.shareholder.update.mockResolvedValue({
        ...foreignShareholder,
        taxResidency: 'BR',
        isForeign: false,
      });

      await service.update('comp-1', 'sh-1', { taxResidency: 'BR' });

      expect(prisma.shareholder.update).toHaveBeenCalledWith({
        where: { id: 'sh-1' },
        data: expect.objectContaining({
          taxResidency: 'BR',
          isForeign: false,
        }),
      });
    });

    it('should throw NotFoundException for missing shareholder', async () => {
      prisma.shareholder.findFirst.mockResolvedValue(null);

      await expect(
        service.update('comp-1', 'sh-999', { email: 'test@example.com' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── REMOVE ──────────────────────────────────────────────────────

  describe('remove', () => {
    it('should hard-delete shareholder with no holdings or transactions', async () => {
      prisma.shareholder.findFirst.mockResolvedValue(mockShareholder);
      prisma.shareholding.count.mockResolvedValue(0);
      prisma.transaction.count.mockResolvedValue(0);
      prisma.shareholder.delete.mockResolvedValue(mockShareholder);

      const result = await service.remove('comp-1', 'sh-1');

      expect(result).toEqual({ action: 'DELETED' });
      expect(prisma.shareholder.delete).toHaveBeenCalledWith({
        where: { id: 'sh-1' },
      });
    });

    it('should soft-delete (inactivate) shareholder with holdings', async () => {
      prisma.shareholder.findFirst.mockResolvedValue(mockShareholder);
      prisma.shareholding.count.mockResolvedValue(5);
      prisma.transaction.count.mockResolvedValue(0);
      prisma.shareholder.update.mockResolvedValue({
        ...mockShareholder,
        status: 'INACTIVE',
      });

      const result = await service.remove('comp-1', 'sh-1');

      expect(result).toEqual({ action: 'INACTIVATED' });
      expect(prisma.shareholder.update).toHaveBeenCalledWith({
        where: { id: 'sh-1' },
        data: { status: 'INACTIVE' },
      });
    });

    it('should soft-delete shareholder with transaction history', async () => {
      prisma.shareholder.findFirst.mockResolvedValue(mockShareholder);
      prisma.shareholding.count.mockResolvedValue(0);
      prisma.transaction.count.mockResolvedValue(3);
      prisma.shareholder.update.mockResolvedValue({
        ...mockShareholder,
        status: 'INACTIVE',
      });

      const result = await service.remove('comp-1', 'sh-1');

      expect(result).toEqual({ action: 'INACTIVATED' });
    });

    it('should throw BusinessRuleException for already inactive shareholder with holdings', async () => {
      prisma.shareholder.findFirst.mockResolvedValue({
        ...mockShareholder,
        status: 'INACTIVE',
      });
      prisma.shareholding.count.mockResolvedValue(5);
      prisma.transaction.count.mockResolvedValue(0);

      await expect(service.remove('comp-1', 'sh-1')).rejects.toThrow(BusinessRuleException);
    });

    it('should throw NotFoundException for missing shareholder', async () => {
      prisma.shareholder.findFirst.mockResolvedValue(null);

      await expect(service.remove('comp-1', 'sh-999')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── SET BENEFICIAL OWNERS ───────────────────────────────────────

  describe('setBeneficialOwners', () => {
    const uboDto = {
      beneficialOwners: [
        { name: 'Maria Souza', cpf: '529.982.247-25', ownershipPercentage: '60.00' },
        { name: 'Pedro Santos', ownershipPercentage: '40.00' },
      ],
    };

    it('should set beneficial owners for corporate shareholder', async () => {
      prisma.shareholder.findFirst.mockResolvedValue(mockCorporateShareholder);

      const createdOwners = [
        {
          id: 'bo-1',
          shareholderId: 'sh-2',
          name: 'Maria Souza',
          cpf: '529.982.247-25',
          ownershipPct: new Prisma.Decimal('60.00'),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'bo-2',
          shareholderId: 'sh-2',
          name: 'Pedro Santos',
          cpf: null,
          ownershipPct: new Prisma.Decimal('40.00'),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      prisma.$transaction.mockImplementation(async (fn: (...args: unknown[]) => unknown) => {
        const tx = {
          beneficialOwner: {
            deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
            create: jest
              .fn()
              .mockResolvedValueOnce(createdOwners[0])
              .mockResolvedValueOnce(createdOwners[1]),
          },
        };
        return fn(tx);
      });

      const result = await service.setBeneficialOwners('comp-1', 'sh-2', uboDto);

      expect(result).toHaveLength(2);
    });

    it('should throw NotFoundException for missing shareholder', async () => {
      prisma.shareholder.findFirst.mockResolvedValue(null);

      await expect(service.setBeneficialOwners('comp-1', 'sh-999', uboDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BusinessRuleException for non-corporate shareholder', async () => {
      prisma.shareholder.findFirst.mockResolvedValue(mockShareholder); // FOUNDER type

      await expect(service.setBeneficialOwners('comp-1', 'sh-1', uboDto)).rejects.toThrow(
        BusinessRuleException,
      );
    });

    it('should throw BusinessRuleException when percentages exceed 100%', async () => {
      prisma.shareholder.findFirst.mockResolvedValue(mockCorporateShareholder);

      await expect(
        service.setBeneficialOwners('comp-1', 'sh-2', {
          beneficialOwners: [
            { name: 'A', ownershipPercentage: '70.00' },
            { name: 'B', ownershipPercentage: '40.00' },
          ],
        }),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should throw BusinessRuleException when no owner >= 25%', async () => {
      prisma.shareholder.findFirst.mockResolvedValue(mockCorporateShareholder);

      await expect(
        service.setBeneficialOwners('comp-1', 'sh-2', {
          beneficialOwners: [
            { name: 'A', ownershipPercentage: '20.00' },
            { name: 'B', ownershipPercentage: '20.00' },
            { name: 'C', ownershipPercentage: '20.00' },
          ],
        }),
      ).rejects.toThrow(BusinessRuleException);
    });
  });

  // ─── FIND FOREIGN SHAREHOLDERS ───────────────────────────────────

  describe('findForeignShareholders', () => {
    it('should return foreign shareholders with summary', async () => {
      const foreignShareholder = {
        ...mockShareholder,
        isForeign: true,
        taxResidency: 'US',
        shareholdings: [
          { quantity: new Prisma.Decimal('1000'), ownershipPct: new Prisma.Decimal('10.5') },
        ],
      };
      prisma.shareholder.findMany.mockResolvedValue([foreignShareholder]);

      const result = await service.findForeignShareholders('comp-1');

      expect(result.shareholders).toHaveLength(1);
      expect(result.summary.totalForeignShareholders).toBe(1);
      expect(result.summary.totalForeignOwnershipPercentage).toBe('10.5');
    });

    it('should return empty result when no foreign shareholders', async () => {
      prisma.shareholder.findMany.mockResolvedValue([]);

      const result = await service.findForeignShareholders('comp-1');

      expect(result.shareholders).toHaveLength(0);
      expect(result.summary.totalForeignShareholders).toBe(0);
      expect(result.summary.totalForeignOwnershipPercentage).toBe('0');
    });
  });
});
