import { Test, TestingModule } from '@nestjs/testing';
import { CompanyProfileController } from './company-profile.controller';
import { PublicProfileController } from './public-profile.controller';
import { CompanyProfileService } from './company-profile.service';
import {
  NotFoundException,
  ConflictException,
  BusinessRuleException,
  UnauthorizedException,
} from '../common/filters/app-exception';

const mockUser = {
  id: 'user-1',
  privyUserId: 'privy-1',
  email: 'admin@test.com',
  walletAddress: null,
  firstName: 'Admin',
  lastName: 'User',
  kycStatus: 'NOT_STARTED',
  locale: 'pt-BR',
};

const COMPANY_ID = 'comp-1';
const PROFILE_ID = 'profile-1';
const SLUG = 'acme-corp-ab12';

const mockProfile = {
  id: PROFILE_ID,
  companyId: COMPANY_ID,
  slug: SLUG,
  headline: 'Leading fintech in Brazil',
  description: 'We build equity management tools.',
  sector: 'FINTECH' as const,
  foundedYear: 2020,
  website: 'https://acme.com.br',
  location: 'Sao Paulo, Brazil',
  accessType: 'PUBLIC' as const,
  status: 'DRAFT' as const,
  publishedAt: null,
  archivedAt: null,
  createdAt: new Date('2026-01-15'),
  updatedAt: new Date('2026-01-15'),
  company: { name: 'Acme Ltda.', logoUrl: null },
};

const mockPublishedProfile = {
  ...mockProfile,
  status: 'PUBLISHED' as const,
  publishedAt: new Date('2026-01-20'),
};

const mockAnalytics = {
  totalViews: 150,
  periodViews: 42,
  uniqueViewers: 30,
  period: '30d',
  viewsByDay: [{ date: '2026-02-01', views: 5 }],
  recentViewers: [
    { email: 'viewer@test.com', ip: '192.168.1.0/24', referrer: null, viewedAt: new Date() },
  ],
};

const mockPublicProfile = {
  id: PROFILE_ID,
  slug: SLUG,
  companyName: 'Acme Ltda.',
  companyLogo: null,
  headline: 'Leading fintech in Brazil',
  description: 'We build equity management tools.',
  sector: 'FINTECH',
  foundedYear: 2020,
  website: 'https://acme.com.br',
  location: 'Sao Paulo, Brazil',
  metrics: [],
  team: [],
  documents: [],
  viewCount: 150,
  shareUrl: 'http://localhost:3000/p/acme-corp-ab12',
  publishedAt: new Date('2026-01-20'),
};

const mockService = {
  create: jest.fn(),
  findByCompanyId: jest.fn(),
  update: jest.fn(),
  updateSlug: jest.fn(),
  publish: jest.fn(),
  unpublish: jest.fn(),
  archive: jest.fn(),
  replaceMetrics: jest.fn(),
  replaceTeamMembers: jest.fn(),
  uploadTeamPhoto: jest.fn(),
  getAnalytics: jest.fn(),
  getPublicProfile: jest.fn(),
};

