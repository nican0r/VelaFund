import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import {
  Prisma,
  ProfileAccessType,
  CompanyStatus,
  ProfileStatus,
  VerificationStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../aws/s3.service';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateMetricsDto } from './dto/update-metrics.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import {
  NotFoundException,
  ConflictException,
  BusinessRuleException,
  UnauthorizedException,
} from '../common/filters/app-exception';
import { LitigationCheckPayload, LitigationData } from './litigation-check.processor';

/** Reserved slugs that cannot be used for profiles */
const RESERVED_SLUGS = [
  'admin',
  'api',
  'auth',
  'login',
  'signup',
  'settings',
  'help',
  'support',
  'about',
  'profile',
  'dashboard',
];

/** Slug validation regex: lowercase alphanumeric + hyphens, no leading/trailing hyphens */
const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Generate a URL-safe slug from a company name.
 * Removes accents, replaces non-alphanumeric with hyphens,
 * appends a random 4-char hex suffix for uniqueness.
 */
function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9]+/g, '-') // non-alphanumeric -> hyphen
    .replace(/^-|-$/g, '') // trim leading/trailing hyphens
    .slice(0, 40);
  const suffix = randomBytes(2).toString('hex');
  return `${base}-${suffix}`;
}

/** Redact IP to /24 subnet for privacy */
function redactIp(ip: string | undefined): string | undefined {
  if (!ip) return undefined;
  const cleaned = ip.replace('::ffff:', '');
  const parts = cleaned.split('.');
  if (parts.length === 4) {
    parts[3] = '0/24';
    return parts.join('.');
  }
  return cleaned;
}

@Injectable()
export class CompanyProfileService {
  private readonly logger = new Logger(CompanyProfileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
    private readonly configService: ConfigService,
    @InjectQueue('profile-litigation')
    private readonly litigationQueue: Queue<LitigationCheckPayload>,
  ) {}

  // ─── CREATE ──────────────────────────────────────────────────────────

