import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import {
  NotFoundException,
  ConflictException,
  BusinessRuleException,
  GoneException,
} from '../common/filters/app-exception';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { ListMembersQueryDto } from './dto/list-members-query.dto';
import { parseSort } from '../common/helpers/sort-parser';

const MAX_COMPANIES_PER_USER = 20;
const MAX_INVITATIONS_PER_DAY = 50;
const INVITATION_EXPIRY_DAYS = 7;
const PROTECTED_PERMISSIONS = ['usersManage'];

const ROLE_NAMES_PT_BR: Record<string, string> = {
  ADMIN: 'Administrador',
  FINANCE: 'Financeiro',
  LEGAL: 'Jurídico',
  INVESTOR: 'Investidor',
  EMPLOYEE: 'Colaborador',
};

const ROLE_NAMES_EN: Record<string, string> = {
  ADMIN: 'Administrator',
  FINANCE: 'Finance',
  LEGAL: 'Legal',
  INVESTOR: 'Investor',
  EMPLOYEE: 'Employee',
};

@Injectable()
export class MemberService {
  private readonly logger = new Logger(MemberService.name);
  private readonly frontendUrl: string;

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private configService: ConfigService,
  ) {
    this.frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
  }

  /**
   * Invite a new member to a company.
   *
   * Business rules:
   * - Company must not be DISSOLVED
   * - Max 50 invitations per company per day (SEC-3)
   * - No duplicate ACTIVE membership for the same email
   * - No duplicate PENDING invitation for the same email (use resend instead)
   * - Previously REMOVED members can be re-invited (unique constraint requires reusing the record)
   */
  async invite(companyId: string, dto: InviteMemberDto, inviterId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, status: true, name: true },
    });

    if (!company) {
      throw new NotFoundException('company', companyId);
    }

    if (company.status === 'DISSOLVED') {
      throw new BusinessRuleException('COMPANY_DISSOLVED', 'errors.company.dissolved', {
        companyId,
      });
    }

    // Rate limit: max 50 invitations per company per day
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const invitationsToday = await this.prisma.companyMember.count({
      where: {
        companyId,
        invitedAt: { gte: oneDayAgo },
        status: 'PENDING',
      },
    });

    if (invitationsToday >= MAX_INVITATIONS_PER_DAY) {
      throw new BusinessRuleException(
        'COMPANY_INVITATION_RATE_LIMIT',
        'errors.member.invitationRateLimit',
        { limit: MAX_INVITATIONS_PER_DAY },
      );
    }

    // Check for existing membership with this email
    const existingMember = await this.prisma.companyMember.findUnique({
      where: { companyId_email: { companyId, email: dto.email } },
      select: { id: true, status: true },
    });

    if (existingMember) {
      if (existingMember.status === 'ACTIVE') {
        throw new ConflictException('COMPANY_MEMBER_EXISTS', 'errors.member.alreadyExists', {
          email: dto.email,
        });
      }

      if (existingMember.status === 'PENDING') {
        throw new ConflictException(
          'COMPANY_INVITATION_PENDING',
          'errors.member.invitationPending',
          { email: dto.email },
        );
      }

      // REMOVED: re-invite by updating the existing record.
      // The @@unique([companyId, email]) constraint prevents creating a new record,
      // so we reuse the existing one. This is a deliberate design choice.
      return this.reinviteRemovedMember(existingMember.id, dto, inviterId, company.name);
    }

    // Create new member + invitation token atomically
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    const member = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const created = await tx.companyMember.create({
        data: {
          companyId,
          email: dto.email,
          role: dto.role,
          status: 'PENDING',
          invitedBy: inviterId,
          invitedAt: new Date(),
        },
      });

      await tx.invitationToken.create({
        data: {
          companyMemberId: created.id,
          token,
          expiresAt,
        },
      });

      return created;
    });

    this.logger.log(
      `Invitation sent to ${dto.email} for company ${companyId} with role ${dto.role}`,
    );

    // Send invitation email asynchronously — don't block the response on email delivery
    this.sendInvitationEmail(dto.email, token, company.name, dto.role, inviterId).catch((err) =>
      this.logger.warn(`Failed to send invitation email to ${dto.email}: ${err.message}`),
    );

    return member;
  }

  /**
   * List members of a company with optional filters and pagination.
   * Includes user details (name, avatar) for ACTIVE members.
   */
  async listMembers(companyId: string, query: ListMembersQueryDto) {
    const { page = 1, limit = 20, status, role, search, sort } = query;

    const where: Prisma.CompanyMemberWhereInput = { companyId };

    if (status) where.status = status;
    if (role) where.role = role;

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        {
          user: {
            firstName: { contains: search, mode: 'insensitive' },
          },
        },
        {
          user: {
            lastName: { contains: search, mode: 'insensitive' },
          },
        },
      ];
    }

    const sortFields = parseSort(sort, ['createdAt', 'email', 'role', 'invitedAt', 'acceptedAt']);
    const orderBy = sortFields.map((f) => ({ [f.field]: f.direction }));

    const [items, total] = await Promise.all([
      this.prisma.companyMember.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profilePictureUrl: true,
              walletAddress: true,
            },
          },
        },
      }),
      this.prisma.companyMember.count({ where }),
    ]);

    return { items, total };
  }

  /**
   * Update a member's role and/or fine-grained permissions.
   *
   * Business rules:
   * - Member must be ACTIVE
   * - Last admin cannot be demoted (last-admin guard)
   * - users:manage is a protected permission — cannot be granted to non-ADMIN roles
   */
  async updateMember(companyId: string, memberId: string, dto: UpdateMemberDto) {
    const member = await this.prisma.companyMember.findFirst({
      where: { id: memberId, companyId },
    });

    if (!member) {
      throw new NotFoundException('member', memberId);
    }

    if (member.status !== 'ACTIVE') {
      throw new BusinessRuleException('MEMBER_NOT_ACTIVE', 'errors.member.notActive', {
        memberId,
        status: member.status,
      });
    }

    // Last admin guard: if demoting an ADMIN to a different role
    if (dto.role && member.role === 'ADMIN' && dto.role !== 'ADMIN') {
      await this.ensureNotLastAdmin(companyId, memberId);
    }

    // Validate permission overrides
    if (dto.permissions) {
      const targetRole = dto.role || member.role;
      this.validatePermissionOverrides(
        dto.permissions as unknown as Record<string, unknown>,
        targetRole,
      );
    }

    const data: Prisma.CompanyMemberUpdateInput = {};
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.permissions !== undefined) {
      data.permissions =
        dto.permissions === null
          ? Prisma.DbNull
          : (dto.permissions as unknown as Prisma.InputJsonValue);
    }

    return this.prisma.companyMember.update({
      where: { id: memberId },
      data,
    });
  }

  /**
   * Remove a member from a company (soft delete).
   *
   * Business rules:
   * - Cannot remove the last ADMIN
   * - REMOVED status is terminal
   * - Both ACTIVE and PENDING members can be removed
   */
  async removeMember(companyId: string, memberId: string, removedById: string) {
    const member = await this.prisma.companyMember.findFirst({
      where: { id: memberId, companyId },
    });

    if (!member) {
      throw new NotFoundException('member', memberId);
    }

    if (member.status === 'REMOVED') {
      throw new BusinessRuleException('MEMBER_ALREADY_REMOVED', 'errors.member.alreadyRemoved', {
        memberId,
      });
    }

    // Last admin guard for active ADMINs
    if (member.status === 'ACTIVE' && member.role === 'ADMIN') {
      await this.ensureNotLastAdmin(companyId, memberId);
    }

    await this.prisma.companyMember.update({
      where: { id: memberId },
      data: {
        status: 'REMOVED',
        removedAt: new Date(),
        removedBy: removedById,
      },
    });
  }

  /**
   * Resend an invitation email by generating a new token.
   * The old token is replaced (1:1 relationship enforced by schema).
   *
   * Only works for PENDING members.
   */
  async resendInvitation(companyId: string, memberId: string) {
    const member = await this.prisma.companyMember.findFirst({
      where: { id: memberId, companyId },
      include: { invitationToken: true },
    });

    if (!member) {
      throw new NotFoundException('member', memberId);
    }

    if (member.status !== 'PENDING') {
      throw new BusinessRuleException('MEMBER_NOT_PENDING', 'errors.member.notPending', {
        memberId,
        status: member.status,
      });
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    // Upsert: update existing token or create if somehow missing
    await this.prisma.invitationToken.upsert({
      where: { companyMemberId: memberId },
      create: {
        companyMemberId: memberId,
        token,
        expiresAt,
      },
      update: {
        token,
        expiresAt,
        usedAt: null,
      },
    });

    this.logger.log(`Invitation resent for member ${memberId} in company ${companyId}`);

    // Send invitation email asynchronously — look up company name for the email
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true },
    });
    this.sendInvitationEmail(
      member.email,
      token,
      company?.name || 'Unknown',
      member.role,
      member.invitedBy,
    ).catch((err) =>
      this.logger.warn(`Failed to resend invitation email to ${member.email}: ${err.message}`),
    );

    return {
      id: memberId,
      email: member.email,
      status: member.status,
      newExpiresAt: expiresAt,
    };
  }

  /**
   * Get public-safe invitation details for the acceptance page.
   * Returns company info, role, inviter name, and whether the invitee has an account.
   */
  async getInvitationDetails(token: string) {
    const invitation = await this.prisma.invitationToken.findUnique({
      where: { token },
      include: {
        companyMember: {
          include: {
            company: {
              select: { id: true, name: true, logoUrl: true },
            },
          },
        },
      },
    });

    if (!invitation || invitation.usedAt) {
      throw new NotFoundException('invitation', token);
    }

    if (invitation.expiresAt < new Date()) {
      throw new GoneException('INVITATION_EXPIRED', 'errors.member.invitationExpired', {
        expiresAt: invitation.expiresAt.toISOString(),
      });
    }

    const member = invitation.companyMember;

    // Check if invitee already has a Navia account
    const existingUser = await this.prisma.user.findFirst({
      where: { email: member.email },
      select: { id: true },
    });

    // Fetch inviter name for the invitation page
    let invitedByName: string | null = null;
    if (member.invitedBy) {
      const inviter = await this.prisma.user.findUnique({
        where: { id: member.invitedBy },
        select: { firstName: true, lastName: true },
      });
      if (inviter) {
        invitedByName = [inviter.firstName, inviter.lastName].filter(Boolean).join(' ') || null;
      }
    }

    return {
      companyName: member.company.name,
      companyLogoUrl: member.company.logoUrl,
      role: member.role,
      invitedByName,
      invitedAt: member.invitedAt,
      expiresAt: invitation.expiresAt,
      email: member.email,
      hasExistingAccount: !!existingUser,
    };
  }

  /**
   * Accept an invitation and become an active company member.
   *
   * Business rules:
   * - Token must exist, not be used, and not be expired
   * - Email match is NOT enforced (any authenticated user can accept — BR-6)
   * - User must not already be an active member of the company
   * - User must not exceed the 20-company membership limit
   */
  async acceptInvitation(token: string, userId: string, userEmail: string) {
    const invitation = await this.prisma.invitationToken.findUnique({
      where: { token },
      include: {
        companyMember: {
          select: {
            id: true,
            companyId: true,
            status: true,
            email: true,
            role: true,
          },
        },
      },
    });

    if (!invitation || invitation.usedAt) {
      throw new NotFoundException('invitation', token);
    }

    if (invitation.expiresAt < new Date()) {
      throw new GoneException('INVITATION_EXPIRED', 'errors.member.invitationExpired', {
        expiresAt: invitation.expiresAt.toISOString(),
      });
    }

    const member = invitation.companyMember;

    if (member.status !== 'PENDING') {
      throw new BusinessRuleException(
        'INVITATION_ALREADY_ACCEPTED',
        'errors.member.invitationAlreadyAccepted',
      );
    }

    // Check user is not already an active member of this company
    const existingActiveMember = await this.prisma.companyMember.findFirst({
      where: {
        companyId: member.companyId,
        userId,
        status: 'ACTIVE',
      },
    });

    if (existingActiveMember) {
      throw new ConflictException('COMPANY_MEMBER_EXISTS', 'errors.member.alreadyExists', {
        companyId: member.companyId,
      });
    }

    // Check 20-company membership limit
    const membershipCount = await this.prisma.companyMember.count({
      where: {
        userId,
        status: { in: ['PENDING', 'ACTIVE'] },
      },
    });

    if (membershipCount >= MAX_COMPANIES_PER_USER) {
      throw new BusinessRuleException(
        'COMPANY_MEMBER_LIMIT_REACHED',
        'errors.member.companyLimitReached',
        { limit: MAX_COMPANIES_PER_USER, current: membershipCount },
      );
    }

    // Atomic: activate member + mark token as used
    const result = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const updated = await tx.companyMember.update({
        where: { id: member.id },
        data: {
          userId,
          email: userEmail, // Update to accepting user's email (BR-6)
          status: 'ACTIVE',
          acceptedAt: new Date(),
        },
        include: {
          company: { select: { id: true, name: true } },
        },
      });

      await tx.invitationToken.update({
        where: { id: invitation.id },
        data: { usedAt: new Date() },
      });

      return updated;
    });

    this.logger.log(
      `Invitation accepted: user ${userId} joined company ${member.companyId} as ${member.role}`,
    );

    return {
      memberId: result.id,
      companyId: result.companyId,
      companyName: result.company.name,
      role: result.role,
      status: result.status,
      acceptedAt: result.acceptedAt,
    };
  }

  /**
   * Re-invite a previously REMOVED member by resetting their record to PENDING.
   * Required because the @@unique([companyId, email]) constraint prevents
   * creating a new CompanyMember with the same email.
   */
  private async reinviteRemovedMember(
    existingId: string,
    dto: InviteMemberDto,
    inviterId: string,
    companyName: string,
  ) {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    const result = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const member = await tx.companyMember.update({
        where: { id: existingId },
        data: {
          role: dto.role,
          status: 'PENDING',
          invitedBy: inviterId,
          invitedAt: new Date(),
          acceptedAt: null,
          removedAt: null,
          removedBy: null,
          userId: null,
        },
      });

      await tx.invitationToken.upsert({
        where: { companyMemberId: member.id },
        create: {
          companyMemberId: member.id,
          token,
          expiresAt,
        },
        update: {
          token,
          expiresAt,
          usedAt: null,
        },
      });

      return member;
    });

    this.logger.log(`Re-invitation sent for ${dto.email} (previously removed member)`);

    // Send invitation email asynchronously
    this.sendInvitationEmail(dto.email, token, companyName, dto.role, inviterId).catch((err) =>
      this.logger.warn(`Failed to send re-invitation email to ${dto.email}: ${err.message}`),
    );

    return result;
  }

  /**
   * Send an invitation email via the EmailService.
   * Gracefully degrades: if SES is unavailable, logs a warning but does not throw.
   */
  private async sendInvitationEmail(
    email: string,
    token: string,
    companyName: string,
    role: string,
    inviterId: string | null,
  ): Promise<void> {
    if (!this.emailService.isAvailable()) {
      this.logger.warn(`Email service unavailable — invitation email to ${email} not sent`);
      return;
    }

    // Look up inviter name
    let inviterName = 'A team member';
    if (inviterId) {
      const inviter = await this.prisma.user.findUnique({
        where: { id: inviterId },
        select: { firstName: true, lastName: true, locale: true },
      });
      if (inviter) {
        inviterName =
          [inviter.firstName, inviter.lastName].filter(Boolean).join(' ') || 'A team member';
      }
    }

    // Look up invitee locale preference (if they already have an account)
    let locale = 'pt-BR';
    const existingUser = await this.prisma.user.findFirst({
      where: { email },
      select: { locale: true },
    });
    if (existingUser?.locale) {
      locale = existingUser.locale;
    }

    const invitationUrl = `${this.frontendUrl}/invitations/${token}`;
    const roleNames = locale === 'en' ? ROLE_NAMES_EN : ROLE_NAMES_PT_BR;
    const roleName = roleNames[role] || role;

    await this.emailService.sendEmail({
      to: email,
      templateName: 'invitation',
      locale,
      variables: {
        inviterName,
        companyName,
        roleName,
        invitationUrl,
        expiryDays: String(INVITATION_EXPIRY_DAYS),
      },
    });

    this.logger.debug(`Invitation email sent to ${email}`);
  }

  /**
   * Ensure that removing or demoting a member would not leave the company
   * with zero ADMINs. Throws COMPANY_LAST_ADMIN if it would.
   */
  private async ensureNotLastAdmin(companyId: string, excludeMemberId: string) {
    const adminCount = await this.prisma.companyMember.count({
      where: {
        companyId,
        role: 'ADMIN',
        status: 'ACTIVE',
        id: { not: excludeMemberId },
      },
    });

    if (adminCount === 0) {
      throw new BusinessRuleException('COMPANY_LAST_ADMIN', 'errors.member.lastAdmin', {
        companyId,
      });
    }
  }

  /**
   * Validate that permission overrides don't grant protected permissions
   * to non-ADMIN roles. The users:manage permission can only be held by ADMINs.
   */
  private validatePermissionOverrides(permissions: Record<string, unknown>, role: string) {
    if (role !== 'ADMIN') {
      for (const protectedPerm of PROTECTED_PERMISSIONS) {
        if (permissions[protectedPerm] === true) {
          throw new BusinessRuleException(
            'MEMBER_PERMISSION_PROTECTED',
            'errors.member.permissionProtected',
            { permission: protectedPerm },
          );
        }
      }
    }
  }
}
