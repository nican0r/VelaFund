import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { ForbiddenException, NotFoundException } from '../../common/filters/app-exception';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

/**
 * RolesGuard enforces role-based access control for company-scoped endpoints.
 *
 * Behavior:
 * - If no @Roles() decorator on the handler/class, allows access (no restriction).
 * - If @Roles() is present but no :companyId in URL params, denies access (roles require company context).
 * - If @Roles() is present and :companyId exists:
 *   1. Looks up the user's CompanyMember record for that company.
 *   2. Returns 404 if user is not an ACTIVE member (prevents enumeration per security.md).
 *   3. Returns 403 if user's role is not in the allowed roles list.
 *   4. Attaches companyMember to request for downstream use.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get required roles from decorator (handler-level first, then class-level)
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @Roles() decorator — no role restriction, allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = (request as any).user as AuthenticatedUser | undefined;

    // If no user attached (should not happen if AuthGuard ran first), deny
    if (!user) {
      throw new ForbiddenException('errors.auth.forbidden');
      return false;
    }

    const companyId = request.params.companyId;

    // @Roles() on a non-company-scoped endpoint — programming error, deny access
    if (!companyId) {
      this.logger.warn(
        `@Roles() used on endpoint without :companyId param: ${request.method} ${request.path}`,
      );
      throw new ForbiddenException('errors.auth.forbidden');
    }

    // Look up user's membership in this company
    const member = await this.prisma.companyMember.findFirst({
      where: {
        companyId,
        userId: user.id,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        role: true,
        permissions: true,
      },
    });

    // Not a member — return 404 to prevent company ID enumeration (per security.md)
    if (!member) {
      throw new NotFoundException('company', companyId);
    }

    // Check if user's role is in the allowed roles
    if (!requiredRoles.includes(member.role)) {
      this.logger.warn(
        `Access denied: user ${user.id} has role ${member.role}, needs one of [${requiredRoles.join(', ')}] for company ${companyId}`,
      );
      throw new ForbiddenException('errors.auth.forbidden');
    }

    // Attach company member info to request for downstream use
    (request as any).companyMember = member;

    return true;
  }
}