describe('CompanyProfileController & PublicProfileController', () => {
  let profileController: CompanyProfileController;
  let publicController: PublicProfileController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CompanyProfileController, PublicProfileController],
      providers: [
        { provide: CompanyProfileService, useValue: mockService },
      ],
    }).compile();

    profileController = module.get<CompanyProfileController>(CompanyProfileController);
    publicController = module.get<PublicProfileController>(PublicProfileController);
    jest.clearAllMocks();
  });

  // ============================================================
  // CompanyProfileController
  // ============================================================

  describe('CompanyProfileController', () => {
    // ─── POST / (create) ────────────────────────────────────────

    describe('create', () => {
      const dto = {
        headline: 'Leading fintech in Brazil',
        description: 'We build equity management tools.',
        sector: 'FINTECH' as const,
        foundedYear: 2020,
        website: 'https://acme.com.br',
        location: 'Sao Paulo, Brazil',
      };

      it('should create a profile and return the result', async () => {
        mockService.create.mockResolvedValue(mockProfile);

        const result = await profileController.create(COMPANY_ID, mockUser as any, dto as any);

        expect(result).toEqual(mockProfile);
        expect(mockService.create).toHaveBeenCalledWith(COMPANY_ID, dto, mockUser.id);
        expect(mockService.create).toHaveBeenCalledTimes(1);
      });

      it('should propagate NotFoundException when company not found', async () => {
        mockService.create.mockRejectedValue(
          new NotFoundException('company', COMPANY_ID),
        );

        await expect(
          profileController.create(COMPANY_ID, mockUser as any, dto as any),
        ).rejects.toThrow(NotFoundException);
      });

      it('should propagate ConflictException when profile already exists', async () => {
        mockService.create.mockRejectedValue(
          new ConflictException('PROFILE_ALREADY_EXISTS', 'errors.profile.alreadyExists'),
        );

        await expect(
          profileController.create(COMPANY_ID, mockUser as any, dto as any),
        ).rejects.toThrow(ConflictException);
      });
    });

    // ─── GET / (findByCompanyId) ────────────────────────────────

    describe('findByCompanyId', () => {
      it('should return the profile for the company', async () => {
        const profileWithExtras = { ...mockProfile, viewCount: 42, shareUrl: 'http://localhost:3000/p/acme-corp-ab12' };
        mockService.findByCompanyId.mockResolvedValue(profileWithExtras);

        const result = await profileController.findByCompanyId(COMPANY_ID);

        expect(result).toEqual(profileWithExtras);
        expect(mockService.findByCompanyId).toHaveBeenCalledWith(COMPANY_ID);
        expect(mockService.findByCompanyId).toHaveBeenCalledTimes(1);
      });

      it('should propagate NotFoundException when no profile exists', async () => {
        mockService.findByCompanyId.mockRejectedValue(
          new NotFoundException('companyProfile'),
        );

        await expect(
          profileController.findByCompanyId(COMPANY_ID),
        ).rejects.toThrow(NotFoundException);
      });
    });

    // ─── PUT / (update) ─────────────────────────────────────────

    describe('update', () => {
      const dto = {
        headline: 'Updated headline',
        description: 'Updated description',
      };

      it('should update the profile and return the result', async () => {
        const updated = { ...mockProfile, headline: 'Updated headline', description: 'Updated description' };
        mockService.update.mockResolvedValue(updated);

        const result = await profileController.update(COMPANY_ID, dto as any);

        expect(result).toEqual(updated);
        expect(mockService.update).toHaveBeenCalledWith(COMPANY_ID, dto);
        expect(mockService.update).toHaveBeenCalledTimes(1);
      });

      it('should propagate NotFoundException when profile not found', async () => {
        mockService.update.mockRejectedValue(
          new NotFoundException('companyProfile'),
        );

        await expect(
          profileController.update(COMPANY_ID, dto as any),
        ).rejects.toThrow(NotFoundException);
      });
    });

    // ─── PUT /slug (updateSlug) ─────────────────────────────────

    describe('updateSlug', () => {
      const dto = { slug: 'new-slug-name' };

      it('should update the slug and return the result', async () => {
        const updated = { ...mockProfile, slug: 'new-slug-name' };
        mockService.updateSlug.mockResolvedValue(updated);

        const result = await profileController.updateSlug(COMPANY_ID, dto as any);

        expect(result).toEqual(updated);
        expect(mockService.updateSlug).toHaveBeenCalledWith(COMPANY_ID, 'new-slug-name');
        expect(mockService.updateSlug).toHaveBeenCalledTimes(1);
      });

      it('should propagate BusinessRuleException when slug is invalid', async () => {
        mockService.updateSlug.mockRejectedValue(
          new BusinessRuleException('PROFILE_SLUG_INVALID', 'errors.profile.slugInvalid'),
        );

        await expect(
          profileController.updateSlug(COMPANY_ID, dto as any),
        ).rejects.toThrow(BusinessRuleException);
      });

      it('should propagate ConflictException when slug is taken', async () => {
        mockService.updateSlug.mockRejectedValue(
          new ConflictException('PROFILE_SLUG_TAKEN', 'errors.profile.slugTaken'),
        );

        await expect(
          profileController.updateSlug(COMPANY_ID, dto as any),
        ).rejects.toThrow(ConflictException);
      });
    });

    // ─── POST /publish ──────────────────────────────────────────

    describe('publish', () => {
      it('should publish the profile and return the result', async () => {
        mockService.publish.mockResolvedValue(mockPublishedProfile);

        const result = await profileController.publish(COMPANY_ID);

        expect(result).toEqual(mockPublishedProfile);
        expect(mockService.publish).toHaveBeenCalledWith(COMPANY_ID);
        expect(mockService.publish).toHaveBeenCalledTimes(1);
      });

      it('should propagate BusinessRuleException when profile has no content', async () => {
        mockService.publish.mockRejectedValue(
          new BusinessRuleException('PROFILE_EMPTY', 'errors.profile.empty'),
        );

        await expect(
          profileController.publish(COMPANY_ID),
        ).rejects.toThrow(BusinessRuleException);
      });

      it('should propagate NotFoundException when profile not found', async () => {
        mockService.publish.mockRejectedValue(
          new NotFoundException('companyProfile'),
        );

        await expect(
          profileController.publish(COMPANY_ID),
        ).rejects.toThrow(NotFoundException);
      });
    });

    // ─── POST /unpublish ────────────────────────────────────────

    describe('unpublish', () => {
      it('should unpublish the profile and return the result', async () => {
        const unpublished = { ...mockProfile, status: 'DRAFT' as const };
        mockService.unpublish.mockResolvedValue(unpublished);

        const result = await profileController.unpublish(COMPANY_ID);

        expect(result).toEqual(unpublished);
        expect(mockService.unpublish).toHaveBeenCalledWith(COMPANY_ID);
        expect(mockService.unpublish).toHaveBeenCalledTimes(1);
      });

      it('should propagate NotFoundException when profile not found', async () => {
        mockService.unpublish.mockRejectedValue(
          new NotFoundException('companyProfile'),
        );

        await expect(
          profileController.unpublish(COMPANY_ID),
        ).rejects.toThrow(NotFoundException);
      });
    });

    // ─── POST /archive ──────────────────────────────────────────

    describe('archive', () => {
      it('should archive the profile and return the result', async () => {
        const archived = { ...mockProfile, status: 'ARCHIVED' as const, archivedAt: new Date() };
        mockService.archive.mockResolvedValue(archived);

        const result = await profileController.archive(COMPANY_ID);

        expect(result).toEqual(archived);
        expect(mockService.archive).toHaveBeenCalledWith(COMPANY_ID);
        expect(mockService.archive).toHaveBeenCalledTimes(1);
      });

      it('should propagate NotFoundException when profile not found', async () => {
        mockService.archive.mockRejectedValue(
          new NotFoundException('companyProfile'),
        );

        await expect(
          profileController.archive(COMPANY_ID),
        ).rejects.toThrow(NotFoundException);
      });
    });

    // ─── PUT /metrics (replaceMetrics) ──────────────────────────

    describe('replaceMetrics', () => {
      const dto = {
        metrics: [
          { label: 'ARR', value: 'R$ 5M', format: 'CURRENCY' as const, order: 0 },
          { label: 'Customers', value: '250', format: 'NUMBER' as const, order: 1 },
        ],
      };

      it('should replace metrics and return the result', async () => {
        const updated = { ...mockProfile, metrics: dto.metrics };
        mockService.replaceMetrics.mockResolvedValue(updated);

        const result = await profileController.replaceMetrics(COMPANY_ID, dto as any);

        expect(result).toEqual(updated);
        expect(mockService.replaceMetrics).toHaveBeenCalledWith(COMPANY_ID, dto);
        expect(mockService.replaceMetrics).toHaveBeenCalledTimes(1);
      });

      it('should propagate BusinessRuleException when exceeding max metrics', async () => {
        mockService.replaceMetrics.mockRejectedValue(
          new BusinessRuleException('PROFILE_MAX_METRICS', 'errors.profile.maxMetrics'),
        );

        await expect(
          profileController.replaceMetrics(COMPANY_ID, dto as any),
        ).rejects.toThrow(BusinessRuleException);
      });
    });

    // ─── PUT /team (replaceTeamMembers) ─────────────────────────

    describe('replaceTeamMembers', () => {
      const dto = {
        teamMembers: [
          { name: 'Nelson Pereira', title: 'CEO', order: 0 },
          { name: 'Maria Silva', title: 'CTO', order: 1 },
        ],
      };

      it('should replace team members and return the result', async () => {
        const updated = { ...mockProfile, team: dto.teamMembers };
        mockService.replaceTeamMembers.mockResolvedValue(updated);

        const result = await profileController.replaceTeamMembers(COMPANY_ID, dto as any);

        expect(result).toEqual(updated);
        expect(mockService.replaceTeamMembers).toHaveBeenCalledWith(COMPANY_ID, dto);
        expect(mockService.replaceTeamMembers).toHaveBeenCalledTimes(1);
      });

      it('should propagate BusinessRuleException when exceeding max team members', async () => {
        mockService.replaceTeamMembers.mockRejectedValue(
          new BusinessRuleException('PROFILE_MAX_TEAM', 'errors.profile.maxTeam'),
        );

        await expect(
          profileController.replaceTeamMembers(COMPANY_ID, dto as any),
        ).rejects.toThrow(BusinessRuleException);
      });
    });

    // ─── POST /team/photo (uploadTeamPhoto) ─────────────────────

    describe('uploadTeamPhoto', () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'photo.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        buffer: Buffer.from('fake-image-data'),
        size: 1024,
        stream: null as any,
        destination: '',
        filename: 'photo.jpg',
        path: '',
      };

      it('should upload a team photo and return the URL', async () => {
        const uploadResult = { url: 'https://s3.amazonaws.com/navia-documents/profiles/profile-1/team/abc123.jpg' };
        mockService.uploadTeamPhoto.mockResolvedValue(uploadResult);

        const result = await profileController.uploadTeamPhoto(COMPANY_ID, mockFile);

        expect(result).toEqual(uploadResult);
        expect(mockService.uploadTeamPhoto).toHaveBeenCalledWith(COMPANY_ID, mockFile);
        expect(mockService.uploadTeamPhoto).toHaveBeenCalledTimes(1);
      });

      it('should propagate BusinessRuleException when S3 is unavailable', async () => {
        mockService.uploadTeamPhoto.mockRejectedValue(
          new BusinessRuleException('SYS_S3_UNAVAILABLE', 'errors.kyc.s3Unavailable'),
        );

        await expect(
          profileController.uploadTeamPhoto(COMPANY_ID, mockFile),
        ).rejects.toThrow(BusinessRuleException);
      });

      it('should propagate NotFoundException when profile not found', async () => {
        mockService.uploadTeamPhoto.mockRejectedValue(
          new NotFoundException('companyProfile'),
        );

        await expect(
          profileController.uploadTeamPhoto(COMPANY_ID, mockFile),
        ).rejects.toThrow(NotFoundException);
      });
    });

    // ─── GET /analytics (getAnalytics) ──────────────────────────

    describe('getAnalytics', () => {
      it('should return analytics with default period', async () => {
        mockService.getAnalytics.mockResolvedValue(mockAnalytics);

        const result = await profileController.getAnalytics(COMPANY_ID, undefined);

        expect(result).toEqual(mockAnalytics);
        expect(mockService.getAnalytics).toHaveBeenCalledWith(COMPANY_ID, undefined);
        expect(mockService.getAnalytics).toHaveBeenCalledTimes(1);
      });

      it('should pass the period parameter to the service', async () => {
        mockService.getAnalytics.mockResolvedValue({ ...mockAnalytics, period: '7d' });

        const result = await profileController.getAnalytics(COMPANY_ID, '7d');

        expect(result.period).toBe('7d');
        expect(mockService.getAnalytics).toHaveBeenCalledWith(COMPANY_ID, '7d');
      });

      it('should accept 90d period', async () => {
        mockService.getAnalytics.mockResolvedValue({ ...mockAnalytics, period: '90d' });

        await profileController.getAnalytics(COMPANY_ID, '90d');

        expect(mockService.getAnalytics).toHaveBeenCalledWith(COMPANY_ID, '90d');
      });

      it('should propagate NotFoundException when profile not found', async () => {
        mockService.getAnalytics.mockRejectedValue(
          new NotFoundException('companyProfile'),
        );

        await expect(
          profileController.getAnalytics(COMPANY_ID, '30d'),
        ).rejects.toThrow(NotFoundException);
      });
    });
  });

  // ============================================================
  // PublicProfileController
  // ============================================================

  describe('PublicProfileController', () => {
    // ─── GET /:slug (getPublicProfile) ──────────────────────────

    describe('getPublicProfile', () => {
      const mockRequest = {
        ip: '192.168.1.50',
        headers: {
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
          referer: 'https://google.com',
        },
      } as any;

      it('should return the public profile for a valid slug', async () => {
        mockService.getPublicProfile.mockResolvedValue(mockPublicProfile);

        const result = await publicController.getPublicProfile(
          SLUG,
          undefined,
          undefined,
          mockRequest,
        );

        expect(result).toEqual(mockPublicProfile);
        expect(mockService.getPublicProfile).toHaveBeenCalledWith(
          SLUG,
          undefined,
          undefined,
          '192.168.1.50',
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
          'https://google.com',
        );
        expect(mockService.getPublicProfile).toHaveBeenCalledTimes(1);
      });

      it('should pass password query param to the service', async () => {
        mockService.getPublicProfile.mockResolvedValue(mockPublicProfile);

        await publicController.getPublicProfile(
          SLUG,
          'secret123',
          undefined,
          mockRequest,
        );

        expect(mockService.getPublicProfile).toHaveBeenCalledWith(
          SLUG,
          'secret123',
          undefined,
          '192.168.1.50',
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
          'https://google.com',
        );
      });

      it('should pass email query param to the service', async () => {
        mockService.getPublicProfile.mockResolvedValue(mockPublicProfile);

        await publicController.getPublicProfile(
          SLUG,
          undefined,
          'investor@fund.com',
          mockRequest,
        );

        expect(mockService.getPublicProfile).toHaveBeenCalledWith(
          SLUG,
          undefined,
          'investor@fund.com',
          '192.168.1.50',
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
          'https://google.com',
        );
      });

      it('should handle request with referrer header (alternate spelling)', async () => {
        const reqWithReferrer = {
          ip: '10.0.0.1',
          headers: {
            'user-agent': 'TestAgent/1.0',
            referrer: 'https://linkedin.com/feed',
          },
        } as any;

        mockService.getPublicProfile.mockResolvedValue(mockPublicProfile);

        await publicController.getPublicProfile(
          SLUG,
          undefined,
          undefined,
          reqWithReferrer,
        );

        // referer is undefined, so falls through to referrer
        expect(mockService.getPublicProfile).toHaveBeenCalledWith(
          SLUG,
          undefined,
          undefined,
          '10.0.0.1',
          'TestAgent/1.0',
          'https://linkedin.com/feed',
        );
      });

      it('should handle request with no headers gracefully', async () => {
        const minimalRequest = {
          ip: undefined,
          headers: {},
        } as any;

        mockService.getPublicProfile.mockResolvedValue(mockPublicProfile);

        await publicController.getPublicProfile(
          SLUG,
          undefined,
          undefined,
          minimalRequest,
        );

        expect(mockService.getPublicProfile).toHaveBeenCalledWith(
          SLUG,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
        );
      });

      it('should propagate NotFoundException when profile not found or not published', async () => {
        mockService.getPublicProfile.mockRejectedValue(
          new NotFoundException('companyProfile'),
        );

        await expect(
          publicController.getPublicProfile(SLUG, undefined, undefined, mockRequest),
        ).rejects.toThrow(NotFoundException);
      });

      it('should propagate UnauthorizedException when password is required but missing', async () => {
        mockService.getPublicProfile.mockRejectedValue(
          new UnauthorizedException('errors.profile.passwordRequired'),
        );

        await expect(
          publicController.getPublicProfile(SLUG, undefined, undefined, mockRequest),
        ).rejects.toThrow(UnauthorizedException);
      });

      it('should propagate BusinessRuleException when email is required but missing', async () => {
        mockService.getPublicProfile.mockRejectedValue(
          new BusinessRuleException('PROFILE_EMAIL_REQUIRED', 'errors.profile.emailRequired'),
        );

        await expect(
          publicController.getPublicProfile(SLUG, undefined, undefined, mockRequest),
        ).rejects.toThrow(BusinessRuleException);
      });
    });
  });
});
