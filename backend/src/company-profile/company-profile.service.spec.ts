import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bull';
import { CompanyProfileService } from './company-profile.service';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../aws/s3.service';
import {
  NotFoundException,
  ConflictException,
  BusinessRuleException,
  UnauthorizedException,
} from '../common/filters/app-exception';

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed-pwd'),
  compare: jest.fn(),
}));

import * as bcrypt from 'bcryptjs';

// ─── Mock Data ────────────────────────────────────────────────────────

const mockCompany = {
  id: 'comp-1',
  name: 'Navia Tecnologia',
  status: 'ACTIVE' as const,
  foundedDate: new Date('2020-06-15'),
};

const mockProfile = {
  id: 'profile-1',
  companyId: 'comp-1',
  slug: 'navia-tecnologia-a1b2',
  status: 'DRAFT' as const,
  headline: 'Fintech for cap table',
  description: 'We manage equity',
  sector: 'FINTECH' as const,
  foundedYear: 2020,
  website: 'https://navia.com.br',
  location: 'Sao Paulo, BR',
  accessType: 'PUBLIC' as const,
  accessPasswordHash: null,
  litigationStatus: null,
  litigationData: null,
  litigationFetchedAt: null,
  litigationError: null,
  publishedAt: null,
  archivedAt: null,
  createdAt: new Date('2026-02-25T10:00:00Z'),
  updatedAt: new Date('2026-02-25T10:00:00Z'),
  company: { name: 'Navia Tecnologia', logoUrl: null },
};

const mockPublishedProfile = {
  ...mockProfile,
  status: 'PUBLISHED' as const,
  publishedAt: new Date('2026-02-25T12:00:00Z'),
  metrics: [
    {
      id: 'metric-1',
      profileId: 'profile-1',
      label: 'ARR',
      value: '1000000',
      format: 'CURRENCY_BRL' as const,
      icon: null,
      order: 0,
    },
  ],
  team: [
    {
      id: 'team-1',
      profileId: 'profile-1',
      name: 'Nelson',
      title: 'CEO',
      photoUrl: null,
      linkedinUrl: null,
      order: 0,
    },
  ],
  documents: [
    {
      id: 'doc-1',
      profileId: 'profile-1',
      name: 'Pitch Deck',
      category: 'PITCH_DECK' as const,
      fileKey: 'profiles/profile-1/docs/abc.pdf',
      fileSize: 2048,
      mimeType: 'application/pdf',
      pageCount: 10,
      order: 0,
    },
  ],
  _count: { views: 42 },
};

const _mockMetric = {
  label: 'Revenue',
  value: '500000',
  format: 'CURRENCY_BRL' as const,
  icon: 'dollar-sign',
  order: 0,
};

const _mockTeamMember = {
  name: 'Maria Santos',
  title: 'CTO',
  photoUrl: null,
  linkedinUrl: 'https://www.linkedin.com/in/maria',
  order: 0,
};

// ─── Tests ────────────────────────────────────────────────────────────

