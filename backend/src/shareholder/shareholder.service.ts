import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateShareholderDto } from './dto/create-shareholder.dto';
import { UpdateShareholderDto } from './dto/update-shareholder.dto';
import { ListShareholdersQueryDto } from './dto/list-shareholders-query.dto';
import { SetBeneficialOwnersDto } from './dto/set-beneficial-owners.dto';
import { parseSort } from '../common/helpers/sort-parser';
import {
  NotFoundException,
  ConflictException,
  BusinessRuleException,
} from '../common/filters/app-exception';

/**
 * Validate CPF checksum using Módulo 11 algorithm.
 * @param cpf Formatted CPF (XXX.XXX.XXX-XX) or raw digits.
 */
export function isValidCpfChecksum(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  const weights1 = [10, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits[i], 10) * weights1[i];
  }
  let remainder = sum % 11;
  const check1 = remainder < 2 ? 0 : 11 - remainder;
  if (parseInt(digits[9], 10) !== check1) return false;

  const weights2 = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2];
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits[i], 10) * weights2[i];
  }
  remainder = sum % 11;
  const check2 = remainder < 2 ? 0 : 11 - remainder;
  return parseInt(digits[10], 10) === check2;
}

/**
 * Validate CNPJ checksum using Módulo 11 algorithm.
 * @param cnpj Formatted CNPJ (XX.XXX.XXX/XXXX-XX) or raw digits.
 */
export function isValidCnpjChecksum(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(digits[i], 10) * weights1[i];
  }
  let remainder = sum % 11;
  const check1 = remainder < 2 ? 0 : 11 - remainder;
  if (parseInt(digits[12], 10) !== check1) return false;

  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(digits[i], 10) * weights2[i];
  }
  remainder = sum % 11;
  const check2 = remainder < 2 ? 0 : 11 - remainder;
  return parseInt(digits[13], 10) === check2;
}

/**
 * Compute a blind index (SHA-256 hash) for a CPF/CNPJ value.
 * Used for uniqueness checks without exposing the raw value.
 */
function computeBlindIndex(value: string): string {
  const normalized = value.replace(/\D/g, '');
  return createHash('sha256').update(normalized).digest('hex').slice(0, 32);
}

/**
 * Determine if a CPF/CNPJ string is CPF (11 digits) or CNPJ (14 digits).
 */
function getCpfCnpjType(value: string): 'CPF' | 'CNPJ' | null {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 11) return 'CPF';
  if (digits.length === 14) return 'CNPJ';
  return null;
}

@Injectable()
export class ShareholderService {
  private readonly logger = new Logger(ShareholderService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new shareholder for a company.
   *
   * Business rules:
   * - Company must exist and be ACTIVE
   * - BR-1: CPF/CNPJ unique per company (enforced via blind index)
   * - BR-3: CORPORATE type must use CNPJ, non-corporate must use CPF
   * - BR-4: isForeign auto-computed from taxResidency
   * - walletAddress is never accepted from request (auto-derived from User)
   */
  async create(companyId: string, dto: CreateShareholderDto) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundException('company', companyId);
    }

    if (company.status !== 'ACTIVE') {
      throw new BusinessRuleException(
        'SHAREHOLDER_COMPANY_NOT_ACTIVE',
        'errors.shareholder.companyNotActive',
        { companyId, status: company.status },
      );
    }

    // Validate CPF/CNPJ if provided
    let cpfCnpjBlindIndex: string | null = null;
    if (dto.cpfCnpj) {
      const docType = getCpfCnpjType(dto.cpfCnpj);

      if (!docType) {
        throw new BusinessRuleException(
          'SHAREHOLDER_INVALID_DOCUMENT',
          'errors.shareholder.invalidDocument',
          { cpfCnpj: dto.cpfCnpj },
        );
      }

      // BR-3: CORPORATE shareholders must use CNPJ
      if (dto.type === 'CORPORATE' && docType !== 'CNPJ') {
        throw new BusinessRuleException(
          'SHAREHOLDER_CORPORATE_NEEDS_CNPJ',
          'errors.shareholder.corporateNeedsCnpj',
        );
      }

      // Non-corporate shareholders must use CPF
      if (dto.type !== 'CORPORATE' && docType !== 'CPF') {
        throw new BusinessRuleException(
          'SHAREHOLDER_INDIVIDUAL_NEEDS_CPF',
          'errors.shareholder.individualNeedsCpf',
        );
      }

      // Validate checksum
      if (docType === 'CPF' && !isValidCpfChecksum(dto.cpfCnpj)) {
        throw new BusinessRuleException(
          'SHAREHOLDER_INVALID_CPF',
          'errors.shareholder.invalidCpf',
          { cpfCnpj: dto.cpfCnpj },
        );
      }

      if (docType === 'CNPJ' && !isValidCnpjChecksum(dto.cpfCnpj)) {
        throw new BusinessRuleException(
          'SHAREHOLDER_INVALID_CNPJ',
          'errors.shareholder.invalidCnpj',
          { cpfCnpj: dto.cpfCnpj },
        );
      }

      cpfCnpjBlindIndex = computeBlindIndex(dto.cpfCnpj);
    }