  async create(companyId: string, dto: CreateProfileDto, _userId: string) {
    // Verify company exists and is ACTIVE
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true, cnpj: true, status: true, foundedDate: true },
    });

    if (!company) {
      throw new NotFoundException('company', companyId);
    }

    if (company.status !== CompanyStatus.ACTIVE) {
      throw new BusinessRuleException(
        'PROFILE_COMPANY_NOT_ACTIVE',
        'errors.profile.companyNotActive',
      );
    }

    // Check no existing profile
    const existing = await this.prisma.companyProfile.findUnique({
      where: { companyId },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('PROFILE_ALREADY_EXISTS', 'errors.profile.alreadyExists');
    }

    // Generate a unique slug
    let slug = generateSlug(company.name);
    let slugExists = await this.prisma.companyProfile.findUnique({
      where: { slug },
      select: { id: true },
    });
    // Retry with a new suffix if collision (very unlikely but safe)
    let attempts = 0;
    while (slugExists && attempts < 5) {
      slug = generateSlug(company.name);
      slugExists = await this.prisma.companyProfile.findUnique({
        where: { slug },
        select: { id: true },
      });
      attempts++;
    }

    // Pre-populate foundedYear from Company.foundedDate
    let foundedYear = dto.foundedYear;
    if (!foundedYear && company.foundedDate) {
      foundedYear = new Date(company.foundedDate).getFullYear();
    }

    // Hash password if access type is PASSWORD
    let accessPasswordHash: string | null = null;
    if (dto.accessType === ProfileAccessType.PASSWORD && dto.accessPassword) {
      accessPasswordHash = await bcrypt.hash(dto.accessPassword, 10);
    }

    const profile = await this.prisma.companyProfile.create({
      data: {
        companyId,
        slug,
        headline: dto.headline,
        description: dto.description,
        sector: dto.sector,
        foundedYear,
        website: dto.website,
        location: dto.location,
        accessType: dto.accessType ?? ProfileAccessType.PUBLIC,
        accessPasswordHash,
        litigationStatus: VerificationStatus.PENDING,
      },
      include: {
        company: { select: { name: true, logoUrl: true } },
      },
    });

    // Dispatch async litigation check via Bull queue (non-blocking)
    this.dispatchLitigationCheck(profile.id, companyId, company.cnpj).catch((err) =>
      this.logger.warn(
        `Failed to dispatch litigation check for profile ${profile.id}: ${err.message}`,
      ),
    );

    this.logger.log(`Profile created for company ${companyId} with slug "${slug}"`);

    return this.stripSensitiveFields(profile);
  }

  // ─── FIND BY COMPANY ────────────────────────────────────────────────

  async findByCompanyId(companyId: string) {
    const profile = await this.prisma.companyProfile.findUnique({
      where: { companyId },
      include: {
        company: { select: { name: true, logoUrl: true } },
        metrics: { orderBy: { order: 'asc' } },
        team: { orderBy: { order: 'asc' } },
        documents: { orderBy: { order: 'asc' } },
        _count: { select: { views: true } },
      },
    });

    if (!profile) {
      throw new NotFoundException('companyProfile');
    }

    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
    return {
      ...this.stripSensitiveFields(profile),
      viewCount: profile._count.views,
      shareUrl: `${frontendUrl}/p/${profile.slug}`,
      litigation: this.formatLitigationResponse(profile),
    };
  }

  // ─── UPDATE ─────────────────────────────────────────────────────────

  async update(companyId: string, dto: UpdateProfileDto) {
    const profile = await this.prisma.companyProfile.findUnique({
      where: { companyId },
      select: { id: true, accessType: true },
    });

    if (!profile) {
      throw new NotFoundException('companyProfile');
    }

    const data: Prisma.CompanyProfileUpdateInput = {};

    if (dto.headline !== undefined) data.headline = dto.headline;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.sector !== undefined) data.sector = dto.sector;
    if (dto.foundedYear !== undefined) data.foundedYear = dto.foundedYear;
    if (dto.website !== undefined) data.website = dto.website;
    if (dto.location !== undefined) data.location = dto.location;
    if (dto.accessType !== undefined) data.accessType = dto.accessType;

    // Hash new password if access type is PASSWORD
    if (dto.accessType === ProfileAccessType.PASSWORD && dto.accessPassword) {
      data.accessPasswordHash = await bcrypt.hash(dto.accessPassword, 10);
    } else if (dto.accessType && dto.accessType !== ProfileAccessType.PASSWORD) {
      // Clear password hash when switching away from PASSWORD access
      data.accessPasswordHash = null;
    }

    const updated = await this.prisma.companyProfile.update({
      where: { companyId },
      data,
      include: {
        company: { select: { name: true, logoUrl: true } },
        metrics: { orderBy: { order: 'asc' } },
        team: { orderBy: { order: 'asc' } },
      },
    });

    return this.stripSensitiveFields(updated);
  }

  // ─── SLUG ───────────────────────────────────────────────────────────

  async updateSlug(companyId: string, slug: string) {
    const profile = await this.prisma.companyProfile.findUnique({
      where: { companyId },
      select: { id: true },
    });

    if (!profile) {
      throw new NotFoundException('companyProfile');
    }

    // Validate format
    if (!SLUG_REGEX.test(slug) || slug.length < 3 || slug.length > 50) {
      throw new BusinessRuleException('PROFILE_SLUG_INVALID', 'errors.profile.slugInvalid');
    }

    // Check reserved words
    if (RESERVED_SLUGS.includes(slug)) {
      throw new BusinessRuleException('PROFILE_SLUG_RESERVED', 'errors.profile.slugReserved');
    }

    // Check uniqueness
    const existing = await this.prisma.companyProfile.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (existing && existing.id !== profile.id) {
      throw new ConflictException('PROFILE_SLUG_TAKEN', 'errors.profile.slugTaken');
    }

    const updated = await this.prisma.companyProfile.update({
      where: { companyId },
      data: { slug },
      include: {
        company: { select: { name: true, logoUrl: true } },
      },
    });

    return this.stripSensitiveFields(updated);
  }

  // ─── PUBLISH / UNPUBLISH / ARCHIVE ──────────────────────────────────

  async publish(companyId: string) {
    const profile = await this.prisma.companyProfile.findUnique({
      where: { companyId },
      include: {
        metrics: { select: { id: true } },
        team: { select: { id: true } },
      },
    });

    if (!profile) {
      throw new NotFoundException('companyProfile');
    }

    // BR-10: profile must have some content to publish
    const hasContent =
      profile.headline ||
      profile.description ||
      profile.metrics.length > 0 ||
      profile.team.length > 0;

    if (!hasContent) {
      throw new BusinessRuleException('PROFILE_EMPTY', 'errors.profile.empty');
    }

    const updated = await this.prisma.companyProfile.update({
      where: { companyId },
      data: {
        status: ProfileStatus.PUBLISHED,
        publishedAt: new Date(),
        archivedAt: null,
      },
      include: {
        company: { select: { name: true, logoUrl: true } },
      },
    });

    return this.stripSensitiveFields(updated);
  }

  async unpublish(companyId: string) {
    const profile = await this.prisma.companyProfile.findUnique({
      where: { companyId },
      select: { id: true },
    });

    if (!profile) {
      throw new NotFoundException('companyProfile');
    }

    const updated = await this.prisma.companyProfile.update({
      where: { companyId },
      data: {
        status: ProfileStatus.DRAFT,
      },
      include: {
        company: { select: { name: true, logoUrl: true } },
      },
    });

    return this.stripSensitiveFields(updated);
  }

  async archive(companyId: string) {
    const profile = await this.prisma.companyProfile.findUnique({
      where: { companyId },
      select: { id: true },
    });

    if (!profile) {
      throw new NotFoundException('companyProfile');
    }

    const updated = await this.prisma.companyProfile.update({
      where: { companyId },
      data: {
        status: ProfileStatus.ARCHIVED,
        archivedAt: new Date(),
      },
      include: {
        company: { select: { name: true, logoUrl: true } },
      },
    });

    return this.stripSensitiveFields(updated);
  }

  // ─── METRICS ────────────────────────────────────────────────────────

  async replaceMetrics(companyId: string, dto: UpdateMetricsDto) {
    const profile = await this.prisma.companyProfile.findUnique({
      where: { companyId },
      select: { id: true },
    });

    if (!profile) {
      throw new NotFoundException('companyProfile');
    }

    if (dto.metrics.length > 6) {
      throw new BusinessRuleException('PROFILE_MAX_METRICS', 'errors.profile.maxMetrics');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Delete all existing metrics
      await tx.profileMetric.deleteMany({
        where: { profileId: profile.id },
      });

      // Create new metrics
      if (dto.metrics.length > 0) {
        await tx.profileMetric.createMany({
          data: dto.metrics.map((m) => ({
            profileId: profile.id,
            label: m.label,
            value: m.value,
            format: m.format,
            icon: m.icon ?? null,
            order: m.order,
          })),
        });
      }

      return tx.companyProfile.findUnique({
        where: { id: profile.id },
        include: {
          metrics: { orderBy: { order: 'asc' } },
          company: { select: { name: true, logoUrl: true } },
        },
      });
    });

    return this.stripSensitiveFields(result);
  }

  // ─── TEAM ───────────────────────────────────────────────────────────

  async replaceTeamMembers(companyId: string, dto: UpdateTeamDto) {
    const profile = await this.prisma.companyProfile.findUnique({
      where: { companyId },
      select: { id: true },
    });

    if (!profile) {
      throw new NotFoundException('companyProfile');
    }

    if (dto.teamMembers.length > 10) {
      throw new BusinessRuleException('PROFILE_MAX_TEAM', 'errors.profile.maxTeam');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Delete all existing team members
      await tx.profileTeamMember.deleteMany({
        where: { profileId: profile.id },
      });

      // Create new team members
      if (dto.teamMembers.length > 0) {
        await tx.profileTeamMember.createMany({
          data: dto.teamMembers.map((m) => ({
            profileId: profile.id,
            name: m.name,
            title: m.title,
            photoUrl: m.photoUrl ?? null,
            linkedinUrl: m.linkedinUrl ?? null,
            order: m.order,
          })),
        });
      }

      return tx.companyProfile.findUnique({
        where: { id: profile.id },
        include: {
          team: { orderBy: { order: 'asc' } },
          company: { select: { name: true, logoUrl: true } },
        },
      });
    });

    return this.stripSensitiveFields(result);
  }

  // ─── TEAM PHOTO UPLOAD ──────────────────────────────────────────────

  async uploadTeamPhoto(companyId: string, file: Express.Multer.File): Promise<{ url: string }> {
    const profile = await this.prisma.companyProfile.findUnique({
      where: { companyId },
      select: { id: true },
    });

    if (!profile) {
      throw new NotFoundException('companyProfile');
    }

    if (!this.s3Service.isAvailable()) {
      throw new BusinessRuleException('SYS_S3_UNAVAILABLE', 'errors.kyc.s3Unavailable');
    }

    const bucket = this.s3Service.getDocumentsBucket();
    if (!bucket) {
      throw new BusinessRuleException('SYS_S3_UNAVAILABLE', 'errors.kyc.s3Unavailable');
    }

    const ext = this.getFileExtension(file.mimetype);
    const key = `profiles/${profile.id}/team/${randomBytes(8).toString('hex')}${ext}`;

    await this.s3Service.upload(bucket, key, file.buffer, {
      contentType: file.mimetype,
    });

    const url = await this.s3Service.generatePresignedUrl(bucket, key, 86400); // 24h URL

    return { url };
  }

  // ─── PUBLIC PROFILE ─────────────────────────────────────────────────

  async getPublicProfile(
    slug: string,
    password?: string,
    email?: string,
    ip?: string,
    userAgent?: string,
    referrer?: string,
  ) {
    const profile = await this.prisma.companyProfile.findUnique({
      where: { slug },
      include: {
        company: { select: { name: true, logoUrl: true } },
        metrics: { orderBy: { order: 'asc' } },
        team: { orderBy: { order: 'asc' } },
        documents: { orderBy: { order: 'asc' } },
        _count: { select: { views: true } },
      },
    });

    if (!profile || profile.status !== ProfileStatus.PUBLISHED) {
      throw new NotFoundException('companyProfile');
    }

    // Access control checks
    if (profile.accessType === ProfileAccessType.PASSWORD) {
      if (!password) {
        throw new UnauthorizedException('errors.profile.passwordRequired');
      }
      if (!profile.accessPasswordHash) {
        throw new UnauthorizedException('errors.profile.invalidPassword');
      }
      const isValid = await bcrypt.compare(password, profile.accessPasswordHash);
      if (!isValid) {
        throw new UnauthorizedException('errors.profile.invalidPassword');
      }
    }

    if (profile.accessType === ProfileAccessType.EMAIL_GATED) {
      if (!email) {
        throw new BusinessRuleException('PROFILE_EMAIL_REQUIRED', 'errors.profile.emailRequired');
      }
    }

    // Record view asynchronously (fire-and-forget)
    this.recordView(profile.id, email, ip, userAgent, referrer).catch((err) =>
      this.logger.warn(`Failed to record profile view: ${err.message}`),
    );

    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');

    return {
      id: profile.id,
      slug: profile.slug,
      companyName: profile.company.name,
      companyLogo: profile.company.logoUrl,
      headline: profile.headline,
      description: profile.description,
      sector: profile.sector,
      foundedYear: profile.foundedYear,
      website: profile.website,
      location: profile.location,
      metrics: profile.metrics.map((m) => ({
        id: m.id,
        label: m.label,
        value: m.value,
        format: m.format,
        icon: m.icon,
        order: m.order,
      })),
      team: profile.team.map((t) => ({
        id: t.id,
        name: t.name,
        title: t.title,
        photoUrl: t.photoUrl,
        linkedinUrl: t.linkedinUrl,
        order: t.order,
      })),
      documents: profile.documents.map((d) => ({
        id: d.id,
        name: d.name,
        category: d.category,
        fileSize: d.fileSize,
        mimeType: d.mimeType,
        pageCount: d.pageCount,
        order: d.order,
      })),
      viewCount: profile._count.views,
      shareUrl: `${frontendUrl}/p/${profile.slug}`,
      publishedAt: profile.publishedAt,
      litigation: this.formatLitigationResponse(profile),
    };
  }

  // ─── ANALYTICS ──────────────────────────────────────────────────────

  async getAnalytics(companyId: string, period: '7d' | '30d' | '90d' = '30d') {
    const profile = await this.prisma.companyProfile.findUnique({
      where: { companyId },
      select: { id: true },
    });

    if (!profile) {
      throw new NotFoundException('companyProfile');
    }

    const daysMap = { '7d': 7, '30d': 30, '90d': 90 };
    const days = daysMap[period] || 30;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [totalViews, views, uniqueEmails] = await Promise.all([
      this.prisma.profileView.count({
        where: { profileId: profile.id },
      }),
      this.prisma.profileView.findMany({
        where: {
          profileId: profile.id,
          viewedAt: { gte: since },
        },
        orderBy: { viewedAt: 'desc' },
        select: {
          id: true,
          viewerEmail: true,
          viewerIp: true,
          userAgent: true,
          referrer: true,
          viewedAt: true,
        },
      }),
      this.prisma.profileView.groupBy({
        by: ['viewerIp'],
        where: {
          profileId: profile.id,
          viewedAt: { gte: since },
        },
      }),
    ]);

    // Group views by day
    const viewsByDay: Record<string, number> = {};
    for (const view of views) {
      const day = view.viewedAt.toISOString().split('T')[0];
      viewsByDay[day] = (viewsByDay[day] || 0) + 1;
    }

    // Build daily series for the period
    const dailySeries: { date: string; views: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      dailySeries.push({ date: key, views: viewsByDay[key] || 0 });
    }

    // Recent viewers (last 20)
    const recentViewers = views.slice(0, 20).map((v) => ({
      email: v.viewerEmail,
      ip: redactIp(v.viewerIp ?? undefined),
      referrer: v.referrer,
      viewedAt: v.viewedAt,
    }));

    return {
      totalViews,
      periodViews: views.length,
      uniqueViewers: uniqueEmails.length,
      period,
      viewsByDay: dailySeries,
      recentViewers,
    };
  }

  // ─── LITIGATION ────────────────────────────────────────────────────

  /**
   * Dispatch a litigation check Bull job for the given profile.
   * Fire-and-forget: profile creation succeeds regardless of queue status.
   */
  private async dispatchLitigationCheck(
    profileId: string,
    companyId: string,
    cnpj: string,
  ): Promise<void> {
    await this.litigationQueue.add(
      'fetch-litigation',
      { profileId, companyId, cnpj } satisfies LitigationCheckPayload,
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 30_000 }, // 30s, 60s, 120s
      },
    );

    this.logger.debug(`Litigation check dispatched for profile ${profileId}`);
  }

  /**
   * Format the litigation fields from a CompanyProfile into the API response shape.
   *
   * When COMPLETED: returns status, fetchedAt, summary, lawsuits, protestData.
   * When PENDING: returns status with null summary.
   * When FAILED: returns status with error message.
   * When null (no litigation check triggered): returns null.
   */
  formatLitigationResponse(profile: {
    litigationStatus: VerificationStatus | null;
    litigationData: Prisma.JsonValue | null;
    litigationFetchedAt: Date | null;
    litigationError: string | null;
  }): Record<string, unknown> | null {
    if (!profile.litigationStatus) return null;

    if (profile.litigationStatus === VerificationStatus.PENDING) {
      return {
        status: 'PENDING',
        fetchedAt: null,
        summary: null,
      };
    }

    if (profile.litigationStatus === VerificationStatus.FAILED) {
      return {
        status: 'FAILED',
        fetchedAt: null,
        summary: null,
        error: profile.litigationError ?? 'Verification service temporarily unavailable',
      };
    }

    // COMPLETED
    const data = profile.litigationData as unknown as LitigationData | null;
    return {
      status: 'COMPLETED',
      fetchedAt: profile.litigationFetchedAt?.toISOString() ?? null,
      summary: data?.summary ?? null,
      lawsuits: data?.lawsuits ?? [],
      protestData: data?.protestData ?? { totalProtests: 0, protests: [] },
    };
  }

  // ─── HELPERS ────────────────────────────────────────────────────────

  private async recordView(
    profileId: string,
    email?: string,
    ip?: string,
    userAgent?: string,
    referrer?: string,
  ): Promise<void> {
    await this.prisma.profileView.create({
      data: {
        profileId,
        viewerEmail: email ?? null,
        viewerIp: redactIp(ip) ?? null,
        userAgent: userAgent ?? null,
        referrer: referrer ?? null,
      },
    });
  }

  private getFileExtension(mimetype: string): string {
    switch (mimetype) {
      case 'image/jpeg':
        return '.jpg';
      case 'image/png':
        return '.png';
      case 'image/webp':
        return '.webp';
      default:
        return '';
    }
  }

  /**
   * Remove sensitive fields (accessPasswordHash, litigationData) from
   * profile objects before returning to the client.
   */
  private stripSensitiveFields(profile: any): any {
    if (!profile) return profile;
    const { accessPasswordHash: _accessPasswordHash, litigationData: _litigationData, _count: __count, ...rest } = profile;
    return rest;
  }
}