describe('CompanyProfileService', () => {
  let service: CompanyProfileService;
  let prisma: any;
  let s3Service: any;
  let configService: any;

  beforeEach(async () => {
    prisma = {
      company: {
        findUnique: jest.fn(),
      },
      companyProfile: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      profileMetric: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      profileTeamMember: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      profileView: {
        create: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
        groupBy: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    s3Service = {
      isAvailable: jest.fn().mockReturnValue(true),
      getDocumentsBucket: jest.fn().mockReturnValue('navia-documents'),
      upload: jest.fn().mockResolvedValue(undefined),
      generatePresignedUrl: jest.fn().mockResolvedValue('https://s3.example.com/presigned-url'),
    };

    configService = {
      get: jest.fn().mockReturnValue('http://localhost:3000'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompanyProfileService,
        { provide: PrismaService, useValue: prisma },
        { provide: S3Service, useValue: s3Service },
        { provide: ConfigService, useValue: configService },
        {
          provide: getQueueToken('profile-litigation'),
          useValue: { add: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = module.get<CompanyProfileService>(CompanyProfileService);

    jest.clearAllMocks();

    // Re-apply default mock values after clearAllMocks
    s3Service.isAvailable.mockReturnValue(true);
    s3Service.getDocumentsBucket.mockReturnValue('navia-documents');
    s3Service.upload.mockResolvedValue(undefined);
    s3Service.generatePresignedUrl.mockResolvedValue('https://s3.example.com/presigned-url');
    configService.get.mockReturnValue('http://localhost:3000');
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-pwd');
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
  });

  // ═══════════════════════════════════════════════════════════════════
  // CREATE
  // ═══════════════════════════════════════════════════════════════════

  describe('create', () => {
    const dto = {
      headline: 'Cap table platform',
      description: 'We help startups',
      sector: 'FINTECH' as const,
      website: 'https://navia.com.br',
    };

    it('should create a profile successfully', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.companyProfile.findUnique
        .mockResolvedValueOnce(null) // no existing profile
        .mockResolvedValueOnce(null); // no slug collision
      prisma.companyProfile.create.mockResolvedValue({
        ...mockProfile,
        accessPasswordHash: null,
        litigationData: null,
      });

      const result = await service.create('comp-1', dto, 'user-1');

      expect(prisma.company.findUnique).toHaveBeenCalledWith({
        where: { id: 'comp-1' },
        select: { id: true, name: true, cnpj: true, status: true, foundedDate: true },
      });
      expect(prisma.companyProfile.create).toHaveBeenCalled();
      expect(result).not.toHaveProperty('accessPasswordHash');
      expect(result).not.toHaveProperty('litigationData');
      expect(result.headline).toBe('Fintech for cap table');
    });

    it('should throw NotFoundException if company not found', async () => {
      prisma.company.findUnique.mockResolvedValue(null);

      await expect(service.create('comp-999', dto, 'user-1')).rejects.toThrow(NotFoundException);
      await expect(service.create('comp-999', dto, 'user-1')).rejects.toMatchObject({
        code: 'COMPANY_NOT_FOUND',
      });
    });

    it('should throw BusinessRuleException if company is not ACTIVE', async () => {
      prisma.company.findUnique.mockResolvedValue({
        ...mockCompany,
        status: 'DRAFT',
      });

      await expect(service.create('comp-1', dto, 'user-1')).rejects.toThrow(BusinessRuleException);
      await expect(service.create('comp-1', dto, 'user-1')).rejects.toMatchObject({
        code: 'PROFILE_COMPANY_NOT_ACTIVE',
      });
    });

    it('should throw ConflictException if profile already exists', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany);
      // findUnique is called first with { companyId } to check for existing profile
      prisma.companyProfile.findUnique.mockResolvedValue({ id: 'existing-profile' });

      try {
        await service.create('comp-1', dto, 'user-1');
        fail('Expected ConflictException to be thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ConflictException);
        expect(err.code).toBe('PROFILE_ALREADY_EXISTS');
      }
    });

    it('should pre-populate foundedYear from company.foundedDate when not provided in dto', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.companyProfile.findUnique
        .mockResolvedValueOnce(null) // no existing profile
        .mockResolvedValueOnce(null); // no slug collision
      prisma.companyProfile.create.mockResolvedValue(mockProfile);

      await service.create('comp-1', { headline: 'Test' }, 'user-1');

      const createCall = prisma.companyProfile.create.mock.calls[0][0];
      expect(createCall.data.foundedYear).toBe(2020);
    });

    it('should use dto.foundedYear when explicitly provided', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.companyProfile.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      prisma.companyProfile.create.mockResolvedValue(mockProfile);

      await service.create('comp-1', { foundedYear: 2018 }, 'user-1');

      const createCall = prisma.companyProfile.create.mock.calls[0][0];
      expect(createCall.data.foundedYear).toBe(2018);
    });

    it('should not set foundedYear when neither dto nor company.foundedDate provide it', async () => {
      prisma.company.findUnique.mockResolvedValue({
        ...mockCompany,
        foundedDate: null,
      });
      prisma.companyProfile.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      prisma.companyProfile.create.mockResolvedValue(mockProfile);

      await service.create('comp-1', {}, 'user-1');

      const createCall = prisma.companyProfile.create.mock.calls[0][0];
      expect(createCall.data.foundedYear).toBeUndefined();
    });

    it('should hash password when accessType is PASSWORD', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.companyProfile.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      prisma.companyProfile.create.mockResolvedValue(mockProfile);

      await service.create(
        'comp-1',
        { accessType: 'PASSWORD' as any, accessPassword: 'secret123' },
        'user-1',
      );

      expect(bcrypt.hash).toHaveBeenCalledWith('secret123', 10);
      const createCall = prisma.companyProfile.create.mock.calls[0][0];
      expect(createCall.data.accessPasswordHash).toBe('hashed-pwd');
    });

    it('should not hash password when accessType is PUBLIC', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.companyProfile.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      prisma.companyProfile.create.mockResolvedValue(mockProfile);

      await service.create('comp-1', { accessType: 'PUBLIC' as any }, 'user-1');

      expect(bcrypt.hash).not.toHaveBeenCalled();
      const createCall = prisma.companyProfile.create.mock.calls[0][0];
      expect(createCall.data.accessPasswordHash).toBeNull();
    });

    it('should default accessType to PUBLIC when not provided', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.companyProfile.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      prisma.companyProfile.create.mockResolvedValue(mockProfile);

      await service.create('comp-1', {}, 'user-1');

      const createCall = prisma.companyProfile.create.mock.calls[0][0];
      expect(createCall.data.accessType).toBe('PUBLIC');
    });

    it('should retry slug generation on collision', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.companyProfile.findUnique
        .mockResolvedValueOnce(null) // no existing profile for companyId
        .mockResolvedValueOnce({ id: 'other-profile' }) // first slug collision
        .mockResolvedValueOnce(null); // second slug attempt succeeds
      prisma.companyProfile.create.mockResolvedValue(mockProfile);

      const result = await service.create('comp-1', dto, 'user-1');

      // Should have called findUnique for slug at least 2 times after the first check
      expect(prisma.companyProfile.findUnique).toHaveBeenCalledTimes(3);
      expect(result).toBeDefined();
    });

    it('should strip sensitive fields from returned profile', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.companyProfile.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      prisma.companyProfile.create.mockResolvedValue({
        ...mockProfile,
        accessPasswordHash: 'should-be-removed',
        litigationData: { some: 'sensitive-data' },
      });

      const result = await service.create('comp-1', dto, 'user-1');

      expect(result).not.toHaveProperty('accessPasswordHash');
      expect(result).not.toHaveProperty('litigationData');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // FIND BY COMPANY ID
  // ═══════════════════════════════════════════════════════════════════

  describe('findByCompanyId', () => {
    it('should return profile with metrics, team, documents, viewCount, and shareUrl', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue(mockPublishedProfile);

      const result = await service.findByCompanyId('comp-1');

      expect(result.viewCount).toBe(42);
      expect(result.shareUrl).toBe('http://localhost:3000/p/navia-tecnologia-a1b2');
      expect(result).not.toHaveProperty('accessPasswordHash');
      expect(result).not.toHaveProperty('litigationData');
      expect(result).not.toHaveProperty('_count');
    });

    it('should throw NotFoundException if profile not found', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue(null);

      await expect(service.findByCompanyId('comp-999')).rejects.toThrow(NotFoundException);
      await expect(service.findByCompanyId('comp-999')).rejects.toMatchObject({
        code: 'COMPANYPROFILE_NOT_FOUND',
      });
    });

    it('should use FRONTEND_URL from config for shareUrl', async () => {
      configService.get.mockReturnValue('https://app.navia.com.br');
      prisma.companyProfile.findUnique.mockResolvedValue(mockPublishedProfile);

      const result = await service.findByCompanyId('comp-1');

      expect(result.shareUrl).toBe('https://app.navia.com.br/p/navia-tecnologia-a1b2');
    });

    it('should include related data in the Prisma query', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue(mockPublishedProfile);

      await service.findByCompanyId('comp-1');

      expect(prisma.companyProfile.findUnique).toHaveBeenCalledWith({
        where: { companyId: 'comp-1' },
        include: {
          company: { select: { name: true, logoUrl: true } },
          metrics: { orderBy: { order: 'asc' } },
          team: { orderBy: { order: 'asc' } },
          documents: { orderBy: { order: 'asc' } },
          _count: { select: { views: true } },
        },
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // UPDATE
  // ═══════════════════════════════════════════════════════════════════

  describe('update', () => {
    it('should update profile fields successfully', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue({
        id: 'profile-1',
        accessType: 'PUBLIC',
      });
      prisma.companyProfile.update.mockResolvedValue({
        ...mockProfile,
        headline: 'Updated headline',
      });

      const result = await service.update('comp-1', { headline: 'Updated headline' });

      expect(prisma.companyProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { companyId: 'comp-1' },
          data: { headline: 'Updated headline' },
        }),
      );
      expect(result.headline).toBe('Updated headline');
    });

    it('should throw NotFoundException if profile not found', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue(null);

      await expect(service.update('comp-999', { headline: 'x' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should hash password when switching to PASSWORD access type', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue({
        id: 'profile-1',
        accessType: 'PUBLIC',
      });
      prisma.companyProfile.update.mockResolvedValue(mockProfile);

      await service.update('comp-1', {
        accessType: 'PASSWORD' as any,
        accessPassword: 'newpass',
      });

      expect(bcrypt.hash).toHaveBeenCalledWith('newpass', 10);
      const updateCall = prisma.companyProfile.update.mock.calls[0][0];
      expect(updateCall.data.accessPasswordHash).toBe('hashed-pwd');
    });

    it('should clear password hash when switching away from PASSWORD to PUBLIC', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue({
        id: 'profile-1',
        accessType: 'PASSWORD',
      });
      prisma.companyProfile.update.mockResolvedValue(mockProfile);

      await service.update('comp-1', { accessType: 'PUBLIC' as any });

      const updateCall = prisma.companyProfile.update.mock.calls[0][0];
      expect(updateCall.data.accessPasswordHash).toBeNull();
    });

    it('should clear password hash when switching to EMAIL_GATED', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue({
        id: 'profile-1',
        accessType: 'PASSWORD',
      });
      prisma.companyProfile.update.mockResolvedValue(mockProfile);

      await service.update('comp-1', { accessType: 'EMAIL_GATED' as any });

      const updateCall = prisma.companyProfile.update.mock.calls[0][0];
      expect(updateCall.data.accessPasswordHash).toBeNull();
    });

    it('should only include defined fields in the update data', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue({
        id: 'profile-1',
        accessType: 'PUBLIC',
      });
      prisma.companyProfile.update.mockResolvedValue(mockProfile);

      await service.update('comp-1', { website: 'https://new-site.com' });

      const updateCall = prisma.companyProfile.update.mock.calls[0][0];
      expect(updateCall.data).toEqual({ website: 'https://new-site.com' });
      expect(updateCall.data).not.toHaveProperty('headline');
      expect(updateCall.data).not.toHaveProperty('description');
    });

    it('should strip sensitive fields from the returned profile', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue({
        id: 'profile-1',
        accessType: 'PUBLIC',
      });
      prisma.companyProfile.update.mockResolvedValue({
        ...mockProfile,
        accessPasswordHash: 'should-be-stripped',
        litigationData: { lawsuits: [] },
      });

      const result = await service.update('comp-1', { headline: 'x' });

      expect(result).not.toHaveProperty('accessPasswordHash');
      expect(result).not.toHaveProperty('litigationData');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // UPDATE SLUG
  // ═══════════════════════════════════════════════════════════════════

  describe('updateSlug', () => {
    it('should update slug successfully', async () => {
      prisma.companyProfile.findUnique
        .mockResolvedValueOnce({ id: 'profile-1' }) // profile lookup
        .mockResolvedValueOnce(null); // no slug collision
      prisma.companyProfile.update.mockResolvedValue({
        ...mockProfile,
        slug: 'my-new-slug',
      });

      const result = await service.updateSlug('comp-1', 'my-new-slug');

      expect(result.slug).toBe('my-new-slug');
    });

    it('should throw NotFoundException if profile not found', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue(null);

      await expect(service.updateSlug('comp-999', 'valid-slug')).rejects.toThrow(NotFoundException);
    });

    it('should throw BusinessRuleException for invalid slug format (uppercase)', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue({ id: 'profile-1' });

      await expect(service.updateSlug('comp-1', 'Invalid-Slug')).rejects.toThrow(
        BusinessRuleException,
      );
      await expect(service.updateSlug('comp-1', 'Invalid-Slug')).rejects.toMatchObject({
        code: 'PROFILE_SLUG_INVALID',
      });
    });

    it('should throw BusinessRuleException for slug with special characters', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue({ id: 'profile-1' });

      await expect(service.updateSlug('comp-1', 'slug_with_underscores')).rejects.toThrow(
        BusinessRuleException,
      );
    });

    it('should throw BusinessRuleException for slug shorter than 3 characters', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue({ id: 'profile-1' });

      await expect(service.updateSlug('comp-1', 'ab')).rejects.toThrow(BusinessRuleException);
    });

    it('should throw BusinessRuleException for slug longer than 50 characters', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue({ id: 'profile-1' });

      const longSlug = 'a'.repeat(51);
      await expect(service.updateSlug('comp-1', longSlug)).rejects.toThrow(BusinessRuleException);
    });

    it('should throw BusinessRuleException for slug with leading hyphens', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue({ id: 'profile-1' });

      await expect(service.updateSlug('comp-1', '-invalid-slug')).rejects.toThrow(
        BusinessRuleException,
      );
    });

    it('should throw BusinessRuleException for slug with trailing hyphens', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue({ id: 'profile-1' });

      await expect(service.updateSlug('comp-1', 'invalid-slug-')).rejects.toThrow(
        BusinessRuleException,
      );
    });

    it('should throw BusinessRuleException for reserved slug "admin"', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue({ id: 'profile-1' });

      await expect(service.updateSlug('comp-1', 'admin')).rejects.toThrow(BusinessRuleException);
      await expect(service.updateSlug('comp-1', 'admin')).rejects.toMatchObject({
        code: 'PROFILE_SLUG_RESERVED',
      });
    });

    it('should throw BusinessRuleException for reserved slug "dashboard"', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue({ id: 'profile-1' });

      await expect(service.updateSlug('comp-1', 'dashboard')).rejects.toMatchObject({
        code: 'PROFILE_SLUG_RESERVED',
      });
    });

    it('should throw BusinessRuleException for reserved slug "login"', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue({ id: 'profile-1' });

      await expect(service.updateSlug('comp-1', 'login')).rejects.toMatchObject({
        code: 'PROFILE_SLUG_RESERVED',
      });
    });

    it('should throw ConflictException when slug is taken by another profile', async () => {
      prisma.companyProfile.findUnique
        .mockResolvedValueOnce({ id: 'profile-1' }) // current profile lookup by companyId
        .mockResolvedValueOnce({ id: 'other-profile' }); // slug uniqueness check returns different profile

      try {
        await service.updateSlug('comp-1', 'taken-slug');
        fail('Expected ConflictException to be thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ConflictException);
        expect(err.code).toBe('PROFILE_SLUG_TAKEN');
      }
    });

    it('should allow updating slug to the same value (own profile)', async () => {
      prisma.companyProfile.findUnique
        .mockResolvedValueOnce({ id: 'profile-1' }) // current profile
        .mockResolvedValueOnce({ id: 'profile-1' }); // slug owner is the SAME profile
      prisma.companyProfile.update.mockResolvedValue({
        ...mockProfile,
        slug: 'same-slug',
      });

      const result = await service.updateSlug('comp-1', 'same-slug');

      expect(result).toBeDefined();
    });

    it('should accept a valid slug with only lowercase letters and numbers', async () => {
      prisma.companyProfile.findUnique
        .mockResolvedValueOnce({ id: 'profile-1' })
        .mockResolvedValueOnce(null);
      prisma.companyProfile.update.mockResolvedValue({
        ...mockProfile,
        slug: 'abc123',
      });

      const result = await service.updateSlug('comp-1', 'abc123');
      expect(result).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // PUBLISH
  // ═══════════════════════════════════════════════════════════════════

  describe('publish', () => {
    it('should publish profile with a headline', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue({
        ...mockProfile,
        headline: 'We are great',
        description: null,
        metrics: [],
        team: [],
      });
      prisma.companyProfile.update.mockResolvedValue({
        ...mockProfile,
        status: 'PUBLISHED',
        publishedAt: new Date(),
      });

      const result = await service.publish('comp-1');

      expect(prisma.companyProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'PUBLISHED',
            archivedAt: null,
          }),
        }),
      );
      expect(result.status).toBe('PUBLISHED');
    });

    it('should publish profile with only description', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue({
        ...mockProfile,
        headline: null,
        description: 'We build things',
        metrics: [],
        team: [],
      });
      prisma.companyProfile.update.mockResolvedValue({
        ...mockProfile,
        status: 'PUBLISHED',
      });

      await expect(service.publish('comp-1')).resolves.toBeDefined();
    });

    it('should publish profile with metrics only', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue({
        ...mockProfile,
        headline: null,
        description: null,
        metrics: [{ id: 'metric-1' }],
        team: [],
      });
      prisma.companyProfile.update.mockResolvedValue({
        ...mockProfile,
        status: 'PUBLISHED',
      });

      await expect(service.publish('comp-1')).resolves.toBeDefined();
    });

    it('should publish profile with team members only', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue({
        ...mockProfile,
        headline: null,
        description: null,
        metrics: [],
        team: [{ id: 'team-1' }],
      });
      prisma.companyProfile.update.mockResolvedValue({
        ...mockProfile,
        status: 'PUBLISHED',
      });

      await expect(service.publish('comp-1')).resolves.toBeDefined();
    });

    it('should throw NotFoundException if profile not found', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue(null);

      await expect(service.publish('comp-999')).rejects.toThrow(NotFoundException);
    });

    it('should throw BusinessRuleException if profile has no content (BR-10)', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue({
        ...mockProfile,
        headline: null,
        description: null,
        metrics: [],
        team: [],
      });

      await expect(service.publish('comp-1')).rejects.toThrow(BusinessRuleException);
      await expect(service.publish('comp-1')).rejects.toMatchObject({
        code: 'PROFILE_EMPTY',
      });
    });

    it('should clear archivedAt when publishing', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue({
        ...mockProfile,
        headline: 'Test',
        metrics: [],
        team: [],
        archivedAt: new Date('2026-01-01'),
      });
      prisma.companyProfile.update.mockResolvedValue({
        ...mockProfile,
        status: 'PUBLISHED',
        archivedAt: null,
      });

      await service.publish('comp-1');

      const updateCall = prisma.companyProfile.update.mock.calls[0][0];
      expect(updateCall.data.archivedAt).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // UNPUBLISH
  // ═══════════════════════════════════════════════════════════════════

  describe('unpublish', () => {
    it('should set profile status to DRAFT', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue({ id: 'profile-1' });
      prisma.companyProfile.update.mockResolvedValue({
        ...mockProfile,
        status: 'DRAFT',
      });

      const result = await service.unpublish('comp-1');

      expect(prisma.companyProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'DRAFT' },
        }),
      );
      expect(result.status).toBe('DRAFT');
    });

    it('should throw NotFoundException if profile not found', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue(null);

      await expect(service.unpublish('comp-999')).rejects.toThrow(NotFoundException);
    });

    it('should strip sensitive fields from returned profile', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue({ id: 'profile-1' });
      prisma.companyProfile.update.mockResolvedValue({
        ...mockProfile,
        accessPasswordHash: 'secret',
        litigationData: {},
      });

      const result = await service.unpublish('comp-1');

      expect(result).not.toHaveProperty('accessPasswordHash');
      expect(result).not.toHaveProperty('litigationData');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // ARCHIVE
  // ═══════════════════════════════════════════════════════════════════

  describe('archive', () => {
    it('should set profile status to ARCHIVED with archivedAt', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue({ id: 'profile-1' });
      prisma.companyProfile.update.mockResolvedValue({
        ...mockProfile,
        status: 'ARCHIVED',
        archivedAt: new Date(),
      });

      const result = await service.archive('comp-1');

      expect(prisma.companyProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'ARCHIVED',
          }),
        }),
      );
      const updateCall = prisma.companyProfile.update.mock.calls[0][0];
      expect(updateCall.data.archivedAt).toBeInstanceOf(Date);
      expect(result.status).toBe('ARCHIVED');
    });

    it('should throw NotFoundException if profile not found', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue(null);

      await expect(service.archive('comp-999')).rejects.toThrow(NotFoundException);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // REPLACE METRICS
  // ═══════════════════════════════════════════════════════════════════

  describe('replaceMetrics', () => {
    const metricsDto = {
      metrics: [
        { label: 'ARR', value: '1M', format: 'CURRENCY_BRL' as const, order: 0 },
        { label: 'Users', value: '5000', format: 'NUMBER' as const, order: 1 },
      ],
    };

    it('should replace metrics successfully in a transaction', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue({ id: 'profile-1' });
      prisma.$transaction.mockImplementation((fn: any) => fn(prisma));
      prisma.profileMetric.deleteMany.mockResolvedValue({ count: 1 });
      prisma.profileMetric.createMany.mockResolvedValue({ count: 2 });
      prisma.companyProfile.findUnique.mockResolvedValue({
        ...mockProfile,
        metrics: metricsDto.metrics,
      });

      const result = await service.replaceMetrics('comp-1', metricsDto);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.profileMetric.deleteMany).toHaveBeenCalledWith({
        where: { profileId: 'profile-1' },
      });
      expect(prisma.profileMetric.createMany).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException if profile not found', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue(null);

      await expect(service.replaceMetrics('comp-999', metricsDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BusinessRuleException when exceeding 6 metrics', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue({ id: 'profile-1' });

      const tooManyMetrics = {
        metrics: Array.from({ length: 7 }, (_, i) => ({
          label: `Metric ${i}`,
          value: `${i}`,
          format: 'NUMBER' as const,
          order: i,
        })),
      };

      await expect(service.replaceMetrics('comp-1', tooManyMetrics)).rejects.toThrow(
        BusinessRuleException,
      );
      await expect(service.replaceMetrics('comp-1', tooManyMetrics)).rejects.toMatchObject({
        code: 'PROFILE_MAX_METRICS',
      });
    });

    it('should handle empty metrics array (clear all)', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue({ id: 'profile-1' });
      prisma.$transaction.mockImplementation((fn: any) => fn(prisma));
      prisma.profileMetric.deleteMany.mockResolvedValue({ count: 3 });
      prisma.companyProfile.findUnique.mockResolvedValue({
        ...mockProfile,
        metrics: [],
      });

      await service.replaceMetrics('comp-1', { metrics: [] });

      expect(prisma.profileMetric.deleteMany).toHaveBeenCalled();
      expect(prisma.profileMetric.createMany).not.toHaveBeenCalled();
    });

    it('should allow exactly 6 metrics', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue({ id: 'profile-1' });
      prisma.$transaction.mockImplementation((fn: any) => fn(prisma));
      prisma.profileMetric.deleteMany.mockResolvedValue({ count: 0 });
      prisma.profileMetric.createMany.mockResolvedValue({ count: 6 });
      prisma.companyProfile.findUnique.mockResolvedValue({
        ...mockProfile,
        metrics: [],
      });

      const sixMetrics = {
        metrics: Array.from({ length: 6 }, (_, i) => ({
          label: `Metric ${i}`,
          value: `${i}`,
          format: 'NUMBER' as const,
          order: i,
        })),
      };

      await expect(service.replaceMetrics('comp-1', sixMetrics)).resolves.toBeDefined();
    });

    it('should pass icon as null when not provided', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue({ id: 'profile-1' });
      prisma.$transaction.mockImplementation((fn: any) => fn(prisma));
      prisma.profileMetric.deleteMany.mockResolvedValue({ count: 0 });
      prisma.profileMetric.createMany.mockResolvedValue({ count: 1 });
      prisma.companyProfile.findUnique.mockResolvedValue(mockProfile);

      await service.replaceMetrics('comp-1', {
        metrics: [{ label: 'Test', value: '100', format: 'NUMBER' as const, order: 0 }],
      });

      const createManyCall = prisma.profileMetric.createMany.mock.calls[0][0];
      expect(createManyCall.data[0].icon).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // REPLACE TEAM MEMBERS
  // ═══════════════════════════════════════════════════════════════════

  describe('replaceTeamMembers', () => {
    const teamDto = {
      teamMembers: [
        { name: 'Nelson', title: 'CEO', order: 0 },
        { name: 'Maria', title: 'CTO', order: 1 },
      ],
    };

    it('should replace team members successfully in a transaction', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue({ id: 'profile-1' });
      prisma.$transaction.mockImplementation((fn: any) => fn(prisma));
      prisma.profileTeamMember.deleteMany.mockResolvedValue({ count: 1 });
      prisma.profileTeamMember.createMany.mockResolvedValue({ count: 2 });
      prisma.companyProfile.findUnique.mockResolvedValue({
        ...mockProfile,
        team: teamDto.teamMembers,
      });

      const result = await service.replaceTeamMembers('comp-1', teamDto);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.profileTeamMember.deleteMany).toHaveBeenCalledWith({
        where: { profileId: 'profile-1' },
      });
      expect(prisma.profileTeamMember.createMany).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException if profile not found', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue(null);

      await expect(service.replaceTeamMembers('comp-999', teamDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BusinessRuleException when exceeding 10 team members', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue({ id: 'profile-1' });

      const tooManyMembers = {
        teamMembers: Array.from({ length: 11 }, (_, i) => ({
          name: `Person ${i}`,
          title: `Title ${i}`,
          order: i,
        })),
      };

      await expect(service.replaceTeamMembers('comp-1', tooManyMembers)).rejects.toThrow(
        BusinessRuleException,
      );
      await expect(service.replaceTeamMembers('comp-1', tooManyMembers)).rejects.toMatchObject({
        code: 'PROFILE_MAX_TEAM',
      });
    });

    it('should allow exactly 10 team members', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue({ id: 'profile-1' });
      prisma.$transaction.mockImplementation((fn: any) => fn(prisma));
      prisma.profileTeamMember.deleteMany.mockResolvedValue({ count: 0 });
      prisma.profileTeamMember.createMany.mockResolvedValue({ count: 10 });
      prisma.companyProfile.findUnique.mockResolvedValue(mockProfile);

      const tenMembers = {
        teamMembers: Array.from({ length: 10 }, (_, i) => ({
          name: `Person ${i}`,
          title: `Title ${i}`,
          order: i,
        })),
      };

      await expect(service.replaceTeamMembers('comp-1', tenMembers)).resolves.toBeDefined();
    });

    it('should handle empty team members array (clear all)', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue({ id: 'profile-1' });
      prisma.$transaction.mockImplementation((fn: any) => fn(prisma));
      prisma.profileTeamMember.deleteMany.mockResolvedValue({ count: 5 });
      prisma.companyProfile.findUnique.mockResolvedValue({
        ...mockProfile,
        team: [],
      });

      await service.replaceTeamMembers('comp-1', { teamMembers: [] });

      expect(prisma.profileTeamMember.deleteMany).toHaveBeenCalled();
      expect(prisma.profileTeamMember.createMany).not.toHaveBeenCalled();
    });

    it('should set photoUrl and linkedinUrl to null when not provided', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue({ id: 'profile-1' });
      prisma.$transaction.mockImplementation((fn: any) => fn(prisma));
      prisma.profileTeamMember.deleteMany.mockResolvedValue({ count: 0 });
      prisma.profileTeamMember.createMany.mockResolvedValue({ count: 1 });
      prisma.companyProfile.findUnique.mockResolvedValue(mockProfile);

      await service.replaceTeamMembers('comp-1', {
        teamMembers: [{ name: 'Test', title: 'Dev', order: 0 }],
      });

      const createManyCall = prisma.profileTeamMember.createMany.mock.calls[0][0];
      expect(createManyCall.data[0].photoUrl).toBeNull();
      expect(createManyCall.data[0].linkedinUrl).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // UPLOAD TEAM PHOTO
  // ═══════════════════════════════════════════════════════════════════

  describe('uploadTeamPhoto', () => {
    const mockFile = {
      fieldname: 'file',
      originalname: 'photo.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      buffer: Buffer.from('fake-image-data'),
      size: 1024,
    } as Express.Multer.File;

    it('should upload a team photo and return a presigned URL', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue({ id: 'profile-1' });

      const result = await service.uploadTeamPhoto('comp-1', mockFile);

      expect(s3Service.upload).toHaveBeenCalledWith(
        'navia-documents',
        expect.stringMatching(/^profiles\/profile-1\/team\/[a-f0-9]+\.jpg$/),
        mockFile.buffer,
        { contentType: 'image/jpeg' },
      );
      expect(s3Service.generatePresignedUrl).toHaveBeenCalledWith(
        'navia-documents',
        expect.any(String),
        86400,
      );
      expect(result).toEqual({ url: 'https://s3.example.com/presigned-url' });
    });

    it('should throw NotFoundException if profile not found', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue(null);

      await expect(service.uploadTeamPhoto('comp-999', mockFile)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BusinessRuleException if S3 is not available', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue({ id: 'profile-1' });
      s3Service.isAvailable.mockReturnValue(false);

      await expect(service.uploadTeamPhoto('comp-1', mockFile)).rejects.toThrow(
        BusinessRuleException,
      );
      await expect(service.uploadTeamPhoto('comp-1', mockFile)).rejects.toMatchObject({
        code: 'SYS_S3_UNAVAILABLE',
      });
    });

    it('should throw BusinessRuleException if documents bucket is null', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue({ id: 'profile-1' });
      s3Service.getDocumentsBucket.mockReturnValue(null);

      await expect(service.uploadTeamPhoto('comp-1', mockFile)).rejects.toThrow(
        BusinessRuleException,
      );
    });

    it('should generate .png extension for image/png mimetype', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue({ id: 'profile-1' });

      const pngFile = { ...mockFile, mimetype: 'image/png' } as Express.Multer.File;
      await service.uploadTeamPhoto('comp-1', pngFile);

      expect(s3Service.upload).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringMatching(/\.png$/),
        expect.any(Buffer),
        expect.any(Object),
      );
    });

    it('should generate .webp extension for image/webp mimetype', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue({ id: 'profile-1' });

      const webpFile = { ...mockFile, mimetype: 'image/webp' } as Express.Multer.File;
      await service.uploadTeamPhoto('comp-1', webpFile);

      expect(s3Service.upload).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringMatching(/\.webp$/),
        expect.any(Buffer),
        expect.any(Object),
      );
    });

    it('should generate no extension for unknown mimetype', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue({ id: 'profile-1' });

      const unknownFile = {
        ...mockFile,
        mimetype: 'application/octet-stream',
      } as Express.Multer.File;
      await service.uploadTeamPhoto('comp-1', unknownFile);

      expect(s3Service.upload).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringMatching(/\/[a-f0-9]+$/),
        expect.any(Buffer),
        expect.any(Object),
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // GET PUBLIC PROFILE
  // ═══════════════════════════════════════════════════════════════════

  describe('getPublicProfile', () => {
    it('should return public profile for PUBLISHED + PUBLIC access', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue(mockPublishedProfile);
      prisma.profileView.create.mockResolvedValue({});

      const result = await service.getPublicProfile('navia-tecnologia-a1b2');

      expect(result.slug).toBe('navia-tecnologia-a1b2');
      expect(result.companyName).toBe('Navia Tecnologia');
      expect(result.metrics).toHaveLength(1);
      expect(result.team).toHaveLength(1);
      expect(result.documents).toHaveLength(1);
      expect(result.viewCount).toBe(42);
      expect(result.shareUrl).toBe('http://localhost:3000/p/navia-tecnologia-a1b2');
      expect(result.publishedAt).toBeDefined();
      expect(result).not.toHaveProperty('accessPasswordHash');
    });

    it('should throw NotFoundException if profile not found', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue(null);

      await expect(service.getPublicProfile('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if profile is DRAFT', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue({
        ...mockPublishedProfile,
        status: 'DRAFT',
      });

      await expect(service.getPublicProfile('navia-tecnologia-a1b2')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if profile is ARCHIVED', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue({
        ...mockPublishedProfile,
        status: 'ARCHIVED',
      });

      await expect(service.getPublicProfile('navia-tecnologia-a1b2')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw UnauthorizedException when PASSWORD access and no password provided', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue({
        ...mockPublishedProfile,
        accessType: 'PASSWORD',
        accessPasswordHash: 'some-hash',
      });

      await expect(service.getPublicProfile('navia-tecnologia-a1b2', undefined)).rejects.toThrow(
        UnauthorizedException,
      );

      try {
        await service.getPublicProfile('navia-tecnologia-a1b2', undefined);
      } catch (err: any) {
        expect(err.messageKey).toBe('errors.profile.passwordRequired');
      }
    });

    it('should throw UnauthorizedException when PASSWORD access and no hash stored', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue({
        ...mockPublishedProfile,
        accessType: 'PASSWORD',
        accessPasswordHash: null,
      });

      await expect(
        service.getPublicProfile('navia-tecnologia-a1b2', 'some-password'),
      ).rejects.toThrow(UnauthorizedException);

      try {
        await service.getPublicProfile('navia-tecnologia-a1b2', 'some-password');
      } catch (err: any) {
        expect(err.messageKey).toBe('errors.profile.invalidPassword');
      }
    });

    it('should throw UnauthorizedException when password is incorrect', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue({
        ...mockPublishedProfile,
        accessType: 'PASSWORD',
        accessPasswordHash: 'hashed-pwd',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.getPublicProfile('navia-tecnologia-a1b2', 'wrong-password'),
      ).rejects.toThrow(UnauthorizedException);

      try {
        await service.getPublicProfile('navia-tecnologia-a1b2', 'wrong-password');
      } catch (err: any) {
        expect(err.messageKey).toBe('errors.profile.invalidPassword');
      }
    });

    it('should succeed when PASSWORD access and password is correct', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue({
        ...mockPublishedProfile,
        accessType: 'PASSWORD',
        accessPasswordHash: 'hashed-pwd',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      prisma.profileView.create.mockResolvedValue({});

      const result = await service.getPublicProfile('navia-tecnologia-a1b2', 'correct-password');

      expect(bcrypt.compare).toHaveBeenCalledWith('correct-password', 'hashed-pwd');
      expect(result.slug).toBe('navia-tecnologia-a1b2');
    });

    it('should throw BusinessRuleException when EMAIL_GATED access and no email provided', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue({
        ...mockPublishedProfile,
        accessType: 'EMAIL_GATED',
      });

      await expect(
        service.getPublicProfile('navia-tecnologia-a1b2', undefined, undefined),
      ).rejects.toThrow(BusinessRuleException);

      await expect(
        service.getPublicProfile('navia-tecnologia-a1b2', undefined, undefined),
      ).rejects.toMatchObject({
        code: 'PROFILE_EMAIL_REQUIRED',
      });
    });

    it('should succeed when EMAIL_GATED access and email is provided', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue({
        ...mockPublishedProfile,
        accessType: 'EMAIL_GATED',
      });
      prisma.profileView.create.mockResolvedValue({});

      const result = await service.getPublicProfile(
        'navia-tecnologia-a1b2',
        undefined,
        'viewer@example.com',
      );

      expect(result.slug).toBe('navia-tecnologia-a1b2');
    });

    it('should record view fire-and-forget (does not await)', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue(mockPublishedProfile);
      prisma.profileView.create.mockResolvedValue({});

      await service.getPublicProfile(
        'navia-tecnologia-a1b2',
        undefined,
        'viewer@example.com',
        '192.168.1.100',
        'Mozilla/5.0',
        'https://google.com',
      );

      // Allow the fire-and-forget promise to resolve
      await new Promise((r) => setTimeout(r, 10));

      expect(prisma.profileView.create).toHaveBeenCalledWith({
        data: {
          profileId: 'profile-1',
          viewerEmail: 'viewer@example.com',
          viewerIp: '192.168.1.0/24',
          userAgent: 'Mozilla/5.0',
          referrer: 'https://google.com',
        },
      });
    });

    it('should not throw when view recording fails (fire-and-forget)', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue(mockPublishedProfile);
      prisma.profileView.create.mockRejectedValue(new Error('DB write failed'));

      const result = await service.getPublicProfile('navia-tecnologia-a1b2');

      expect(result.slug).toBe('navia-tecnologia-a1b2');
    });

    it('should redact IP to /24 subnet in view recording', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue(mockPublishedProfile);
      prisma.profileView.create.mockResolvedValue({});

      await service.getPublicProfile('navia-tecnologia-a1b2', undefined, undefined, '10.20.30.40');

      await new Promise((r) => setTimeout(r, 10));

      expect(prisma.profileView.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            viewerIp: '10.20.30.0/24',
          }),
        }),
      );
    });

    it('should handle ::ffff: prefix in IPv4 addresses', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue(mockPublishedProfile);
      prisma.profileView.create.mockResolvedValue({});

      await service.getPublicProfile(
        'navia-tecnologia-a1b2',
        undefined,
        undefined,
        '::ffff:192.168.0.5',
      );

      await new Promise((r) => setTimeout(r, 10));

      expect(prisma.profileView.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            viewerIp: '192.168.0.0/24',
          }),
        }),
      );
    });

    it('should pass undefined IP as null in view recording', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue(mockPublishedProfile);
      prisma.profileView.create.mockResolvedValue({});

      await service.getPublicProfile('navia-tecnologia-a1b2');

      await new Promise((r) => setTimeout(r, 10));

      expect(prisma.profileView.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            viewerIp: null,
          }),
        }),
      );
    });

    it('should map metric fields correctly in the response', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue(mockPublishedProfile);
      prisma.profileView.create.mockResolvedValue({});

      const result = await service.getPublicProfile('navia-tecnologia-a1b2');

      expect(result.metrics[0]).toEqual({
        id: 'metric-1',
        label: 'ARR',
        value: '1000000',
        format: 'CURRENCY_BRL',
        icon: null,
        order: 0,
      });
    });

    it('should map team fields correctly in the response', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue(mockPublishedProfile);
      prisma.profileView.create.mockResolvedValue({});

      const result = await service.getPublicProfile('navia-tecnologia-a1b2');

      expect(result.team[0]).toEqual({
        id: 'team-1',
        name: 'Nelson',
        title: 'CEO',
        photoUrl: null,
        linkedinUrl: null,
        order: 0,
      });
    });

    it('should map document fields correctly in the response', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue(mockPublishedProfile);
      prisma.profileView.create.mockResolvedValue({});

      const result = await service.getPublicProfile('navia-tecnologia-a1b2');

      expect(result.documents[0]).toEqual({
        id: 'doc-1',
        name: 'Pitch Deck',
        category: 'PITCH_DECK',
        fileSize: 2048,
        mimeType: 'application/pdf',
        pageCount: 10,
        order: 0,
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // GET ANALYTICS
  // ═══════════════════════════════════════════════════════════════════

  describe('getAnalytics', () => {
    const now = new Date();
    const mockViews = [
      {
        id: 'view-1',
        viewerEmail: 'alice@example.com',
        viewerIp: '10.0.0.5',
        userAgent: 'Chrome',
        referrer: 'https://google.com',
        viewedAt: new Date(now.getTime() - 86400000), // 1 day ago
      },
      {
        id: 'view-2',
        viewerEmail: 'bob@example.com',
        viewerIp: '10.0.1.5',
        userAgent: 'Firefox',
        referrer: null,
        viewedAt: new Date(now.getTime() - 86400000), // 1 day ago
      },
      {
        id: 'view-3',
        viewerEmail: null,
        viewerIp: '192.168.1.100',
        userAgent: 'Safari',
        referrer: 'https://twitter.com',
        viewedAt: now,
      },
    ];

    it('should return analytics for default 30d period', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue({ id: 'profile-1' });
      prisma.profileView.count.mockResolvedValue(100);
      prisma.profileView.findMany.mockResolvedValue(mockViews);
      prisma.profileView.groupBy.mockResolvedValue([
        { viewerIp: '10.0.0.0/24' },
        { viewerIp: '10.0.1.0/24' },
        { viewerIp: '192.168.1.0/24' },
      ]);

      const result = await service.getAnalytics('comp-1');

      expect(result.totalViews).toBe(100);
      expect(result.periodViews).toBe(3);
      expect(result.uniqueViewers).toBe(3);
      expect(result.period).toBe('30d');
      expect(result.viewsByDay).toHaveLength(30);
      expect(result.recentViewers).toHaveLength(3);
    });

    it('should throw NotFoundException if profile not found', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue(null);

      await expect(service.getAnalytics('comp-999')).rejects.toThrow(NotFoundException);
    });

    it('should support 7d period', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue({ id: 'profile-1' });
      prisma.profileView.count.mockResolvedValue(10);
      prisma.profileView.findMany.mockResolvedValue([]);
      prisma.profileView.groupBy.mockResolvedValue([]);

      const result = await service.getAnalytics('comp-1', '7d');

      expect(result.period).toBe('7d');
      expect(result.viewsByDay).toHaveLength(7);
    });

    it('should support 90d period', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue({ id: 'profile-1' });
      prisma.profileView.count.mockResolvedValue(500);
      prisma.profileView.findMany.mockResolvedValue([]);
      prisma.profileView.groupBy.mockResolvedValue([]);

      const result = await service.getAnalytics('comp-1', '90d');

      expect(result.period).toBe('90d');
      expect(result.viewsByDay).toHaveLength(90);
    });

    it('should redact IP addresses in recentViewers', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue({ id: 'profile-1' });
      prisma.profileView.count.mockResolvedValue(3);
      prisma.profileView.findMany.mockResolvedValue(mockViews);
      prisma.profileView.groupBy.mockResolvedValue([]);

      const result = await service.getAnalytics('comp-1');

      expect(result.recentViewers[0].ip).toBe('10.0.0.0/24');
      expect(result.recentViewers[2].ip).toBe('192.168.1.0/24');
    });

    it('should limit recentViewers to 20', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue({ id: 'profile-1' });
      const manyViews = Array.from({ length: 25 }, (_, i) => ({
        id: `view-${i}`,
        viewerEmail: `user${i}@example.com`,
        viewerIp: '10.0.0.1',
        userAgent: 'Chrome',
        referrer: null,
        viewedAt: new Date(),
      }));
      prisma.profileView.count.mockResolvedValue(25);
      prisma.profileView.findMany.mockResolvedValue(manyViews);
      prisma.profileView.groupBy.mockResolvedValue([{ viewerIp: '10.0.0.0/24' }]);

      const result = await service.getAnalytics('comp-1');

      expect(result.recentViewers).toHaveLength(20);
    });

    it('should return 0 for all counts when no views exist', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue({ id: 'profile-1' });
      prisma.profileView.count.mockResolvedValue(0);
      prisma.profileView.findMany.mockResolvedValue([]);
      prisma.profileView.groupBy.mockResolvedValue([]);

      const result = await service.getAnalytics('comp-1');

      expect(result.totalViews).toBe(0);
      expect(result.periodViews).toBe(0);
      expect(result.uniqueViewers).toBe(0);
      expect(result.recentViewers).toHaveLength(0);
    });

    it('should group views by day correctly in dailySeries', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayKey = yesterday.toISOString().split('T')[0];

      prisma.companyProfile.findUnique.mockResolvedValue({ id: 'profile-1' });
      prisma.profileView.count.mockResolvedValue(2);
      prisma.profileView.findMany.mockResolvedValue([
        {
          id: 'v1',
          viewerEmail: null,
          viewerIp: null,
          userAgent: null,
          referrer: null,
          viewedAt: yesterday,
        },
        {
          id: 'v2',
          viewerEmail: null,
          viewerIp: null,
          userAgent: null,
          referrer: null,
          viewedAt: yesterday,
        },
      ]);
      prisma.profileView.groupBy.mockResolvedValue([]);

      const result = await service.getAnalytics('comp-1');

      const yesterdayEntry = result.viewsByDay.find((d: any) => d.date === yesterdayKey);
      expect(yesterdayEntry).toBeDefined();
      expect(yesterdayEntry!.views).toBe(2);
    });

    it('should fill 0 for days with no views in dailySeries', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue({ id: 'profile-1' });
      prisma.profileView.count.mockResolvedValue(0);
      prisma.profileView.findMany.mockResolvedValue([]);
      prisma.profileView.groupBy.mockResolvedValue([]);

      const result = await service.getAnalytics('comp-1', '7d');

      expect(result.viewsByDay.every((d: any) => d.views === 0)).toBe(true);
    });

    it('should handle null viewerIp in recentViewers', async () => {
      prisma.companyProfile.findUnique.mockResolvedValue({ id: 'profile-1' });
      prisma.profileView.count.mockResolvedValue(1);
      prisma.profileView.findMany.mockResolvedValue([
        {
          id: 'v1',
          viewerEmail: 'test@test.com',
          viewerIp: null,
          userAgent: null,
          referrer: null,
          viewedAt: new Date(),
        },
      ]);
      prisma.profileView.groupBy.mockResolvedValue([]);

      const result = await service.getAnalytics('comp-1');

      expect(result.recentViewers[0].ip).toBeUndefined();
    });
  });
});
