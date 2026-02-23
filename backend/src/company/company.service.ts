import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { parseSort } from '../common/helpers/sort-parser';
import {
  NotFoundException,
  ConflictException,
  BusinessRuleException,
} from '../common/filters/app-exception';

/** Maximum number of companies a user can be a member of. */
const MAX_COMPANIES_PER_USER = 20;

/** CNPJ checksum validation (Módulo 11). */
function isValidCnpjChecksum(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return false;
  // Reject all-same-digit CNPJs
  if (/^(\d)\1{13}$/.test(digits)) return false;

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(digits[i], 10) * weights1[i];
  }
  let remainder = sum % 11;
  const check1 = remainder < 2 ? 0 : 11 - remainder;
  if (parseInt(digits[12], 10) !== check1) return false;

  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(digits[i], 10) * weights2[i];
  }
  remainder = sum % 11;
  const check2 = remainder < 2 ? 0 : 11 - remainder;
  return parseInt(digits[13], 10) === check2;
}

@Injectable()
export class CompanyService {
  private readonly logger = new Logger(CompanyService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new company and assign the creator as ADMIN.
   *
   * Business rules:
   * - BR-4: Creator auto-assigned as ADMIN member
   * - BR-6: User cannot be a member of more than 20 companies
   * - CNPJ must be unique and pass checksum validation
   * - Company starts in DRAFT status (async CNPJ validation via Verifik is a future step)
   */
  async create(dto: CreateCompanyDto, userId: string) {
    // Validate CNPJ checksum
    if (!isValidCnpjChecksum(dto.cnpj)) {
      throw new BusinessRuleException(
        'COMPANY_INVALID_CNPJ',
        'errors.company.invalidCnpj',
        { cnpj: dto.cnpj },
      );
    }

    // Parse foundedDate if provided and validate it's not in the future
    let foundedDate: Date | undefined;
    if (dto.foundedDate) {
      foundedDate = new Date(dto.foundedDate);
      if (isNaN(foundedDate.getTime())) {
        throw new BusinessRuleException(
          'COMPANY_INVALID_DATE',
          'errors.company.invalidFoundedDate',
        );
      }
      if (foundedDate > new Date()) {
        throw new BusinessRuleException(
          'COMPANY_FUTURE_DATE',
          'errors.company.futureFoundedDate',
        );
      }
    }

    // BR-6: Check membership limit
    const membershipCount = await this.prisma.companyMember.count({
      where: {
        userId,
        status: { in: ['PENDING', 'ACTIVE'] },
      },
    });

    if (membershipCount >= MAX_COMPANIES_PER_USER) {
      throw new BusinessRuleException(
        'COMPANY_MEMBERSHIP_LIMIT',
        'errors.company.membershipLimit',
        { limit: MAX_COMPANIES_PER_USER, current: membershipCount },
      );
    }

    // Atomically create the company and the creator's ADMIN membership
    try {
      const company = await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const created = await tx.company.create({
            data: {
              name: dto.name,
              entityType: dto.entityType,
              cnpj: dto.cnpj,
              description: dto.description ?? null,
              foundedDate: foundedDate ?? null,
              defaultCurrency: dto.defaultCurrency ?? 'BRL',
              fiscalYearEnd: dto.fiscalYearEnd ?? '12-31',
              timezone: dto.timezone ?? 'America/Sao_Paulo',
              locale: dto.locale ?? 'pt-BR',
              createdById: userId,
            },
          });

          // BR-4: Auto-assign creator as ADMIN
          const user = await tx.user.findUniqueOrThrow({
            where: { id: userId },
            select: { email: true },
          });

          await tx.companyMember.create({
            data: {
              companyId: created.id,
              userId,
              email: user.email,
              role: 'ADMIN',
              status: 'ACTIVE',
              invitedBy: userId,
              acceptedAt: new Date(),
            },
          });

          return created;
        },
      );

      this.logger.log(
        `Company ${company.id} created by user ${userId} (CNPJ: ${dto.cnpj})`,
      );

      return company;
    } catch (error) {
      // Handle unique constraint violation on CNPJ
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const target = (error.meta?.target as string[]) || [];
        if (target.includes('cnpj')) {
          throw new ConflictException(
            'COMPANY_CNPJ_DUPLICATE',
            'errors.company.cnpjDuplicate',
            { cnpj: dto.cnpj },
          );
        }
      }
      throw error;
    }
  }

  /**
   * List all companies where the authenticated user is an ACTIVE member.
   *
   * Includes the user's role and the member count for each company.
   */
  async findAllForUser(
    userId: string,
    pagination: PaginationQueryDto,
    filters: { status?: string; sort?: string },
  ) {
    const sortFields = parseSort(filters.sort, [
      'name',
      'createdAt',
      'status',
    ]);

    const where: Prisma.CompanyMemberWhereInput = {
      userId,
      status: 'ACTIVE',
      ...(filters.status
        ? { company: { status: filters.status as any } }
        : {}),
    };

    const [memberships, total] = await Promise.all([
      this.prisma.companyMember.findMany({
        where,
        include: {
          company: {
            select: {
              id: true,
              name: true,
              entityType: true,
              cnpj: true,
              status: true,
              logoUrl: true,
              createdAt: true,
            },
          },
        },
        orderBy: sortFields.map((sf) => ({
          company: { [sf.field]: sf.direction },
        })),
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
      }),
      this.prisma.companyMember.count({ where }),
    ]);

    // Enrich with member counts
    const companyIds = memberships.map((m) => m.company.id);
    const memberCounts = await this.prisma.companyMember.groupBy({
      by: ['companyId'],
      where: {
        companyId: { in: companyIds },
        status: 'ACTIVE',
      },
      _count: { id: true },
    });

    const countMap = new Map(
      memberCounts.map((mc) => [mc.companyId, mc._count.id]),
    );

    const items = memberships.map((m) => ({
      id: m.company.id,
      name: m.company.name,
      entityType: m.company.entityType,
      cnpj: m.company.cnpj,
      status: m.company.status,
      logoUrl: m.company.logoUrl,
      role: m.role,
      memberCount: countMap.get(m.company.id) || 0,
      createdAt: m.company.createdAt,
    }));

    return { items, total };
  }

  /**
   * Get a single company by ID.
   *
   * The RolesGuard has already verified that the caller is a member of this company.
   */
  async findById(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundException('company', companyId);
    }

    return company;
  }

  /**
   * Update company details.
   *
   * Business rules:
   * - BR-2: DISSOLVED companies cannot be updated
   * - BR-5: entityType and CNPJ are not updateable via this endpoint
   */
  async update(companyId: string, dto: UpdateCompanyDto) {
    const existing = await this.findById(companyId);

    // BR-2: DISSOLVED is permanent read-only
    if (existing.status === 'DISSOLVED') {
      throw new BusinessRuleException(
        'COMPANY_CANNOT_UPDATE_DISSOLVED',
        'errors.company.cannotUpdateDissolved',
        { companyId },
      );
    }

    const data: Prisma.CompanyUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.logoUrl !== undefined) data.logoUrl = dto.logoUrl;
    if (dto.defaultCurrency !== undefined)
      data.defaultCurrency = dto.defaultCurrency;
    if (dto.fiscalYearEnd !== undefined)
      data.fiscalYearEnd = dto.fiscalYearEnd;
    if (dto.timezone !== undefined) data.timezone = dto.timezone;
    if (dto.locale !== undefined) data.locale = dto.locale;

    const updated = await this.prisma.company.update({
      where: { id: companyId },
      data,
    });

    this.logger.log(`Company ${companyId} updated`);

    return updated;
  }

  /**
   * Dissolve (archive) a company. This is a permanent, irreversible action.
   *
   * Business rules:
   * - BR-1: Must have zero active shareholders
   * - BR-1: All funding rounds must be closed or cancelled
   * - BR-2: DISSOLVED companies are fully read-only
   * - Cannot dissolve a company that is already DISSOLVED
   */
  async dissolve(companyId: string) {
    const existing = await this.findById(companyId);

    if (existing.status === 'DISSOLVED') {
      throw new BusinessRuleException(
        'COMPANY_ALREADY_DISSOLVED',
        'errors.company.alreadyDissolved',
        { companyId },
      );
    }

    // BR-1: Check for active shareholders
    const activeShareholders = await this.prisma.shareholder.count({
      where: { companyId, status: 'ACTIVE' },
    });

    if (activeShareholders > 0) {
      throw new BusinessRuleException(
        'COMPANY_HAS_ACTIVE_SHAREHOLDERS',
        'errors.company.hasActiveShareholders',
        { count: activeShareholders },
      );
    }

    // BR-1: Check for active funding rounds (not CLOSED or CANCELLED)
    const activeRounds = await this.prisma.fundingRound.count({
      where: {
        companyId,
        status: { notIn: ['CLOSED', 'CANCELLED'] },
      },
    });

    if (activeRounds > 0) {
      throw new BusinessRuleException(
        'COMPANY_HAS_ACTIVE_ROUNDS',
        'errors.company.hasActiveRounds',
        { count: activeRounds },
      );
    }

    const dissolved = await this.prisma.company.update({
      where: { id: companyId },
      data: { status: 'DISSOLVED' },
    });

    this.logger.log(`Company ${companyId} dissolved`);

    return dissolved;
  }

  /**
   * Transition company status (ACTIVE ↔ INACTIVE).
   *
   * Valid transitions:
   * - ACTIVE → INACTIVE (admin deactivation)
   * - INACTIVE → ACTIVE (admin re-activation)
   */
  async updateStatus(companyId: string, newStatus: 'ACTIVE' | 'INACTIVE') {
    const existing = await this.findById(companyId);

    if (existing.status === 'DISSOLVED') {
      throw new BusinessRuleException(
        'COMPANY_CANNOT_UPDATE_DISSOLVED',
        'errors.company.cannotUpdateDissolved',
        { companyId },
      );
    }

    if (existing.status === 'DRAFT') {
      throw new BusinessRuleException(
        'COMPANY_INVALID_STATUS_TRANSITION',
        'errors.company.invalidStatusTransition',
        { currentStatus: existing.status, targetStatus: newStatus },
      );
    }

    // Validate the transition
    const validTransitions: Record<string, string[]> = {
      ACTIVE: ['INACTIVE'],
      INACTIVE: ['ACTIVE'],
    };

    if (!validTransitions[existing.status]?.includes(newStatus)) {
      throw new BusinessRuleException(
        'COMPANY_INVALID_STATUS_TRANSITION',
        'errors.company.invalidStatusTransition',
        { currentStatus: existing.status, targetStatus: newStatus },
      );
    }

    const updated = await this.prisma.company.update({
      where: { id: companyId },
      data: { status: newStatus },
    });

    this.logger.log(
      `Company ${companyId} status changed: ${existing.status} → ${newStatus}`,
    );

    return updated;
  }
}