    // BR-4: Auto-compute isForeign from taxResidency
    const taxResidency = dto.taxResidency ?? 'BR';
    const isForeign = taxResidency !== 'BR';

    // Parse rdeIedDate if provided
    let rdeIedDate: Date | undefined;
    if (dto.rdeIedDate) {
      rdeIedDate = new Date(dto.rdeIedDate);
      if (isNaN(rdeIedDate.getTime())) {
        throw new BusinessRuleException(
          'SHAREHOLDER_INVALID_RDE_DATE',
          'errors.shareholder.invalidRdeDate',
        );
      }
    }

    try {
      const shareholder = await this.prisma.shareholder.create({
        data: {
          companyId,
          name: dto.name,
          type: dto.type,
          email: dto.email ?? null,
          phone: dto.phone ?? null,
          cpfCnpj: dto.cpfCnpj ?? null,
          cpfCnpjBlindIndex,
          nationality: dto.nationality ?? 'BR',
          taxResidency,
          isForeign,
          address: dto.address ? (dto.address as any) : null,
          rdeIedNumber: dto.rdeIedNumber ?? null,
          rdeIedDate: rdeIedDate ?? null,
        },
      });

      this.logger.log(
        `Shareholder ${shareholder.id} (${dto.name}) created for company ${companyId}`,
      );

      return shareholder;
    } catch (error) {
      // Handle unique constraint violation on [companyId, cpfCnpjBlindIndex]
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'SHAREHOLDER_CPF_CNPJ_DUPLICATE',
          'errors.shareholder.cpfCnpjDuplicate',
          { companyId },
        );
      }
      throw error;
    }
  }

  /**
   * List all shareholders for a company with pagination, filtering, and sorting.
   */
  async findAll(companyId: string, query: ListShareholdersQueryDto) {
    const sortFields = parseSort(query.sort, [
      'name',
      'type',
      'status',
      'createdAt',
      'nationality',
    ]);

    const where: Prisma.ShareholderWhereInput = {
      companyId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.isForeign !== undefined
        ? { isForeign: query.isForeign === 'true' }
        : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.shareholder.findMany({
        where,
        orderBy: sortFields.map((sf) => ({ [sf.field]: sf.direction })),
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.shareholder.count({ where }),
    ]);

    return { items, total };
  }

  /**
   * Get a single shareholder by ID within a company scope.
   * Includes ownership breakdown via shareholdings.
   */
  async findById(companyId: string, shareholderId: string) {
    const shareholder = await this.prisma.shareholder.findFirst({
      where: { id: shareholderId, companyId },
      include: {
        shareholdings: {
          include: {
            shareClass: {
              select: {
                id: true,
                className: true,
                type: true,
                votesPerShare: true,
              },
            },
          },
        },
        beneficialOwners: true,
      },
    });

    if (!shareholder) {
      throw new NotFoundException('shareholder', shareholderId);
    }

    return shareholder;
  }

  /**
   * Update mutable shareholder fields.
   *
   * Immutable fields: name, cpfCnpj, type, walletAddress.
   * Mutable fields: email, phone, address, taxResidency, rdeIedNumber, rdeIedDate.
   *
   * BR-4: Changing taxResidency recalculates isForeign.
   */
  async update(
    companyId: string,
    shareholderId: string,
    dto: UpdateShareholderDto,
  ) {
    const existing = await this.prisma.shareholder.findFirst({
      where: { id: shareholderId, companyId },
    });

    if (!existing) {
      throw new NotFoundException('shareholder', shareholderId);
    }

    const data: Prisma.ShareholderUpdateInput = {};
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.address !== undefined) data.address = dto.address ? (dto.address as any) : null;
    if (dto.rdeIedNumber !== undefined) data.rdeIedNumber = dto.rdeIedNumber;

    if (dto.rdeIedDate !== undefined) {
      if (dto.rdeIedDate) {
        const parsed = new Date(dto.rdeIedDate);
        if (isNaN(parsed.getTime())) {
          throw new BusinessRuleException(
            'SHAREHOLDER_INVALID_RDE_DATE',
            'errors.shareholder.invalidRdeDate',
          );
        }
        data.rdeIedDate = parsed;
      } else {
        data.rdeIedDate = null;
      }
    }

    // BR-4: Changing taxResidency recalculates isForeign
    if (dto.taxResidency !== undefined) {
      data.taxResidency = dto.taxResidency;
      data.isForeign = dto.taxResidency !== 'BR';
    }

    const updated = await this.prisma.shareholder.update({
      where: { id: shareholderId },
      data,
    });

    this.logger.log(
      `Shareholder ${shareholderId} updated for company ${companyId}`,
    );

    return updated;
  }

  /**
   * Delete or inactivate a shareholder.
   *
   * BR-6: Cannot hard-delete if shareholder has holdings or transaction history.
   * If shares > 0 or transactions exist, set status to INACTIVE instead.
   * If no shares and no transactions, perform hard delete.
   */
  async remove(companyId: string, shareholderId: string) {
    const existing = await this.prisma.shareholder.findFirst({
      where: { id: shareholderId, companyId },
    });

    if (!existing) {
      throw new NotFoundException('shareholder', shareholderId);
    }

    // Check for active shareholdings
    const holdingsCount = await this.prisma.shareholding.count({
      where: { shareholderId },
    });

    // Check for transaction history
    const transactionCount = await this.prisma.transaction.count({
      where: {
        OR: [
          { fromShareholderId: shareholderId },
          { toShareholderId: shareholderId },
        ],
      },
    });

    if (holdingsCount > 0 || transactionCount > 0) {
      // Soft delete: set status to INACTIVE
      if (existing.status === 'INACTIVE') {
        throw new BusinessRuleException(
          'SHAREHOLDER_ALREADY_INACTIVE',
          'errors.shareholder.alreadyInactive',
          { shareholderId },
        );
      }

      await this.prisma.shareholder.update({
        where: { id: shareholderId },
        data: { status: 'INACTIVE' },
      });

      this.logger.log(
        `Shareholder ${shareholderId} set to INACTIVE (has holdings or transactions)`,
      );

      return { action: 'INACTIVATED' };
    }

    // Hard delete: no holdings, no transactions
    await this.prisma.shareholder.delete({
      where: { id: shareholderId },
    });

    this.logger.log(
      `Shareholder ${shareholderId} deleted from company ${companyId}`,
    );

    return { action: 'DELETED' };
  }

  /**
   * Set beneficial owners for a corporate shareholder.
   *
   * Business rules:
   * - Shareholder must be of type CORPORATE
   * - Percentages must sum to <= 100%
   * - At least one owner must have >= 25% ownership (AML compliance)
   * - Replaces all existing beneficial owners (upsert pattern)
   */
  async setBeneficialOwners(
    companyId: string,
    shareholderId: string,
    dto: SetBeneficialOwnersDto,
  ) {
    const shareholder = await this.prisma.shareholder.findFirst({
      where: { id: shareholderId, companyId },
    });

    if (!shareholder) {
      throw new NotFoundException('shareholder', shareholderId);
    }

    if (shareholder.type !== 'CORPORATE') {
      throw new BusinessRuleException(
        'SHAREHOLDER_NOT_CORPORATE',
        'errors.shareholder.notCorporate',
        { shareholderId, type: shareholder.type },
      );
    }

    // Validate percentages sum <= 100
    const totalPct = dto.beneficialOwners.reduce(
      (sum, owner) => sum.plus(new Prisma.Decimal(owner.ownershipPercentage)),
      new Prisma.Decimal(0),
    );

    if (totalPct.gt(100)) {
      throw new BusinessRuleException(
        'SHAREHOLDER_UBO_PERCENTAGES_EXCEED',
        'errors.shareholder.uboPercentagesExceed',
        { totalPercentage: totalPct.toString() },
      );
    }

    // At least one owner must have >= 25% (AML rule)
    const hasQualifiedOwner = dto.beneficialOwners.some((owner) =>
      new Prisma.Decimal(owner.ownershipPercentage).gte(25),
    );

    if (!hasQualifiedOwner) {
      throw new BusinessRuleException(
        'SHAREHOLDER_UBO_NO_QUALIFIED_OWNER',
        'errors.shareholder.uboNoQualifiedOwner',
      );
    }

    // Replace all existing beneficial owners atomically
    const result = await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        await tx.beneficialOwner.deleteMany({
          where: { shareholderId },
        });

        const owners = await Promise.all(
          dto.beneficialOwners.map((owner) =>
            tx.beneficialOwner.create({
              data: {
                shareholderId,
                name: owner.name,
                cpf: owner.cpf ?? null,
                ownershipPct: new Prisma.Decimal(owner.ownershipPercentage),
              },
            }),
          ),
        );

        return owners;
      },
    );

    this.logger.log(
      `Set ${result.length} beneficial owners for shareholder ${shareholderId}`,
    );

    return result;
  }

  /**
   * List foreign shareholders for a company with summary statistics.
   */
  async findForeignShareholders(companyId: string) {
    const shareholders = await this.prisma.shareholder.findMany({
      where: {
        companyId,
        isForeign: true,
        status: 'ACTIVE',
      },
      include: {
        shareholdings: {
          select: {
            quantity: true,
            ownershipPct: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Compute summary
    let totalForeignOwnershipPct = new Prisma.Decimal(0);
    for (const sh of shareholders) {
      for (const holding of sh.shareholdings) {
        totalForeignOwnershipPct = totalForeignOwnershipPct.plus(
          new Prisma.Decimal(holding.ownershipPct.toString()),
        );
      }
    }

    return {
      shareholders,
      summary: {
        totalForeignShareholders: shareholders.length,
        totalForeignOwnershipPercentage: totalForeignOwnershipPct.toString(),
      },
    };
  }
}
